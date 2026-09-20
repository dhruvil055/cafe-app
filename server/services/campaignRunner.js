import Customer from '../models/Customer.js';
import Campaign from '../models/Campaign.js';
import CampaignDelivery from '../models/CampaignDelivery.js';
import PushSubscription from '../models/PushSubscription.js';
import { getMarketingSettings } from '../models/MarketingSetting.js';
import { notificationService } from './notificationService.js';

/**
 * Builds the MongoDB query filter for a given audience type and custom criteria.
 * Enforces mandatory privacy & consent rules:
 * marketingConsent MUST be true, status MUST be active.
 */
export const buildAudienceQuery = async (audienceType, filter = {}) => {
  const settings = await getMarketingSettings();

  // Strict baseline compliance
  const base = {
    marketingConsent: true,
    status: 'active',
  };

  const now = new Date();

  // Find customers who reached frequency cap in the configured period
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

  switch (audienceType) {
    case 'new_customers': {
      const days = Number(filter.daysSinceFirstOrder) || 30;
      const sinceDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return { ...base, firstOrderAt: { $gte: sinceDate } };
    }

    case 'returning_customers': {
      return { ...base, totalOrders: { $gt: 1 } };
    }

    case 'inactive_customers': {
      const days = Number(filter.maxDaysInactive) || 30;
      const inactiveDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return { ...base, lastOrderAt: { $lt: inactiveDate } };
    }

    case 'high_value': {
      const minSpent = Number(filter.minSpent) || 5000;
      return { ...base, totalSpent: { $gte: minSpent } };
    }

    case 'frequent': {
      const minOrders = Number(filter.minOrders) || 5;
      return { ...base, totalOrders: { $gte: minOrders } };
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

/**
 * Returns estimated recipient count for an audience configuration
 */
export const getEstimatedAudienceCount = async (audienceType, filter = {}) => {
  const query = await buildAudienceQuery(audienceType, filter);
  const count = await Customer.countDocuments(query);
  return count;
};

/**
 * Replaces message placeholders (e.g. {{name}}, {{offer}}, {{code}})
 */
const formatMessage = (template, customer, campaign) => {
  let msg = template || '';
  msg = msg.replace(/{{\s*name\s*}}/gi, customer.name || 'Friend');
  msg = msg.replace(/{{\s*offer\s*}}/gi, campaign.title || 'Exclusive Offer');
  msg = msg.replace(/{{\s*code\s*}}/gi, campaign.offerCode || '');
  return msg;
};

/**
 * Executes a campaign by ID asynchronously
 */
export const executeCampaign = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found.');

  // Prevent duplicate execution if already completed
  if (campaign.status === 'sent') {
    return { status: campaign.status, message: 'Campaign is already completed.' };
  }

  campaign.status = 'sending';
  await campaign.save();

  try {
    const audienceQuery = await buildAudienceQuery(campaign.audienceType, campaign.audienceFilter);
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

    // Process push subscriptions map if push channel is selected
    let pushMap = new Map();
    if (['push', 'all'].includes(campaign.channel)) {
      const activeSubs = await PushSubscription.find({ active: true }).lean();
      for (const sub of activeSubs) {
        if (sub.customerId) {
          pushMap.set(String(sub.customerId), sub);
        }
      }
    }

    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    // Process in batches of 10
    const BATCH_SIZE = 10;
    for (let i = 0; i < eligibleCustomers.length; i += BATCH_SIZE) {
      const batch = eligibleCustomers.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (customer) => {
          const personalizedMessage = formatMessage(campaign.message, customer, campaign);
          const channel = campaign.channel === 'all' ? 'whatsapp' : campaign.channel;

          // Create delivery record
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
              result = await notificationService.sendWhatsApp({
                phone: customer.phone,
                message: personalizedMessage,
                offerCode: campaign.offerCode,
                variables: { name: customer.name, offer: campaign.title, code: campaign.offerCode },
              });
            } else if (channel === 'sms') {
              result = await notificationService.sendSMS({
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

            delivery.status = result.status || 'delivered';
            delivery.providerMessageId = result.providerMessageId || '';
            delivery.sentAt = new Date();
            delivery.deliveredAt = result.status === 'delivered' ? new Date() : null;
            await delivery.save();

            sentCount += 1;
            if (result.status === 'delivered') deliveredCount += 1;
          } catch (err) {
            console.error(`Delivery failed for customer ${customer._id}:`, err.message);
            delivery.status = 'failed';
            delivery.errorMessage = err.message || 'Dispatch error';
            delivery.failedAt = new Date();
            await delivery.save();

            failedCount += 1;
          }
        })
      );

      // Periodically record progress on campaign
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
    console.error(`Campaign execution crashed for ${campaignId}:`, error);
    campaign.status = 'failed';
    await campaign.save();
    throw error;
  }
};

/**
 * Retries failed deliveries for a campaign
 */
export const retryFailedDeliveries = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found.');

  const failedDeliveries = await CampaignDelivery.find({
    campaignId: campaign._id,
    status: 'failed',
    retryCount: { $lt: 3 }, // Limit max retries
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
        result = await notificationService.sendWhatsApp({
          phone: customer.phone,
          message: personalizedMessage,
          offerCode: campaign.offerCode,
        });
      } else if (delivery.channel === 'sms') {
        result = await notificationService.sendSMS({
          phone: customer.phone,
          message: personalizedMessage,
          offerCode: campaign.offerCode,
        });
      }

      delivery.status = result.status || 'delivered';
      delivery.providerMessageId = result.providerMessageId || '';
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

  // Refresh totals
  const totalDelivered = await CampaignDelivery.countDocuments({ campaignId: campaign._id, status: 'delivered' });
  const totalFailed = await CampaignDelivery.countDocuments({ campaignId: campaign._id, status: 'failed' });
  campaign.totalDelivered = totalDelivered;
  campaign.totalFailed = totalFailed;
  if (totalFailed === 0 && campaign.status === 'partially_failed') {
    campaign.status = 'sent';
  }
  await campaign.save();

  return { success: true, retried: failedDeliveries.length, recovered };
};

/**
 * Background runner that checks for due scheduled campaigns
 */
let schedulerInterval = null;

export const startCampaignScheduler = (intervalMs = 30000) => {
  if (schedulerInterval) return;

  const checkScheduled = async () => {
    try {
      const now = new Date();
      const dueCampaigns = await Campaign.find({
        status: 'scheduled',
        scheduledAt: { $lte: now },
      });

      for (const camp of dueCampaigns) {
        console.log(`[CAMPAIGN-SCHEDULER] Triggering scheduled campaign "${camp.name}" (${camp._id})`);
        executeCampaign(camp._id).catch((err) => {
          console.error(`Error executing scheduled campaign ${camp._id}:`, err);
        });
      }
    } catch (err) {
      console.error('[CAMPAIGN-SCHEDULER] Periodic poll error:', err.message);
    }
  };

  schedulerInterval = setInterval(checkScheduled, intervalMs);
  // Also run initial check
  checkScheduled();
};

export const stopCampaignScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
};
