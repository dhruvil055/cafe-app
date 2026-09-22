import express from 'express';
import PushSubscription from '../models/PushSubscription.js';
import Customer from '../models/Customer.js';
import { parseUserAgent } from '../utils/deviceParser.js';
import { notificationService } from '../services/notificationService.js';
import { normalizePhoneNumber } from '../utils/phoneNormalizer.js';

const router = express.Router();

/**
 * Public VAPID Public Key Endpoint
 * GET /api/push/vapid-public-key
 */
router.get('/vapid-public-key', (req, res) => {
  try {
    const publicKey = notificationService.getVapidPublicKey();
    res.json({ publicKey });
  } catch (err) {
    console.error('VAPID public key retrieval error:', err);
    res.status(500).json({ error: 'Failed to retrieve VAPID public key.' });
  }
});

/**
 * Subscribe Browser to Push Notifications (Phase 4 & 16)
 * POST /api/push/subscribe
 */
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, customerId, phone, deviceInfo } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object. Endpoint and keys are required.' });
    }

    const rawUa = req.body.userAgent || req.get('user-agent') || '';
    const { deviceType, browser } = parseUserAgent(rawUa);

    // Resolve customer ID from either direct customerId or phone number
    let resolvedCustomerId = customerId || null;
    if (!resolvedCustomerId && phone) {
      const normalizedPhone = normalizePhoneNumber(phone);
      if (normalizedPhone) {
        const found = await Customer.findOne({ phone: normalizedPhone });
        if (found) resolvedCustomerId = found._id;
      }
    }

    // Upsert push subscription (same endpoint updates rather than duplicates)
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
        deviceInfo: String(deviceInfo || `${browser} on ${deviceType}`).slice(0, 200),
        isActive: true,
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Update customer notificationPermission
    if (resolvedCustomerId) {
      await Customer.findByIdAndUpdate(resolvedCustomerId, {
        notificationPermission: true,
        notificationEnabledAt: new Date(),
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
    console.error('Push subscription error:', err);
    res.status(500).json({ error: 'Failed to register push subscription.' });
  }
});

/**
 * Unsubscribe Browser from Push Notifications
 * DELETE /api/push/unsubscribe
 */
router.delete('/unsubscribe', async (req, res) => {
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
      // If customer has no other active subscriptions, set notificationPermission to false
      const remainingActive = await PushSubscription.countDocuments({
        customerId: sub.customerId,
        $or: [{ isActive: true }, { active: true }],
      });
      if (remainingActive === 0) {
        await Customer.findByIdAndUpdate(sub.customerId, {
          notificationPermission: false,
        });
      }
    }

    res.json({ success: true, message: 'Web push subscription deactivated successfully.' });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to deactivate push subscription.' });
  }
});

/**
 * Check Browser Push Status
 * GET /api/push/status
 */
router.get('/status', async (req, res) => {
  try {
    const { endpoint, customerId } = req.query;

    if (endpoint) {
      const sub = await PushSubscription.findOne({ endpoint });
      return res.json({
        subscribed: !!(sub && (sub.isActive || sub.active)),
        deviceType: sub?.deviceType || null,
        browser: sub?.browser || null,
      });
    }

    if (customerId) {
      const activeCount = await PushSubscription.countDocuments({
        customerId,
        $or: [{ isActive: true }, { active: true }],
      });
      return res.json({
        subscribed: activeCount > 0,
        activeDevicesCount: activeCount,
      });
    }

    return res.status(400).json({ error: 'Endpoint or customerId is required.' });
  } catch (err) {
    console.error('Push status error:', err);
    res.status(500).json({ error: 'Failed to retrieve push status.' });
  }
});

export default router;
