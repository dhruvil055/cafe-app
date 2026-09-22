import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

// ── VAPID Configuration ──────────────────────────────────────────────────────
// Private key lives ONLY in environment variables. Frontend receives the
// public key via GET /api/notifications/vapid-public-key (or /api/push/...).
let activeVapidKeys = null;

export const getVapidKeys = () => {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject: process.env.VAPID_SUBJECT || 'mailto:admin@brewhauscafe.com',
    };
  }

  // Fallback in-memory generator if not provided in environment
  if (!activeVapidKeys) {
    activeVapidKeys = webpush.generateVAPIDKeys();
    activeVapidKeys.subject = process.env.VAPID_SUBJECT || 'mailto:admin@brewhauscafe.com';
  }
  return activeVapidKeys;
};

// Initialize webpush details
export const configureWebPush = () => {
  const keys = getVapidKeys();
  try {
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  } catch (err) {
    console.warn('Web push VAPID setup notice:', err.message);
  }
  return keys;
};

// ── Channel metadata (single source of truth for Admin UI) ───────────────────
// Website = Active. SMS / WhatsApp = Coming Soon (no providers, no API calls).
export const CHANNELS = [
  { id: 'web', label: 'Website Notification', active: true },
  { id: 'sms', label: 'SMS', active: false, note: 'Coming Soon' },
  { id: 'whatsapp', label: 'WhatsApp', active: false, note: 'Coming Soon' },
];

/**
 * Abstract Notification Channel Provider.
 * Future channels plug in here without changing the Admin UI,
 * Notification model, history, Customer model, or campaign logic.
 *
 *   NotificationProvider
 *   ├── WebPushProvider   (active)
 *   ├── SmsProvider       (future — coming soon)
 *   └── WhatsAppProvider  (future — coming soon)
 */
class BaseNotificationProvider {
  constructor(id) {
    this.id = id;
  }

  async send() {
    throw new Error('send() method not implemented');
  }
}

/**
 * Web Push Provider — the ONLY active channel in v1.
 * Standards-based: Service Worker + Push API + Notification API + VAPID.
 */
class WebPushChannelProvider extends BaseNotificationProvider {
  constructor() {
    super('web');
    configureWebPush();
  }

  async send({ subscription, title, message, image, actionUrl, offerCode }) {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('Valid push subscription with endpoint and keys is required.');
    }

    const payload = JSON.stringify({
      title: title || 'Brewhaus Café',
      body: message || 'Special announcement from Brewhaus Café',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      image: image || undefined,
      data: {
        url: actionUrl || '/menu',
        actionUrl: actionUrl || '/menu',
        offerCode: offerCode || '',
        sentAt: new Date().toISOString(),
      },
    });

    try {
      const result = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
        },
        payload,
        {
          TTL: 86400, // 24 hours
        }
      );

      return {
        success: true,
        channel: 'WEB_PUSH',
        status: 'delivered',
        statusCode: result.statusCode,
        deliveredAt: new Date(),
      };
    } catch (err) {
      // Expired/unregistered endpoint: mark inactive so we never retry it.
      // Historical delivery records are preserved; customer data is untouched.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.updateOne(
          { endpoint: subscription.endpoint },
          { isActive: false, active: false }
        );
      }
      throw err;
    }
  }
}

/**
 * SMS Provider — FUTURE (coming soon). No SMS API calls are made in v1.
 * When a real provider is added later, implement it here behind this
 * interface; the website notification system rejects 'sms' before it
 * ever reaches a provider.
 */
class SmsFutureProvider extends BaseNotificationProvider {
  constructor() {
    super('sms');
  }

  async send() {
    const err = new Error('SMS channel is coming soon. Web Push is the only active channel.');
    err.code = 'CHANNEL_COMING_SOON';
    throw err;
  }
}

/**
 * WhatsApp Provider — FUTURE (coming soon). No WhatsApp API calls in v1.
 * Reserved for a future official WhatsApp Business API integration.
 * Phone numbers stay separate from Web Push subscriptions.
 */
class WhatsAppFutureProvider extends BaseNotificationProvider {
  constructor() {
    super('whatsapp');
  }

  async send() {
    const err = new Error('WhatsApp channel is coming soon. Web Push is the only active channel.');
    err.code = 'CHANNEL_COMING_SOON';
    throw err;
  }
}

/**
 * Legacy marketing simulator (pre-existing /api/marketing compatibility).
 * Makes NO network/API calls — records a simulated delivery so the legacy
 * marketing module and its tests keep working without any paid provider
 * (no Twilio, no gateway). The NEW website notification system never uses
 * this; it hard-rejects non-web channels at the API layer.
 */
const legacyMarketingSimulator = async ({ channel, phone, message }) => {
  if (!phone) throw new Error('Phone number is required.');
  if (!message) throw new Error('Message is required.');
  console.log(`[LEGACY-MARKETING-SIM] ${channel} → ${phone}`);
  return {
    success: true,
    channel,
    provider: 'legacy-simulator',
    providerMessageId: `${channel.toLowerCase()}_mock_${Date.now()}`,
    status: 'delivered',
    deliveredAt: new Date(),
  };
};

/**
 * Notification Service Engine — modular, channel-agnostic dispatch.
 */
class NotificationService {
  constructor() {
    this.providers = {
      WEB_PUSH: new WebPushChannelProvider(),
      SMS: new SmsFutureProvider(),
      WHATSAPP: new WhatsAppFutureProvider(),
    };
  }

  getVapidPublicKey() {
    return getVapidKeys().publicKey;
  }

  getChannels() {
    return CHANNELS;
  }

  /**
   * Main dispatch method for Web Push notifications.
   */
  async sendPushNotification({ subscription, title, message, image, actionUrl, offerCode }) {
    return this.providers.WEB_PUSH.send({
      subscription,
      title,
      message,
      image,
      actionUrl,
      offerCode,
    });
  }

  // Alias for backward compatibility if any legacy callers exist
  async sendPush(args) {
    return this.sendPushNotification({
      ...args,
      actionUrl: args.url || args.actionUrl,
    });
  }

  // New website notification system: these always throw CHANNEL_COMING_SOON.
  // Use sendPushNotification for all v1 sends.
  async sendSMS() {
    return this.providers.SMS.send();
  }

  async sendWhatsApp() {
    return this.providers.WHATSAPP.send();
  }

  // Legacy /api/marketing path only (simulator — zero network calls).
  async sendLegacyMarketing({ channel, phone, message, offerCode }) {
    void offerCode;
    return legacyMarketingSimulator({ channel, phone, message });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
