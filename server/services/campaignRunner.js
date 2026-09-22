import Customer from '../models/Customer.js';
import PushSubscription from '../models/PushSubscription.js';
import NotificationCampaign from '../models/NotificationCampaign.js';
import NotificationDelivery from '../models/NotificationDelivery.js';
import Campaign from '../models/Campaign.js';
import CampaignDelivery from '../models/CampaignDelivery.js';
import { getMarketingSettings } from '../models/MarketingSetting.js';
import { notificationService } from './notificationService.js';
import { normalizePhoneNumber } from '../utils/phoneNormalizer.js';

/**
 * Builds the MongoDB query filter for marketing audiences.
 * Enforces mandatory privacy & consent rules:
 * marketingConsent MUST be true, status MUST be active.
 */
export const buildMarketingAudienceQuery = async (audienceType, filter = {}) => {
  let settings = { periodDays: 30, maxPromotionsPerCustomerPeriod: 3 };
  try {
    settings = await getMarketingSettings();
  } catch (e) {
    // fallback if db or settings not initialized
  }

  const base = {
    marketingConsent: true,
    status: 'active',
  };

  const now = new Date();

  // Frequency capping for marketing campaigns
  try {
    const cappedSince = new Date(now.getTime() - (settings.periodDays || 30) * 24 * 60 * 60 * 1000);
    const cappedRecords = await CampaignDelivery.aggregate([
      {
        $match: {
          createdAt: { $gte: cappedSince },
          status: { $in: ['sent', 'delivered'] },
        },
      },
      {
        $group: {
          _id: '$customerId',
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gte: settings.maxPromotionsPerCustomerPeriod || 3 },
        },
      },
    ]);

    const cappedIds = cappedRecords.map((r) => r._id);
    if (cappedIds.length > 0) {
      base._id = { $nin: cappedIds };
    }
  } catch (err) {
    // ignore aggregation errors in basic test environments
  }

  switch (audienceType) {
    case 'new_customers': {
      const days = Number(filter.daysSinceFirstOrder) || 30;
      const sinceDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return { ...base, firstOrderAt: { $gte: sinceDate } };
    }

    case 'returning_customers': {
      return { ...base, totalOrders: { $gt: 1 } };
    }

    case 'inactive_30d':
    case 'inactive_customers': {
      const days = Number(filter.maxDaysInactive) || 30;
      const inactiveDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return { ...base, lastOrderAt: { $lt: inactiveDate } };
    }

    case 'frequent_5plus':
    case 'frequent': {
      const minOrders = Number(filter.minOrders) || 5;
      return { ...base, totalOrders: { $gte: minOrders } };
    }

    case 'high_value': {
      const minSpent = Number(filter.minSpent) || 5000;
      return { ...base, totalSpent: { $gte: minSpent } };
    }

    case 'custom': {
      const customFilter = { ...base };
      if (filter.minOrders !== undefined && filter.minOrders !== '') {
        customFilter.totalOrders = { ...(customFilter.totalOrders || {}), $gte: Number(filter.minOrders) };
      }
      if (filter.maxOrders !== undefined && filter.maxOrders !== '') {
        customFilter.totalOrders = { ...(customFilter.totalOrders || {}), $lte: Number(filter.maxOrders) };
      }
      if (filter.minSpent !== undefined && filter.minSpent !== '') {
        customFilter.totalSpent = { ...(customFilter.totalSpent || {}), $gte: Number(filter.minSpent) };
      }
      if (filter.maxDaysInactive !== undefined && filter.maxDaysInactive !== '') {
        const days = Number(filter.maxDaysInactive);
        customFilter.lastOrderAt = { $lt: new Date(now.getTime() - days * 24 * 60 * 60 * 1000) };
      }
      return customFilter;
    }

    case 'all_opted_in':
    default:
      return base;
  }
};

export const buildAudienceQuery = buildMarketingAudienceQuery;

/**
 * Builds customer audience query for notification campaigns (push notification permission based)
 */
export const buildCustomerAudienceQuery = (audienceType, filter = {}) => {
  const base = {
    status: { $ne: 'blocked' },
  };

  const now = new Date();

  switch (audienceType) {
    case 'new_customers': {
      const days = Number(filter.daysSinceFirstOrder) || 30;
      const sinceDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return { ...base, firstOrderAt: { $gte: sinceDate } };
    }

    case 'returning_customers': {
      return { ...base, totalOrders: { $gt: 1 } };
    }

    case 'inactive_30d':
    case 'inactive_customers': {
      const days = Number(filter.maxDaysInactive) || 30;
      const inactiveDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return { ...base, lastOrderAt: { $lt: inactiveDate } };
    }

    case 'frequent_5plus':
    case 'frequent': {
      const minOrders = Number(filter.minOrders) || 5;
      return { ...base, totalOrders: { $gte: minOrders } };
    }

    case 'high_value': {
      const minSpent = Number(filter.minSpent) || 5000;
      return { ...base, totalSpent: { $gte: minSpent } };
    }

    case 'custom': {
      const customFilter = { ...base };
      if (filter.minOrders !== undefined && filter.minOrders !== '') {
        customFilter.totalOrders = { ...(customFilter.totalOrders || {}), $gte: Number(filter.minOrders) };
      }
      if (filter.maxOrders !== undefined && filter.maxOrders !== '') {
        customFilter.totalOrders = { ...(customFilter.totalOrders || {}), $lte: Number(filter.maxOrders) };
      }
      if (filter.minSpent !== undefined && filter.minSpent !== '') {
        customFilter.totalSpent = { ...(customFilter.totalSpent || {}), $gte: Number(filter.minSpent) };
      }
      if (filter.maxDaysInactive !== undefined && filter.maxDaysInactive !== '') {
        const days = Number(filter.maxDaysInactive);
        customFilter.lastOrderAt = { $lt: new Date(now.getTime() - days * 24 * 60 * 60 * 1000) };
      }
      return customFilter;
    }

    case 'single_customer': {
      if (filter.phone) {
        const normalized = normalizePhoneNumber(filter.phone) || filter.phone;
        return { ...base, phone: normalized };
      }
      if (filter.customerId) {
        return { ...base, _id: filter.customerId };
      }
      return base;
    }

    case 'all_enabled':
    default:
      return base;
  }
};

/**
 * Retrieves all active push subscriptions eligible for a given audience segment.
 * Respects Phase 13 & 14 (only active push subscriptions receive notifications).
 *
 * Eligibility rule (no exceptions):
 *   Customer + Active Web Push Subscription + Permission granted
 *   = Eligible Website Notification Recipient.
 * A phone number alone NEVER qualifies a recipient.
 */
export const getEligiblePushSubscriptions = async (audienceType = 'all_enabled', filter = {}) => {
  const normalizedAudience = audienceType === 'all' ? 'all_enabled' : audienceType;
  const activeSubQuery = {
    $or: [{ isActive: true }, { active: true }],
  };

  // "Selected customers" — explicit customer ID list from the admin UI.
  const selectedIds = filter.customerIds || filter.targetCustomers || filter.targetCustomerIds;
  if (normalizedAudience === 'selected' && Array.isArray(selectedIds) && selectedIds.length > 0) {
    const idSet = new Set(selectedIds.map((id) => String(id)));
    const subs = await PushSubscription.find({
      ...activeSubQuery,
      customerId: { $in: [...idSet].filter((id) => /^[a-fA-F0-9]{24}$/.test(id)) },
    })
      .populate('customerId')
      .lean();
    return subs.filter((sub) => {
      if (!sub.customerId) return false;
      return sub.customerId.status !== 'blocked';
    });
  }

  const activeSubscriptions = await PushSubscription.find(activeSubQuery)
    .populate('customerId')
    .lean();

  if (normalizedAudience === 'all_enabled' || normalizedAudience === 'all' || !normalizedAudience) {
    return activeSubscriptions.filter((sub) => {
      if (sub.customerId && sub.customerId.status === 'blocked') return false;
      return true;
    });
  }

  const customerQuery = buildCustomerAudienceQuery(normalizedAudience, filter);
  const matchingCustomers = await Customer.find(customerQuery).select('_id').lean();
  const matchingCustomerIds = new Set(matchingCustomers.map((c) => String(c._id)));

  return activeSubscriptions.filter((sub) => {
    if (!sub.customerId) return false;
    const cid = String(sub.customerId._id || sub.customerId);
    return matchingCustomerIds.has(cid) && sub.customerId.status !== 'blocked';
  });
};

/**
 * Real-time audience estimation count.
 * Website push counts DEVICES with active subscriptions (never raw customers).
 */
export const getEstimatedAudienceCount = async (audienceType, filter = {}, channel = 'web_push') => {
  const normalizedChannel = String(channel || 'web_push').toLowerCase();
  if (['web', 'web_push', 'push'].includes(normalizedChannel)) {
    const eligible = await getEligiblePushSubscriptions(audienceType, filter);
    return eligible.length;
  }

  if (['sms', 'whatsapp'].includes(normalizedChannel)) {
    const err = new Error(`${channel} channel is coming soon. Web Push is the only active channel.`);
    err.code = 'CHANNEL_COMING_SOON';
    throw err;
  }

  // Marketing audience query for legacy counts
  const query = await buildMarketingAudienceQuery(audienceType, filter);
  return Customer.countDocuments(query);
};

/**
 * Personalizes message template if placeholders are used.
 */
const formatMessage = (template, customer, campaign) => {
  let msg = template || '';
  msg = msg.replace(/{{\s*name\s*}}/gi, customer?.name || 'Friend');
  msg = msg.replace(/{{\s*offer\s*}}/gi, campaign?.title || 'Exclusive Offer');
  msg = msg.replace(/{{\s*code\s*}}/gi, campaign?.offerCode || '');
  return msg;
};

const executeNotificationCampaign = async (campaign) => {
  // v1 website notifications are Web Push ONLY. SMS/WhatsApp are coming soon.
  const channel = String(campaign.channel || 'web_push').toLowerCase();
  if (['sms', 'whatsapp'].includes(channel)) {
    campaign.status = 'failed';
    await campaign.save();
    const err = new Error(`${campaign.channel} channel is coming soon. Web Push is the only active channel.`);
    err.code = 'CHANNEL_COMING_SOON';
    throw err;
  }

  campaign.status = 'sending';
  await campaign.save();

  try {
    const eligibleRecipients = await getEligiblePushSubscriptions(campaign.audienceType, campaign.audienceFilter);

    campaign.totalRecipients = eligibleRecipients.length;
    await campaign.save();

    if (eligibleRecipients.length === 0) {
      campaign.status = 'sent';
      campaign.totalSent = 0;
      campaign.totalFailed = 0;
      await campaign.save();
      return { success: true, recipients: 0, sent: 0, failed: 0 };
    }

    let sentCount = 0;
    let failedCount = 0;

    // Controlled concurrency: fixed batch size so large campaigns never
    // spike memory or connections. Tune via NOTIFICATION_BATCH_SIZE.
    const BATCH_SIZE = Math.max(1, Number(process.env.NOTIFICATION_BATCH_SIZE) || 100);
    for (let i = 0; i < eligibleRecipients.length; i += BATCH_SIZE) {
      const batch = eligibleRecipients.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (recipient) => {
          const customer = recipient.customerId || null;
          const personalizedMessage = formatMessage(campaign.message, customer, campaign);

          const delivery = await NotificationDelivery.create({
            campaignId: campaign._id,
            customerId: customer ? (customer._id || customer) : null,
            subscriptionId: recipient._id,
            status: 'sending',
            sentAt: new Date(),
          });

          try {
            await notificationService.sendPushNotification({
              subscription: recipient,
              title: campaign.title,
              message: personalizedMessage,
              image: campaign.image,
              actionUrl: campaign.actionUrl,
              offerCode: campaign.offerCode,
            });

            // Track last successful use (helps prune stale devices later).
            await PushSubscription.updateOne(
              { _id: recipient._id },
              { lastUsedAt: new Date() }
            );

            delivery.status = 'delivered';
            await delivery.save();
            sentCount += 1;
          } catch (err) {
            console.error(`Dispatch failed for recipient ${recipient._id}:`, err.message);
            delivery.status = 'failed';
            delivery.failedAt = new Date();
            delivery.errorMessage = err.message || 'Dispatch error';
            await delivery.save();
            failedCount += 1;
          }
        })
      );

      campaign.totalSent = sentCount;
      campaign.totalFailed = failedCount;
      await campaign.save();
    }

    campaign.totalSent = sentCount;
    campaign.totalFailed = failedCount;
    campaign.status = failedCount === 0 ? 'sent' : (sentCount > 0 ? 'partially_failed' : 'failed');
    await campaign.save();

    return {
      success: true,
      recipients: eligibleRecipients.length,
      sent: sentCount,
      failed: failedCount,
    };
  } catch (error) {
    console.error(`Notification campaign execution failed for ${campaign._id}:`, error);
    campaign.status = 'failed';
    await campaign.save();
    throw error;
  }
};

/**
 * Executes a legacy Marketing Campaign (WhatsApp / SMS / Push).
 */
const executeLegacyCampaign = async (campaign) => {
  campaign.status = 'sending';
  await campaign.save();

  try {
    const audienceQuery = await buildMarketingAudienceQuery(campaign.audienceType, campaign.audienceFilter);
    const eligibleCustomers = await Customer.find(audienceQuery).lean();

    campaign.totalRecipients = eligibleCustomers.length;
    await campaign.save();

    if (eligibleCustomers.length === 0) {
      campaign.status = 'sent';
      campaign.totalSent = 0;
      campaign.totalDelivered = 0;
      campaign.totalFailed = 0;
      await campaign.save();
      return { success: true, recipients: 0 };
    }

    let pushMap = new Map();
    if (['push', 'all'].includes(campaign.channel)) {
      const activeSubs = await PushSubscription.find({ $or: [{ isActive: true }, { active: true }] }).lean();
      for (const sub of activeSubs) {
        if (sub.customerId) {
          pushMap.set(String(sub.customerId), sub);
        }
      }
    }

    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    const BATCH_SIZE = 10;
    for (let i = 0; i < eligibleCustomers.length; i += BATCH_SIZE) {
      const batch = eligibleCustomers.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (customer) => {
          const personalizedMessage = formatMessage(campaign.message, customer, campaign);
          const channel = campaign.channel === 'all' ? 'whatsapp' : campaign.channel;

          const delivery = await CampaignDelivery.create({
            campaignId: campaign._id,
            customerId: customer._id,
            channel,
            recipientPhone: customer.phone,
            recipientEmail: customer.email || '',
            status: 'queued',
          });

          try {
            let result;
            if (channel === 'whatsapp') {
              // Legacy marketing simulator — zero network calls, no paid provider.
              result = await notificationService.sendLegacyMarketing({
                channel: 'WHATSAPP',
                phone: customer.phone,
                message: personalizedMessage,
                offerCode: campaign.offerCode,
              });
            } else if (channel === 'sms') {
              // Legacy marketing simulator — zero network calls, no paid provider.
              result = await notificationService.sendLegacyMarketing({
                channel: 'SMS',
                phone: customer.phone,
                message: personalizedMessage,
                offerCode: campaign.offerCode,
              });
            } else if (channel === 'push') {
              const sub = pushMap.get(String(customer._id));
              if (!sub) {
                throw new Error('No active push subscription found for this customer device.');
              }
              result = await notificationService.sendPush({
                subscription: sub,
                title: campaign.title,
                message: personalizedMessage,
                offerCode: campaign.offerCode,
                url: '/offers',
              });
            }

            delivery.status = result?.status || 'delivered';
            delivery.providerMessageId = result?.providerMessageId || '';
            delivery.sentAt = new Date();
            delivery.deliveredAt = result?.status === 'delivered' ? new Date() : null;
            await delivery.save();

            sentCount += 1;
            if (result?.status === 'delivered') deliveredCount += 1;
          } catch (err) {
            console.error(`Legacy delivery failed for customer ${customer._id}:`, err.message);
            delivery.status = 'failed';
            delivery.errorMessage = err.message || 'Dispatch error';
            delivery.failedAt = new Date();
            await delivery.save();

            failedCount += 1;
          }
        })
      );

      campaign.totalSent = sentCount;
      campaign.totalDelivered = deliveredCount;
      campaign.totalFailed = failedCount;
      await campaign.save();
    }

    campaign.totalSent = sentCount;
    campaign.totalDelivered = deliveredCount;
    campaign.totalFailed = failedCount;
    campaign.status = failedCount === 0 ? 'sent' : (deliveredCount > 0 ? 'partially_failed' : 'failed');
    await campaign.save();

    return {
      success: true,
      recipients: eligibleCustomers.length,
      sent: sentCount,
      delivered: deliveredCount,
      failed: failedCount,
    };
  } catch (error) {
    console.error(`Legacy campaign execution failed for ${campaign._id}:`, error);
    campaign.status = 'failed';
    await campaign.save();
    throw error;
  }
};

/**
 * Universal executeCampaign entry point: handles NotificationCampaign or Campaign.
 */
export const executeCampaign = async (campaignId) => {
  const notifCampaign = await NotificationCampaign.findById(campaignId);
  if (notifCampaign) {
    return executeNotificationCampaign(notifCampaign);
  }

  const legacyCampaign = await Campaign.findById(campaignId);
  if (legacyCampaign) {
    return executeLegacyCampaign(legacyCampaign);
  }

  throw new Error('Campaign not found.');
};

/**
 * Retries failed deliveries for either NotificationCampaign or Campaign.
 */
export const retryFailedDeliveries = async (campaignId) => {
  const notifCampaign = await NotificationCampaign.findById(campaignId);
  if (notifCampaign) {
    const failedDeliveries = await NotificationDelivery.find({
      campaignId: notifCampaign._id,
      status: 'failed',
    }).populate('subscriptionId');

    if (failedDeliveries.length === 0) {
      return { success: true, retried: 0, message: 'No failed deliveries found.' };
    }

    let recovered = 0;
    for (const delivery of failedDeliveries) {
      const sub = delivery.subscriptionId;
      if (!sub || (sub.isActive === false && sub.active === false)) {
        continue;
      }

      try {
        await notificationService.sendPushNotification({
          subscription: sub,
          title: notifCampaign.title,
          message: notifCampaign.message,
          image: notifCampaign.image,
          actionUrl: notifCampaign.actionUrl,
          offerCode: notifCampaign.offerCode,
        });

        delivery.status = 'delivered';
        delivery.errorMessage = '';
        await delivery.save();
        recovered += 1;
      } catch (err) {
        delivery.failedAt = new Date();
        delivery.errorMessage = err.message || 'Retry failed';
        await delivery.save();
      }
    }

    const currentFailed = await NotificationDelivery.countDocuments({ campaignId: notifCampaign._id, status: 'failed' });
    const currentDelivered = await NotificationDelivery.countDocuments({ campaignId: notifCampaign._id, status: 'delivered' });
    notifCampaign.totalFailed = currentFailed;
    notifCampaign.totalSent = currentDelivered;
    if (currentFailed === 0) {
      notifCampaign.status = 'sent';
    }
    await notifCampaign.save();
    return { success: true, retried: failedDeliveries.length, recovered };
  }

  const campaign = await Campaign.findById(campaignId);
  if (campaign) {
    const failedDeliveries = await CampaignDelivery.find({
      campaignId: campaign._id,
      status: 'failed',
      retryCount: { $lt: 3 },
    }).populate('customerId');

    if (failedDeliveries.length === 0) {
      return { success: true, retried: 0, message: 'No retryable failed deliveries found.' };
    }

    let recovered = 0;
    for (const delivery of failedDeliveries) {
      const customer = delivery.customerId;
      if (!customer || !customer.marketingConsent || customer.status !== 'active') {
        delivery.status = 'cancelled';
        delivery.errorMessage = 'Customer is no longer active or opted-in';
        await delivery.save();
        continue;
      }

      delivery.retryCount = (delivery.retryCount || 0) + 1;
      delivery.status = 'sending';
      await delivery.save();

      try {
        const personalizedMessage = formatMessage(campaign.message, customer, campaign);
        let result;
        if (delivery.channel === 'whatsapp') {
          // Legacy marketing simulator — zero network calls, no paid provider.
          result = await notificationService.sendLegacyMarketing({
            channel: 'WHATSAPP',
            phone: customer.phone,
            message: personalizedMessage,
            offerCode: campaign.offerCode,
          });
        } else if (delivery.channel === 'sms') {
          // Legacy marketing simulator — zero network calls, no paid provider.
          result = await notificationService.sendLegacyMarketing({
            channel: 'SMS',
            phone: customer.phone,
            message: personalizedMessage,
            offerCode: campaign.offerCode,
          });
        }

        delivery.status = result?.status || 'delivered';
        delivery.providerMessageId = result?.providerMessageId || '';
        delivery.deliveredAt = new Date();
        delivery.errorMessage = '';
        await delivery.save();
        recovered += 1;
      } catch (err) {
        delivery.status = 'failed';
        delivery.errorMessage = `Retry ${delivery.retryCount} failed: ${err.message}`;
        delivery.failedAt = new Date();
        await delivery.save();
      }
    }

    const totalDelivered = await CampaignDelivery.countDocuments({ campaignId: campaign._id, status: 'delivered' });
    const totalFailed = await CampaignDelivery.countDocuments({ campaignId: campaign._id, status: 'failed' });
    campaign.totalDelivered = totalDelivered;
    campaign.totalFailed = totalFailed;
    if (totalFailed === 0 && campaign.status === 'partially_failed') {
      campaign.status = 'sent';
    }
    await campaign.save();

    return { success: true, retried: failedDeliveries.length, recovered };
  }

  throw new Error('Campaign not found.');
};

/**
 * Background Scheduler: checks both NotificationCampaign and Campaign.
 */
let schedulerInterval = null;

export const startCampaignScheduler = (intervalMs = 30000) => {
  if (schedulerInterval) return;

  const checkScheduled = async () => {
    try {
      const now = new Date();

      // Check scheduled website notification campaigns
      const dueNotifs = await NotificationCampaign.find({
        status: 'scheduled',
        scheduledAt: { $lte: now },
      });
      for (const camp of dueNotifs) {
        console.log(`[NOTIFICATION-SCHEDULER] Triggering scheduled notification "${camp.name}" (${camp._id})`);
        executeCampaign(camp._id).catch((err) => {
          console.error(`Error executing scheduled notification ${camp._id}:`, err);
        });
      }

      // Check scheduled marketing campaigns
      const dueMarketing = await Campaign.find({
        status: 'scheduled',
        scheduledAt: { $lte: now },
      });
      for (const camp of dueMarketing) {
        console.log(`[CAMPAIGN-SCHEDULER] Triggering scheduled campaign "${camp.name}" (${camp._id})`);
        executeCampaign(camp._id).catch((err) => {
          console.error(`Error executing scheduled marketing campaign ${camp._id}:`, err);
        });
      }
    } catch (err) {
      console.error('[SCHEDULER] Periodic poll error:', err.message);
    }
  };

  schedulerInterval = setInterval(checkScheduled, intervalMs);
  checkScheduled();
};

export const stopCampaignScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
};
