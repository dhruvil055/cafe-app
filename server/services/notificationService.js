import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

// VAPID Configuration
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

/**
 * Abstract Notification Channel Provider (Phase 24)
 * Architecture allows future SMS and WhatsApp channels to plug in seamlessly.
 */
class BaseNotificationProvider {
  async send(payload) {
    throw new Error('send() method not implemented');
  }
}

/**
 * Web Push Provider (Only Active Channel in this Phase)
 */
class WebPushChannelProvider extends BaseNotificationProvider {
  constructor() {
    super();
    configureWebPush();
  }

  async send({ subscription, title, message, image, actionUrl, offerCode }) {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('Valid push subscription with endpoint and keys is required.');
    }

    const payload = JSON.stringify({
      title: title || '☕ Brewhaus Café',
      body: message || 'Special announcement from Brewhaus Café',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
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
      // Phase 26: If endpoint is 404 (Not Found) or 410 (Gone), mark inactive immediately
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

import twilio from 'twilio';

// Twilio Client Configuration
let twilioClient = null;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_WHATSAPP = process.env.TWILIO_WHATSAPP_NUMBER || TWILIO_PHONE;

if (TWILIO_SID && TWILIO_AUTH) {
  try {
    twilioClient = twilio(TWILIO_SID, TWILIO_AUTH);
    console.log('Twilio client initialized for SMS/WhatsApp.');
  } catch (err) {
    console.warn('Twilio initialization failed:', err.message);
  }
}

/**
 * SMS Provider (Twilio)
 */
class SMSChannelProvider extends BaseNotificationProvider {
  async send({ phone, message }) {
    if (!phone) throw new Error('Phone number is required for SMS.');
    if (!message) throw new Error('Message is required for SMS.');

    if (!twilioClient) {
      console.log(`[MOCK SMS] To: ${phone} | Msg: ${message}`);
      return {
        success: true,
        channel: 'SMS',
        provider: 'sms-simulator',
        providerMessageId: `sms_mock_${Date.now()}`,
        status: 'delivered',
        deliveredAt: new Date(),
      };
    }

    try {
      const result = await twilioClient.messages.create({
        body: message,
        from: TWILIO_PHONE,
        to: phone.startsWith('+') ? phone : `+91${phone}`, // default to India code if no +
      });

      return {
        success: true,
        channel: 'SMS',
        provider: 'twilio',
        providerMessageId: result.sid,
        status: result.status === 'failed' ? 'failed' : 'delivered',
        deliveredAt: new Date(),
      };
    } catch (err) {
      console.error('Twilio SMS Error:', err.message);
      throw err;
    }
  }
}

/**
 * WhatsApp Provider (Twilio)
 */
class WhatsAppChannelProvider extends BaseNotificationProvider {
  async send({ phone, message }) {
    if (!phone) throw new Error('Phone number is required for WhatsApp.');
    if (!message) throw new Error('Message is required for WhatsApp.');

    if (!twilioClient) {
      console.log(`[MOCK WHATSAPP] To: ${phone} | Msg: ${message}`);
      return {
        success: true,
        channel: 'WHATSAPP',
        provider: 'whatsapp-simulator',
        providerMessageId: `wa_mock_${Date.now()}`,
        status: 'delivered',
        deliveredAt: new Date(),
      };
    }

    try {
      const targetPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      const result = await twilioClient.messages.create({
        body: message,
        from: `whatsapp:${TWILIO_WHATSAPP}`,
        to: `whatsapp:${targetPhone}`,
      });

      return {
        success: true,
        channel: 'WHATSAPP',
        provider: 'twilio',
        providerMessageId: result.sid,
        status: result.status === 'failed' ? 'failed' : 'delivered',
        deliveredAt: new Date(),
      };
    } catch (err) {
      console.error('Twilio WhatsApp Error:', err.message);
      throw err;
    }
  }
}

/**
 * Notification Service Engine
 */
class NotificationService {
  constructor() {
    this.providers = {
      WEB_PUSH: new WebPushChannelProvider(),
      SMS: new SMSChannelProvider(),
      WHATSAPP: new WhatsAppChannelProvider(),
    };
  }

  getVapidPublicKey() {
    return getVapidKeys().publicKey;
  }

  /**
   * Main dispatch method for Web Push notifications (Phase 17)
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

  // Backward compatibility for legacy CRM marketing module
  async sendSMS({ phone, message, offerCode }) {
    return this.providers.SMS.send({ phone, message, offerCode });
  }

  async sendWhatsApp({ phone, message, templateName, variables, offerCode }) {
    return this.providers.WHATSAPP.send({ phone, message, offerCode });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
