import express from 'express';
import PushSubscription from '../models/PushSubscription.js';
import { notificationService } from '../services/notificationService.js';

const router = express.Router();

/**
 * Public VAPID Key Endpoint
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
 * Subscribe Browser to Push Notifications
 * POST /api/notifications/subscribe
 */
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, customerId, deviceInfo } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object.' });
    }

    const sub = await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        customerId: customerId || null,
        deviceInfo: String(deviceInfo || req.get('user-agent') || '').slice(0, 200),
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, message: 'Web push subscription saved.', id: sub._id });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to register push subscription.' });
  }
});

/**
 * Unsubscribe Browser from Push Notifications
 * DELETE /api/notifications/unsubscribe
 */
router.delete('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Push endpoint is required.' });
    }

    await PushSubscription.updateOne({ endpoint }, { active: false });
    res.json({ success: true, message: 'Web push notifications unsubscribed.' });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to remove push subscription.' });
  }
});

export default router;
