import express from 'express';
import mongoose from 'mongoose';
import NotificationCampaign from '../models/NotificationCampaign.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import PushSubscription from '../models/PushSubscription.js';
import Customer from '../models/Customer.js';
import { protect, staffOrAdmin } from '../middleware/auth.js';
import { notificationService } from '../services/notificationService.js';
import { normalizePhoneNumber } from '../utils/phoneNormalizer.js';
import {
  executeCampaign,
  getEstimatedAudienceCount,
  getEligiblePushSubscriptions,
} from '../services/campaignRunner.js';

const router = express.Router();

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
      channel: String(req.body.channel || 'web_push'),
      audienceType,
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
