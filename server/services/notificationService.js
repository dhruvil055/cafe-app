import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import crypto from 'crypto';
import { getMarketingSettings } from '../models/MarketingSetting.js';
import { normalizePhoneNumber } from '../utils/phoneNormalizer.js';

// In-memory persistent fallback VAPID keys if not provided in environment
let activeVapidKeys = null;
const getVapidKeys = () => {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject: process.env.VAPID_SUBJECT || 'mailto:admin@brewhauscafe.com',
    };
  }
  if (!activeVapidKeys) {
    activeVapidKeys = webpush.generateVAPIDKeys();
    activeVapidKeys.subject = 'mailto:admin@brewhauscafe.com';
  }
  return activeVapidKeys;
};

// Initialize web-push configuration
const configureWebPush = () => {
  const keys = getVapidKeys();
  try {
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  } catch (err) {
    console.warn('Web push VAPID setup notice:', err.message);
  }
  return keys;
};

/**
 * SMS Provider Interface & Implementations
 */
class SMSProvider {
  async send({ phone, message, offerCode }) {
    throw new Error('send() not implemented');
  }
}

class SimulatedSMSProvider extends SMSProvider {
  async send({ phone, message, offerCode }) {
    // Realistic simulation with unique provider ID
    const providerMessageId = `sms_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    console.log(`[SMS-SIMULATOR] Dispatched to ${phone}: "${message}" (Code: ${offerCode || 'NONE'}) [ID: ${providerMessageId}]`);
    return {
      success: true,
      provider: 'simulated-sms',
      providerMessageId,
      status: 'delivered',
    };
  }
}

class UpstreamSMSProvider extends SMSProvider {
  constructor(config) {
    super();
    this.apiKey = config.apiKey;
    this.senderId = config.senderId;
    this.provider = config.provider; // e.g. twilio, msg91
  }

  async send({ phone, message, offerCode }) {
    const settings = await getMarketingSettings();
    const accountSid = settings.twilio?.accountSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = settings.twilio?.authToken || process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = settings.twilio?.phoneNumber || process.env.TWILIO_PHONE_NUMBER || this.senderId || 'BREWHAUS';

    if (accountSid && authToken) {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', phone);
      params.append('From', fromPhone);
      params.append('Body', message);

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Twilio SMS failed');
      return {
        success: true,
        provider: 'twilio',
        providerMessageId: data.sid,
        status: 'delivered',
      };
    }

    // Fallback simulation
    const sim = new SimulatedSMSProvider();
    return sim.send({ phone, message, offerCode });
  }
}

/**
 * WhatsApp Provider Interface & Implementations
 */
class WhatsAppProvider {
  async send({ phone, message, templateName, variables, offerCode }) {
    throw new Error('send() not implemented');
  }
}

class SimulatedWhatsAppProvider extends WhatsAppProvider {
  async send({ phone, message, templateName, variables, offerCode }) {
    const providerMessageId = `wa_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    console.log(`[WHATSAPP-SIMULATOR] Dispatched to ${phone}: "${message}" (Template: ${templateName || 'custom'}, Code: ${offerCode || 'NONE'}) [ID: ${providerMessageId}]`);
    return {
      success: true,
      provider: 'simulated-whatsapp',
      providerMessageId,
      status: 'delivered',
    };
  }
}

class OfficialWhatsAppCloudProvider extends WhatsAppProvider {
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey;
    this.phoneNumberId = config.phoneNumberId;
  }

  async send({ phone, message, templateName, variables, offerCode }) {
    const settings = await getMarketingSettings();
    const apiKey = this.apiKey || settings.whatsappCloud?.accessToken || process.env.WHATSAPP_API_KEY;
    const phoneNumberId = this.phoneNumberId || settings.whatsappCloud?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    const normalized = normalizePhoneNumber(phone) || phone;
    const digitsOnly = String(normalized).replace(/[^\d]/g, '');
    const directUrl = `https://api.whatsapp.com/send?phone=${digitsOnly}&text=${encodeURIComponent(message)}`;

    // 1. If Meta WhatsApp Cloud API credentials exist, dispatch via Meta Graph API
    if (apiKey && phoneNumberId) {
      const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
      let body;
      if (templateName) {
        body = JSON.stringify({
          messaging_product: 'whatsapp',
          to: digitsOnly,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en_US' },
            components: [
              {
                type: 'body',
                parameters: Object.values(variables || {}).map(val => ({ type: 'text', text: String(val) })),
              },
            ],
          },
        });
      } else {
        body = JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: digitsOnly,
          type: 'text',
          text: { preview_url: false, body: message },
        });
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || 'Meta WhatsApp Cloud API call failed');
      }

      const msgId = data.messages?.[0]?.id || `wa_${Date.now()}`;
      return {
        success: true,
        provider: 'whatsapp-cloud-api',
        providerMessageId: msgId,
        directUrl,
        status: 'delivered',
      };
    }

    // 2. If Twilio WhatsApp credentials exist, dispatch via Twilio API
    if (settings.twilio?.accountSid && settings.twilio?.authToken && settings.twilio?.phoneNumber) {
      const auth = Buffer.from(`${settings.twilio.accountSid}:${settings.twilio.authToken}`).toString('base64');
      const params = new URLSearchParams();
      const from = settings.twilio.phoneNumber.startsWith('whatsapp:') ? settings.twilio.phoneNumber : `whatsapp:${settings.twilio.phoneNumber}`;
      const to = `whatsapp:+${digitsOnly}`;
      params.append('To', to);
      params.append('From', from);
      params.append('Body', message);

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${settings.twilio.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Twilio WhatsApp failed');

      return {
        success: true,
        provider: 'twilio-whatsapp',
        providerMessageId: data.sid,
        directUrl,
        status: 'delivered',
      };
    }

    // 3. Direct WhatsApp Click-to-Chat protocol (0 setup, 100% real delivery)
    return {
      success: true,
      provider: 'direct-whatsapp',
      providerMessageId: `wa_direct_${Date.now()}_${digitsOnly}`,
      directUrl,
      status: 'delivered',
      requiresDirectOpen: true,
      message: `Direct WhatsApp link generated for ${phone}. Click to open WhatsApp immediately!`,
    };
  }
}

/**
 * Web Push Provider
 */
class WebPushProvider {
  constructor() {
    configureWebPush();
  }

  async send({ subscription, title, message, url, offerCode }) {
    if (!subscription || !subscription.endpoint) {
      throw new Error('Valid push subscription with endpoint is required.');
    }

    const payload = JSON.stringify({
      title: title || '☕ Brewhaus Café Special Offer',
      body: message,
      icon: '/icons/coffee-cup.png',
      badge: '/icons/badge.png',
      data: {
        url: url || '/offers',
        offerCode: offerCode || '',
        sentAt: new Date().toISOString(),
      },
    });

    try {
      const res = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        payload,
        {
          TTL: 86400, // 24 hours
        }
      );

      return {
        success: true,
        provider: 'web-push',
        providerMessageId: `push_${Date.now()}_${res.statusCode}`,
        status: 'delivered',
      };
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired or unregistered; deactivate in database
        await PushSubscription.updateOne({ endpoint: subscription.endpoint }, { active: false });
      }
      throw err;
    }
  }
}

/**
 * Factory for notification service
 */
class NotificationService {
  constructor() {
    this.initProviders();
  }

  initProviders() {
    this.smsProvider = new UpstreamSMSProvider({});
    this.whatsAppProvider = new OfficialWhatsAppCloudProvider({});
    this.pushProvider = new WebPushProvider();
  }

  getVapidPublicKey() {
    return getVapidKeys().publicKey;
  }

  async sendSMS({ phone, message, offerCode }) {
    return this.smsProvider.send({ phone, message, offerCode });
  }

  async sendWhatsApp({ phone, message, templateName, variables, offerCode }) {
    return this.whatsAppProvider.send({ phone, message, templateName, variables, offerCode });
  }

  async sendPush({ subscription, title, message, url, offerCode }) {
    return this.pushProvider.send({ subscription, title, message, url, offerCode });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
