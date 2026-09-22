import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import NotificationCampaign from '../models/NotificationCampaign.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import PushSubscription from '../models/PushSubscription.js';
import Customer from '../models/Customer.js';
import { protect, staffOrAdmin } from '../middleware/auth.js';
import { notificationService, CHANNELS } from '../services/notificationService.js';
import { normalizePhoneNumber } from '../utils/phoneNormalizer.js';
import { parseUserAgent } from '../utils/deviceParser.js';
import {
  executeCampaign,
  getEstimatedAudienceCount,
  getEligiblePushSubscriptions,
} from '../services/campaignRunner.js';

const router = express.Router();

// ── Per-route rate limiters (defense in depth on top of global limiters) ────
const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many subscription attempts. Please try again later.' },
});

const adminSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many send requests. Please try again later.' },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0]?.msg || 'Invalid request.' });
  }
  return next();
};

// v1 website notifications are Web Push ONLY.
const normalizeChannel = (raw) => {
  const channel = String(raw || 'web_push').toLowerCase();
  if (['web', 'web_push', 'push'].includes(channel)) return 'web_push';
  if (['sms', 'whatsapp'].includes(channel)) {
    const err = new Error(`${raw} channel is coming soon. Web Push is the only active channel.`);
    err.code = 'CHANNEL_COMING_SOON';
    err.status = 400;
    throw err;
  }
  const err = new Error(`Unsupported channel "${raw}". Use "web".`);
  err.status = 400;
  throw err;
};

// Admin UI speaks 'all' | 'selected'; legacy callers may send 'all_enabled'.
const normalizeAudience = (raw) => {
  const audience = String(raw || 'all').toLowerCase();
  if (audience === 'all' || audience === 'all_enabled') return 'all';
  if (audience === 'selected') return 'selected';
  return audience; // legacy segments (new_customers, custom, ...) pass through
};

const sanitizeUrl = (raw) => {
  const url = String(raw || '/menu').trim().slice(0, 500);
  if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) return url;
  return '/menu';
};

/**
 * Public VAPID Public Key Endpoint
 * GET /api/notifications/vapid-public-key
 */
router.get('/vapid-public-key', (req, res) => {
  try {
    const publicKey = notificationService.getVapidPublicKey();
    res.json({ publicKey });
  } catch (err) {
    console.error('VAPID key error:', err);
    res.status(500).json({ error: 'Failed to retrieve VAPID public key.' });
  }
});

/**
 * Audience Categories Metadata
 * GET /api/notifications/audience
 */
router.get('/audience', protect, staffOrAdmin, (req, res) => {
  const audiences = [
    {
      id: 'all_enabled',
      name: 'All Notification-Enabled Customers',
      description: 'Every customer device that enabled web push notifications',
    },
    {
      id: 'single_customer',
      name: 'Single Customer (by Phone Number)',
      description: 'Send directly to a specific customer mobile phone via web push',
    },
    {
      id: 'new_customers',
      name: 'New Customers',
      description: 'Customers whose first order was within the last 30 days',
    },
    {
      id: 'returning_customers',
      name: 'Returning Customers',
      description: 'Customers who have ordered more than once',
    },
    {
      id: 'inactive_30d',
      name: "Haven't Ordered in 30 Days",
      description: 'Lapsed café guests who have not visited in 30+ days',
    },
    {
      id: 'frequent_5plus',
      name: 'Frequent Customers (5+ Orders)',
      description: 'Loyal café regulars with 5 or more completed orders',
    },
    {
      id: 'high_value',
      name: 'High-Value Customers (> ₹5,000)',
      description: 'High-spending customers with lifetime value above ₹5,000',
    },
    {
      id: 'custom',
      name: 'Custom Audience',
      description: 'Fine-grained filter by order counts, spend, and inactivity days',
    },
  ];

  res.json({ audiences });
});

/**
 * Real-Time Eligible Audience Count (Phase 13)
 * GET /api/notifications/audience/count
 */
router.get('/audience/count', protect, staffOrAdmin, async (req, res) => {
  try {
    const { audienceType = 'all_enabled', ...filterParams } = req.query;
    const count = await getEstimatedAudienceCount(audienceType, filterParams);

    let customerInfo = null;
    if (audienceType === 'single_customer' && filterParams.phone) {
      const normalized = normalizePhoneNumber(filterParams.phone) || filterParams.phone;
      const targetCustomer = await Customer.findOne({ phone: normalized }).lean();
      if (targetCustomer) {
        const subs = await PushSubscription.find({
          customerId: targetCustomer._id,
          $or: [{ isActive: true }, { active: true }],
        }).lean();
        customerInfo = {
          _id: targetCustomer._id,
          name: targetCustomer.name,
          phone: targetCustomer.phone,
          deviceCount: subs.length,
          devices: subs.map((s) => `${s.browser || 'Browser'} on ${s.deviceType || 'Device'}`),
        };
      }
    }

    res.json({ count, audienceType, customer: customerInfo });
  } catch (err) {
    console.error('Audience count error:', err);
    res.status(500).json({ error: 'Failed to calculate audience count.' });
  }
});

/**
 * Notification Analytics (Phase 21)
 * GET /api/notifications/analytics
 */
router.get('/analytics', protect, staffOrAdmin, async (req, res) => {
  try {
    const [
      totalCustomers,
      pushEnabledCustomers,
      totalActiveSubscriptions,
      campaignsSent,
      deliveryStats,
      recentDeliveries,
    ] = await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({ notificationPermission: true }),
      PushSubscription.countDocuments({ $or: [{ isActive: true }, { active: true }] }),
      NotificationCampaign.countDocuments({ status: 'sent' }),
      NotificationCampaign.aggregate([
        {
          $group: {
            _id: null,
            totalSent: { $sum: '$totalSent' },
            totalFailed: { $sum: '$totalFailed' },
            totalRecipients: { $sum: '$totalRecipients' },
          },
        },
      ]),
      NotificationDelivery.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const totals = deliveryStats[0] || { totalSent: 0, totalFailed: 0, totalRecipients: 0 };
    const pushDisabledCustomers = Math.max(0, totalCustomers - pushEnabledCustomers);

    // Group deliveries by day for trend chart
    const dailyDeliveriesMap = new Map();
    recentDeliveries.forEach((d) => {
      const day = new Date(d.createdAt).toISOString().split('T')[0];
      if (!dailyDeliveriesMap.has(day)) {
        dailyDeliveriesMap.set(day, { date: day, delivered: 0, failed: 0 });
      }
      const entry = dailyDeliveriesMap.get(day);
      if (d.status === 'delivered') entry.delivered += 1;
      else if (d.status === 'failed') entry.failed += 1;
    });

    const deliveryTrends = Array.from(dailyDeliveriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      summary: {
        totalCustomers,
        pushEnabled: pushEnabledCustomers,
        pushDisabled: pushDisabledCustomers,
        activeSubscriptions: totalActiveSubscriptions,
        campaignsSent,
        notificationsSent: totals.totalSent,
        notificationsFailed: totals.totalFailed,
        deliveryRate: totals.totalSent > 0
          ? `${Math.round(((totals.totalSent - totals.totalFailed) / totals.totalSent) * 100)}%`
          : '100%',
      },
      deliveryTrends,
    });
  } catch (err) {
    console.error('Notification analytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve notification analytics.' });
  }
});

/**
 * Supported channels metadata (Admin UI renders Website active,
 * SMS / WhatsApp as "Coming Soon").
 * GET /api/notifications/channels
 */
router.get('/channels', (req, res) => {
  res.json({ channels: CHANNELS });
});

/**
 * Subscribe a browser/device to Web Push (public).
 * POST /api/notifications/subscribe
 */
router.post(
  '/subscribe',
  subscribeLimiter,
  [
    body('subscription.endpoint').isString().notEmpty().withMessage('Subscription endpoint is required.'),
    body('subscription.keys.p256dh').isString().notEmpty().withMessage('Subscription p256dh key is required.'),
    body('subscription.keys.auth').isString().notEmpty().withMessage('Subscription auth key is required.'),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { subscription, customerId, phone } = req.body;

      const rawUa = req.body.userAgent || req.get('user-agent') || '';
      const { deviceType, browser } = parseUserAgent(rawUa);

      // Resolve customer from direct ID or phone number (guest devices stay unlinked).
      let resolvedCustomerId = customerId && mongoose.isValidObjectId(customerId) ? customerId : null;
      if (!resolvedCustomerId && phone) {
        const normalizedPhone = normalizePhoneNumber(phone);
        if (normalizedPhone) {
          const found = await Customer.findOne({ phone: normalizedPhone }).select('_id');
          if (found) resolvedCustomerId = found._id;
        }
      }

      // Upsert by endpoint — re-subscribing the same browser never duplicates.
      const sub = await PushSubscription.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
          customerId: resolvedCustomerId,
          userAgent: String(rawUa).slice(0, 300),
          deviceType,
          browser,
          isActive: true,
          active: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (resolvedCustomerId) {
        await Customer.findByIdAndUpdate(resolvedCustomerId, {
          notificationPermission: true,
          notificationEnabledAt: new Date(),
          'notificationPreferences.webPush': true,
        });
      }

      res.status(201).json({
        success: true,
        message: 'Push subscription saved successfully.',
        subscriptionId: sub._id,
        deviceType,
        browser,
      });
    } catch (err) {
      console.error('Notification subscribe error:', err.message);
      res.status(500).json({ error: 'Failed to register push subscription.' });
    }
  }
);

/**
 * Unsubscribe a browser/device from Web Push (public).
 * DELETE /api/notifications/unsubscribe
 */
router.delete('/unsubscribe', subscribeLimiter, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Push endpoint is required to unsubscribe.' });
    }

    const sub = await PushSubscription.findOneAndUpdate(
      { endpoint },
      { isActive: false, active: false },
      { new: true }
    );

    if (sub && sub.customerId) {
      const remainingActive = await PushSubscription.countDocuments({
        customerId: sub.customerId,
        $or: [{ isActive: true }, { active: true }],
      });
      if (remainingActive === 0) {
        await Customer.findByIdAndUpdate(sub.customerId, {
          notificationPermission: false,
          'notificationPreferences.webPush': false,
        });
      }
    }

    res.json({ success: true, message: 'Web push subscription deactivated successfully.' });
  } catch (err) {
    console.error('Notification unsubscribe error:', err.message);
    res.status(500).json({ error: 'Failed to deactivate push subscription.' });
  }
});

/**
 * Dashboard statistics (spec field names).
 * GET /api/notifications/stats
 */
router.get('/stats', protect, staffOrAdmin, async (req, res) => {
  try {
    const [
      totalNotifications,
      totalCustomers,
      activeSubscriptions,
      inactiveSubscriptions,
      deliveryTotals,
    ] = await Promise.all([
      NotificationCampaign.countDocuments(),
      Customer.countDocuments(),
      PushSubscription.countDocuments({ $or: [{ isActive: true }, { active: true }] }),
      PushSubscription.countDocuments({ isActive: false, active: false }),
      NotificationCampaign.aggregate([
        {
          $group: {
            _id: null,
            notificationsSent: { $sum: '$totalSent' },
            successfulDeliveries: {
              $sum: { $subtract: ['$totalSent', '$totalFailed'] },
            },
            failedDeliveries: { $sum: '$totalFailed' },
          },
        },
      ]),
    ]);

    const totals = deliveryTotals[0] || {
      notificationsSent: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
    };

    const webPushSubscribers = await Customer.countDocuments({ notificationPermission: true });

    res.json({
      totalNotifications,
      totalCustomers,
      webPushSubscribers,
      notificationsSent: totals.notificationsSent || 0,
      successfulDeliveries: Math.max(0, totals.successfulDeliveries || 0),
      failedDeliveries: totals.failedDeliveries || 0,
      activeSubscriptions,
      inactiveSubscriptions,
    });
  } catch (err) {
    console.error('Notification stats error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve notification statistics.' });
  }
});

/**
 * Unified send — admin writes title + message, clicks one button.
 * POST /api/notifications/send
 *
 * Validates auth → title → message → audience, creates the Notification
 * record, dispatches in controlled batches WITHOUT blocking the HTTP
 * request, and returns immediately with "campaign started".
 */
router.post(
  '/send',
  protect,
  staffOrAdmin,
  adminSendLimiter,
  [
    body('title').trim().isLength({ min: 1, max: 120 }).withMessage('Title is required (1–120 characters).'),
    body('message').trim().isLength({ min: 1, max: 500 }).withMessage('Message is required (1–500 characters).'),
    body('audienceType').optional().isString().withMessage('Invalid audience type.'),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const {
        title,
        message,
        url,
        actionUrl,
        image = '',
        name,
        audienceType = 'all',
        targetCustomers,
        customerIds,
        audienceFilter = {},
      } = req.body;

      let channel = 'web_push';
      try {
        channel = normalizeChannel(req.body.channel || 'web');
      } catch (err) {
        return res.status(err.status || 400).json({ error: err.message, code: err.code });
      }

      const audience = normalizeAudience(audienceType);
      const selectedIds = targetCustomers || customerIds || audienceFilter.customerIds || audienceFilter.targetCustomers;

      let eligibleFilter = { ...audienceFilter };
      if (audience === 'selected') {
        if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
          return res.status(400).json({ error: 'Select at least one customer for a targeted notification.' });
        }
        const validIds = selectedIds.filter((id) => mongoose.isValidObjectId(id));
        if (validIds.length === 0) {
          return res.status(400).json({ error: 'No valid customers selected.' });
        }
        eligibleFilter = { ...eligibleFilter, customerIds: validIds };
      }

      // Recipients = devices that can ACTUALLY receive Web Push (never raw customer count).
      const eligible = await getEligiblePushSubscriptions(audience, eligibleFilter);
      if (eligible.length === 0) {
        return res.status(400).json({ error: 'No eligible subscribers found. Customers need active Web Push subscriptions to receive website notifications.' });
      }

      const finalUrl = sanitizeUrl(actionUrl || url);

      const campaign = await NotificationCampaign.create({
        name: String(name || title).trim().slice(0, 200),
        title: String(title).trim(),
        message: String(message).trim(),
        image: String(image || '').trim().slice(0, 500),
        actionUrl: finalUrl,
        offerCode: '',
        channel,
        audienceType: audience,
        audienceFilter: eligibleFilter,
        status: 'sending',
        totalRecipients: eligible.length,
        totalSent: 0,
        totalFailed: 0,
        createdBy: req.user?._id || null,
      });

      // Audit log — who started what, for how many recipients.
      console.log(
        `[NOTIFICATION-AUDIT] admin=${req.user?.email || req.user?._id} campaign=${campaign._id} audience=${audience} recipients=${eligible.length}`
      );

      // Background dispatch — never block the admin's HTTP request.
      setImmediate(() => {
        executeCampaign(campaign._id).catch((err) => {
          console.error(`Async send error for campaign ${campaign._id}:`, err.message);
        });
      });

      res.status(202).json({
        success: true,
        message: 'Notification campaign started.',
        campaignId: campaign._id,
        recipients: eligible.length,
        channel: 'Website Notification',
      });
    } catch (err) {
      console.error('Send notification error:', err.message);
      res.status(500).json({ error: 'Failed to start notification campaign.' });
    }
  }
);

/**
 * Test mode — send to ONE device only. Must work before large campaigns.
 * POST /api/notifications/test
 */
router.post(
  '/test',
  protect,
  staffOrAdmin,
  adminSendLimiter,
  [
    body('title').optional().trim().isLength({ max: 120 }).withMessage('Title must be 120 characters or fewer.'),
    body('message').optional().trim().isLength({ max: 500 }).withMessage('Message must be 500 characters or fewer.'),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { subscriptionId, endpoint, customerId, phone } = req.body;
      const title = String(req.body.title || 'Test notification').slice(0, 120);
      const message = String(req.body.message || 'This is a test notification from Brewhaus Café.').slice(0, 500);
      const finalUrl = sanitizeUrl(req.body.url || req.body.actionUrl);

      let sub = null;
      if (subscriptionId && mongoose.isValidObjectId(subscriptionId)) {
        sub = await PushSubscription.findById(subscriptionId);
      } else if (endpoint) {
        sub = await PushSubscription.findOne({ endpoint });
      } else if (customerId && mongoose.isValidObjectId(customerId)) {
        sub = await PushSubscription.findOne({
          customerId,
          $or: [{ isActive: true }, { active: true }],
        }).sort({ updatedAt: -1 });
      } else if (phone) {
        const normalized = normalizePhoneNumber(phone);
        const customer = normalized ? await Customer.findOne({ phone: normalized }).select('_id') : null;
        if (customer) {
          sub = await PushSubscription.findOne({
            customerId: customer._id,
            $or: [{ isActive: true }, { active: true }],
          }).sort({ updatedAt: -1 });
        }
      } else {
        return res.status(400).json({ error: 'Provide subscriptionId, endpoint, customerId, or phone to target the test.' });
      }

      if (!sub) {
        return res.status(404).json({ error: 'No matching push subscription found. The device may not be subscribed yet.' });
      }
      if (!sub.isActive && !sub.active) {
        return res.status(400).json({ error: 'This subscription is inactive (expired or unsubscribed). Ask the customer to re-enable notifications.' });
      }

      try {
        await notificationService.sendPushNotification({
          subscription: sub,
          title,
          message,
          actionUrl: finalUrl,
        });
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          return res.status(400).json({ error: 'Test subscription is no longer valid and was deactivated. Ask the customer to re-enable notifications.' });
        }
        throw err;
      }

      await PushSubscription.updateOne({ _id: sub._id }, { lastUsedAt: new Date() });

      console.log(`[NOTIFICATION-AUDIT] admin=${req.user?.email || req.user?._id} test-send subscription=${sub._id}`);

      res.json({
        success: true,
        message: 'Test notification sent successfully.',
        device: { deviceType: sub.deviceType, browser: sub.browser },
      });
    } catch (err) {
      console.error('Test notification error:', err.message);
      res.status(500).json({ error: 'Failed to send test notification.' });
    }
  }
);

/**
 * List Campaigns / History (Phase 19)
 * GET /api/notifications
 */
router.get('/', protect, staffOrAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 15 } = req.query;
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const [campaigns, total] = await Promise.all([
      NotificationCampaign.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      NotificationCampaign.countDocuments(query),
    ]);

    res.json({
      campaigns,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    console.error('List notification campaigns error:', err);
    res.status(500).json({ error: 'Failed to retrieve notification campaigns.' });
  }
});

/**
 * Create Notification Campaign (Phase 11, 15, 20)
 * POST /api/notifications
 */
router.post('/', protect, staffOrAdmin, async (req, res) => {
  try {
    const {
      name,
      title,
      message,
      image = '',
      actionUrl = '/menu',
      offerCode = '',
      audienceType = 'all_enabled',
      audienceFilter = {},
      scheduleType = 'now', // 'now' or 'schedule'
      scheduledAt = null,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Campaign name is required.' });
    if (!title?.trim()) return res.status(400).json({ error: 'Notification title is required.' });
    if (!message?.trim()) return res.status(400).json({ error: 'Notification message is required.' });

    // Website notification system is Web Push ONLY in v1.
    let channel = 'web_push';
    try {
      channel = normalizeChannel(req.body.channel || 'web_push');
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message, code: err.code });
    }

    let finalScheduledAt = null;
    let initialStatus = 'draft';

    if (scheduleType === 'schedule') {
      if (!scheduledAt) {
        return res.status(400).json({ error: 'Scheduled date and time are required for scheduled notifications.' });
      }
      const schedDate = new Date(scheduledAt);
      if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future.' });
      }
      finalScheduledAt = schedDate;
      initialStatus = 'scheduled';
    }

    // Estimate initial recipient count
    const recipientCount = await getEstimatedAudienceCount(audienceType, audienceFilter);

    const campaign = await NotificationCampaign.create({
      name: name.trim(),
      title: title.trim(),
      message: message.trim(),
      image: String(image || '').trim(),
      actionUrl: String(actionUrl || '/menu').trim(),
      offerCode: String(offerCode || '').trim().toUpperCase(),
      channel,
      audienceType: normalizeAudience(audienceType) === 'all' ? 'all_enabled' : audienceType,
      audienceFilter,
      scheduledAt: finalScheduledAt,
      status: initialStatus,
      totalRecipients: recipientCount,
      createdBy: req.user?._id || null,
    });

    // If Send Now, execute immediately
    if (scheduleType === 'now') {
      executeCampaign(campaign._id).catch((err) => {
        console.error(`Async execution error for campaign ${campaign._id}:`, err);
      });
    }

    res.status(201).json({
      success: true,
      message: scheduleType === 'schedule'
        ? `Notification scheduled for ${finalScheduledAt.toLocaleString('en-IN')}`
        : 'Notification is being dispatched.',
      campaign,
    });
  } catch (err) {
    console.error('Create notification campaign error:', err);
    res.status(500).json({ error: err.message || 'Failed to create notification campaign.' });
  }
});

/**
 * Get Campaign Details & Delivery Log
 * GET /api/notifications/:id
 */
router.get('/:id', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }

    const campaign = await NotificationCampaign.findById(req.params.id).lean();
    if (!campaign) {
      return res.status(404).json({ error: 'Notification campaign not found.' });
    }

    const deliveries = await NotificationDelivery.find({ campaignId: campaign._id })
      .populate('customerId', 'name phone email')
      .populate('subscriptionId', 'deviceType browser endpoint')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ campaign, deliveries });
  } catch (err) {
    console.error('Get campaign details error:', err);
    res.status(500).json({ error: 'Failed to retrieve campaign details.' });
  }
});

/**
 * Dispatch Campaign Immediately
 * POST /api/notifications/:id/send
 */
router.post('/:id/send', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }

    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Notification campaign not found.' });
    }

    if (campaign.status === 'sent') {
      return res.status(400).json({ error: 'Campaign has already been sent.' });
    }

    // Trigger async execution
    executeCampaign(campaign._id).catch((err) => {
      console.error(`Send trigger error for campaign ${campaign._id}:`, err);
    });

    res.json({ success: true, message: 'Notification campaign dispatch initiated.' });
  } catch (err) {
    console.error('Send campaign error:', err);
    res.status(500).json({ error: 'Failed to send campaign.' });
  }
});

/**
 * Cancel Scheduled Campaign
 * POST /api/notifications/:id/cancel
 */
router.post('/:id/cancel', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }

    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Notification campaign not found.' });
    }

    if (campaign.status !== 'scheduled') {
      return res.status(400).json({ error: 'Only scheduled campaigns can be cancelled.' });
    }

    campaign.status = 'cancelled';
    await campaign.save();

    res.json({ success: true, message: 'Scheduled campaign cancelled.', campaign });
  } catch (err) {
    console.error('Cancel campaign error:', err);
    res.status(500).json({ error: 'Failed to cancel campaign.' });
  }
});

export default router;
