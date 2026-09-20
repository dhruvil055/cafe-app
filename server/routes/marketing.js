import express from 'express';
import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import CampaignDelivery from '../models/CampaignDelivery.js';
import Customer from '../models/Customer.js';
import PushSubscription from '../models/PushSubscription.js';
import MarketingSetting, { getMarketingSettings } from '../models/MarketingSetting.js';
import { protect, staffOrAdmin } from '../middleware/auth.js';
import { notificationService } from '../services/notificationService.js';
import {
  executeCampaign,
  getEstimatedAudienceCount,
  retryFailedDeliveries,
} from '../services/campaignRunner.js';
import { normalizePhoneNumber } from '../utils/phoneNormalizer.js';

const router = express.Router();

/**
 * Marketing Overview & Analytics
 * GET /api/marketing/stats
 */
router.get('/stats', protect, staffOrAdmin, async (req, res) => {
  try {
    const [
      optedInCustomers,
      totalCustomers,
      campaignsList,
      deliveryStats,
      channelStats,
    ] = await Promise.all([
      Customer.countDocuments({ marketingConsent: true, status: 'active' }),
      Customer.countDocuments(),
      Campaign.find().sort({ createdAt: -1 }).limit(10).lean(),
      CampaignDelivery.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      CampaignDelivery.aggregate([
        {
          $group: {
            _id: '$channel',
            total: { $sum: 1 },
            delivered: {
              $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const deliveryMap = {};
    deliveryStats.forEach((d) => {
      deliveryMap[d._id] = d.count;
    });

    const messagesSent = (deliveryMap.sent || 0) + (deliveryMap.delivered || 0) + (deliveryMap.failed || 0);
    const messagesDelivered = deliveryMap.delivered || 0;
    const messagesFailed = deliveryMap.failed || 0;
    const deliveryRate = messagesSent > 0 ? Math.round((messagesDelivered / messagesSent) * 100) : 100;

    const campaignsSent = campaignsList.filter((c) => ['sent', 'partially_failed'].includes(c.status)).length;

    // Build month-by-month customer opt-in trend for charts (last 6 months)
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short' });

      const [totalCount, optInCount] = await Promise.all([
        Customer.countDocuments({ createdAt: { $lt: nextMonth } }),
        Customer.countDocuments({ createdAt: { $lt: nextMonth }, marketingConsent: true }),
      ]);

      months.push({
        month: label,
        totalCustomers: totalCount,
        optedIn: optInCount,
      });
    }

    res.json({
      metrics: {
        optedInCustomers,
        totalCustomers,
        campaignsSent,
        messagesSent,
        messagesDelivered,
        messagesFailed,
        deliveryRate,
      },
      channelStats,
      recentCampaigns: campaignsList,
      growthData: months,
    });
  } catch (err) {
    console.error('Marketing stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve marketing statistics.' });
  }
});

/**
 * Real-time Audience Estimation Count
 * GET /api/marketing/audience/count
 */
router.get('/audience/count', protect, staffOrAdmin, async (req, res) => {
  try {
    const { audienceType = 'all_opted_in', minOrders, maxOrders, minSpent, daysSinceFirstOrder, maxDaysInactive } = req.query;

    const filter = {
      minOrders,
      maxOrders,
      minSpent,
      daysSinceFirstOrder,
      maxDaysInactive,
    };

    const count = await getEstimatedAudienceCount(audienceType, filter);
    res.json({ count });
  } catch (err) {
    console.error('Audience count error:', err);
    res.status(500).json({ error: 'Failed to calculate audience estimate.' });
  }
});

/**
 * List Campaigns
 * GET /api/marketing/campaigns
 */
router.get('/campaigns', protect, staffOrAdmin, async (req, res) => {
  try {
    const { status, channel, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (channel) query.channel = channel;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [campaigns, total] = await Promise.all([
      Campaign.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'name email')
        .lean(),
      Campaign.countDocuments(query),
    ]);

    res.json({
      campaigns,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      limit: limitNum,
    });
  } catch (err) {
    console.error('List campaigns error:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns.' });
  }
});

/**
 * Create & Dispatch / Schedule Campaign
 * POST /api/marketing/campaigns
 */
router.post('/campaigns', protect, staffOrAdmin, async (req, res) => {
  try {
    const {
      name,
      title,
      message,
      channel,
      audienceType = 'all_opted_in',
      audienceFilter = {},
      offerCode = '',
      startDate,
      endDate,
      scheduledAt,
      sendImmediately = false,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Campaign name is required.' });
    if (!title?.trim()) return res.status(400).json({ error: 'Campaign title is required.' });
    if (!message?.trim()) return res.status(400).json({ error: 'Message content is required.' });
    if (!['sms', 'whatsapp', 'push', 'all'].includes(channel)) {
      return res.status(400).json({ error: 'Valid channel (sms, whatsapp, push, all) is required.' });
    }

    let status = 'draft';
    let parsedScheduledAt = null;

    if (scheduledAt) {
      parsedScheduledAt = new Date(scheduledAt);
      if (isNaN(parsedScheduledAt.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled date/time.' });
      }
      if (parsedScheduledAt > new Date()) {
        status = 'scheduled';
      }
    }

    const campaign = await Campaign.create({
      name: name.trim(),
      title: title.trim(),
      message: message.trim(),
      channel,
      audienceType,
      audienceFilter,
      offerCode: offerCode ? offerCode.trim().toUpperCase() : '',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      scheduledAt: parsedScheduledAt,
      status,
      createdBy: req.user?._id || null,
    });

    // If requested to send immediately or schedule time is in past/now
    if (sendImmediately || (scheduledAt && parsedScheduledAt <= new Date())) {
      // Execute asynchronously in background
      executeCampaign(campaign._id).catch((err) => {
        console.error(`Background campaign error for ${campaign._id}:`, err);
      });
      campaign.status = 'sending';
      await campaign.save();
    }

    res.status(201).json({
      campaign,
      message: status === 'scheduled'
        ? `Campaign scheduled for ${parsedScheduledAt.toLocaleString('en-IN')}`
        : 'Campaign queued for immediate delivery.',
    });
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ error: err.message || 'Failed to create campaign.' });
  }
});

/**
 * Campaign Details with Delivery Logs
 * GET /api/marketing/campaigns/:id
 */
router.get('/campaigns/:id', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }

    const campaign = await Campaign.findById(req.params.id).populate('createdBy', 'name email').lean();
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const skip = (page - 1) * limit;

    const [deliveries, totalDeliveries, statusCounts] = await Promise.all([
      CampaignDelivery.find({ campaignId: campaign._id })
        .populate('customerId', 'name phone email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CampaignDelivery.countDocuments({ campaignId: campaign._id }),
      CampaignDelivery.aggregate([
        { $match: { campaignId: new mongoose.Types.ObjectId(campaign._id) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const deliveryBreakdown = {};
    statusCounts.forEach((s) => {
      deliveryBreakdown[s._id] = s.count;
    });

    res.json({
      campaign,
      deliveries,
      totalDeliveries,
      page,
      totalPages: Math.ceil(totalDeliveries / limit) || 1,
      deliveryBreakdown,
    });
  } catch (err) {
    console.error('Campaign detail error:', err);
    res.status(500).json({ error: 'Failed to retrieve campaign details.' });
  }
});

/**
 * Manually Trigger Send Campaign
 * POST /api/marketing/campaigns/:id/send
 */
router.post('/campaigns/:id/send', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    if (campaign.status === 'sending') {
      return res.status(400).json({ error: 'Campaign is already sending.' });
    }

    executeCampaign(campaign._id).catch((err) => {
      console.error(`Send trigger error for campaign ${campaign._id}:`, err);
    });

    campaign.status = 'sending';
    await campaign.save();

    res.json({ campaign, message: 'Campaign sending has been initiated.' });
  } catch (err) {
    console.error('Trigger send error:', err);
    res.status(500).json({ error: 'Failed to trigger campaign delivery.' });
  }
});

/**
 * Cancel Campaign
 * POST /api/marketing/campaigns/:id/cancel
 */
router.post('/campaigns/:id/cancel', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    if (['sent', 'sending'].includes(campaign.status)) {
      return res.status(400).json({ error: `Cannot cancel a campaign that is already ${campaign.status}.` });
    }

    campaign.status = 'cancelled';
    await campaign.save();

    res.json({ campaign, message: 'Campaign cancelled successfully.' });
  } catch (err) {
    console.error('Cancel campaign error:', err);
    res.status(500).json({ error: 'Failed to cancel campaign.' });
  }
});

/**
 * Retry Failed Deliveries
 * POST /api/marketing/campaigns/:id/retry-failed
 */
router.post('/campaigns/:id/retry-failed', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }

    const result = await retryFailedDeliveries(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('Retry failed deliveries error:', err);
    res.status(500).json({ error: err.message || 'Failed to retry deliveries.' });
  }
});

/**
 * Get / Update Marketing Settings & Anti-Spam Rules
 * GET /api/marketing/settings
 * PUT /api/marketing/settings
 */
router.get('/settings', protect, staffOrAdmin, async (req, res) => {
  try {
    const settings = await getMarketingSettings();
    res.json({ settings });
  } catch (err) {
    console.error('Fetch settings error:', err);
    res.status(500).json({ error: 'Failed to fetch marketing settings.' });
  }
});

router.put('/settings', protect, staffOrAdmin, async (req, res) => {
  try {
    const { maxPromotionsPerCustomerPeriod, periodDays, enabledChannels, whatsappCloud, twilio } = req.body;
    const settings = await getMarketingSettings();

    if (maxPromotionsPerCustomerPeriod && Number(maxPromotionsPerCustomerPeriod) > 0) {
      settings.maxPromotionsPerCustomerPeriod = Number(maxPromotionsPerCustomerPeriod);
    }
    if (periodDays && Number(periodDays) > 0) {
      settings.periodDays = Number(periodDays);
    }
    if (enabledChannels && typeof enabledChannels === 'object') {
      settings.enabledChannels = {
        ...settings.enabledChannels,
        ...enabledChannels,
      };
    }
    if (whatsappCloud && typeof whatsappCloud === 'object') {
      settings.whatsappCloud = {
        accessToken: whatsappCloud.accessToken?.trim() || '',
        phoneNumberId: whatsappCloud.phoneNumberId?.trim() || '',
        businessAccountId: whatsappCloud.businessAccountId?.trim() || '',
      };
    }
    if (twilio && typeof twilio === 'object') {
      settings.twilio = {
        accountSid: twilio.accountSid?.trim() || '',
        authToken: twilio.authToken?.trim() || '',
        phoneNumber: twilio.phoneNumber?.trim() || '',
      };
    }

    await settings.save();
    res.json({ settings, message: 'Marketing & API Gateway settings updated successfully.' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update marketing settings.' });
  }
});

/**
 * Send Test Message directly to a number
 * POST /api/marketing/test-dispatch
 */
router.post('/test-dispatch', protect, staffOrAdmin, async (req, res) => {
  try {
    const { channel, phone, title, message, offerCode } = req.body;
    if (!channel) return res.status(400).json({ error: 'Channel is required.' });

    const normalizedPhone = normalizePhoneNumber(phone) || phone;
    const digitsOnly = String(normalizedPhone).replace(/[^\d]/g, '');
    const formattedMessage = `${title ? `*${title}*\n\n` : ''}${message || '☕ Special Offer from Brewhaus Café!'}${offerCode ? `\n\nUse Promo Code: *${offerCode}*` : ''}\n\nVisit Brewhaus Café`;
    const directWhatsAppUrl = `https://api.whatsapp.com/send?phone=${digitsOnly}&text=${encodeURIComponent(formattedMessage)}`;

    let result;
    if (channel === 'whatsapp' || channel === 'all') {
      if (!phone) return res.status(400).json({ error: 'Phone number is required for WhatsApp test.' });
      result = await notificationService.sendWhatsApp({
        phone: normalizedPhone,
        message: formattedMessage,
        offerCode: offerCode || '',
        variables: { name: 'Admin (Test)', offer: title || 'Test Offer', code: offerCode || '' },
      });
    } else if (channel === 'sms') {
      if (!phone) return res.status(400).json({ error: 'Phone number is required for SMS test.' });
      result = await notificationService.sendSMS({
        phone: normalizedPhone,
        message: formattedMessage,
        offerCode: offerCode || '',
      });
    } else if (channel === 'push') {
      const sampleSub = await PushSubscription.findOne({ active: true });
      if (!sampleSub) {
        return res.status(400).json({ error: 'No active browser push subscriptions found to test.' });
      }
      result = await notificationService.sendPush({
        subscription: sampleSub,
        title: title || '☕ Brewhaus Café Test',
        message: message || 'Test push notification',
        offerCode: offerCode || 'TEST',
      });
    }

    res.json({
      success: true,
      message: result?.requiresDirectOpen
        ? `Direct WhatsApp link ready for ${phone}. Click to open WhatsApp!`
        : `Message dispatched successfully via ${result?.provider || channel}!`,
      directWhatsAppUrl,
      result,
    });
  } catch (err) {
    console.error('Test dispatch error:', err);
    res.status(500).json({ error: err.message || 'Failed to dispatch test message.' });
  }
});

/**
 * Trigger Order Sync to Customers
 * POST /api/marketing/sync-orders
 */
router.post('/sync-orders', protect, staffOrAdmin, async (req, res) => {
  try {
    const { syncOrdersToCustomers } = await import('../utils/syncOrdersToCustomers.js');
    const result = await syncOrdersToCustomers();
    res.json({ success: true, message: 'Customer sync complete!', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to sync orders.' });
  }
});

export default router;
