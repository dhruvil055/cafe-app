import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_TEST_URI || `mongodb://127.0.0.1:27017/cafe_notify_v1_test_${process.pid}`;
process.env.JWT_SECRET = 'test-jwt-secret-minimum-thirty-two-characters-long';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.VAPID_PUBLIC_KEY = 'BGKiwZymbLcrGJQHOkjdzbOad5J12phBxlkrX1S5QCpmaYjPaBkEj_puOXdGrgxClmziowo37hrHIzRACoc5aPw';
process.env.VAPID_PRIVATE_KEY = 'I6YwyKrECxvP1Vt_vpC1ULSsIP-bpF9FIcgpnAv1oDA';
process.env.VAPID_SUBJECT = 'mailto:admin@brewhauscafe.com';

const { createApp } = await import('../index.js');
const { default: User } = await import('../models/User.js');
const { default: Customer } = await import('../models/Customer.js');
const { default: PushSubscription } = await import('../models/PushSubscription.js');
const { default: NotificationCampaign } = await import('../models/NotificationCampaign.js');
const { default: NotificationDelivery } = await import('../models/NotificationDelivery.js');
const { notificationService } = await import('../services/notificationService.js');

let baseUrl;
let httpServer;
let adminToken;

const request = async (route, { method = 'GET', body, token } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let reqBody;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    reqBody = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${route}`, { method, headers, body: reqBody });
  let data;
  try {
    data = JSON.parse(await res.text());
  } catch {
    data = null;
  }
  return { status: res.status, data };
};

const json = (route, body, options = {}) => request(route, { ...options, method: 'POST', body });
const getJson = (route, options = {}) => request(route, { ...options, method: 'GET' });
const delJson = (route, body, options = {}) => request(route, { ...options, method: 'DELETE', body });

const waitForTerminal = async (campaignId, timeoutMs = 8000) => {
  const start = Date.now();
  for (;;) {
    const camp = await NotificationCampaign.findById(campaignId).lean();
    if (camp && !['sending', 'processing'].includes(camp.status)) return camp;
    if (Date.now() - start > timeoutMs) throw new Error(`Campaign ${campaignId} did not finish in time`);
    await new Promise((r) => setTimeout(r, 150));
  }
};

test('Customer website notification system v1 (Web Push only)', async (t) => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2000 });
  } catch (err) {
    console.warn('MongoDB not available, skipping:', err.message);
    return;
  }

  const app = createApp();
  httpServer = app.listen(0);
  await new Promise((resolve) => httpServer.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    PushSubscription.deleteMany({}),
    NotificationCampaign.deleteMany({}),
    NotificationDelivery.deleteMany({}),
  ]);

  await User.create({ name: 'Admin', email: 'admin@brewhaus.com', password: 'Password123!', role: 'admin' });
  const login = await json('/api/auth/login', { email: 'admin@brewhaus.com', password: 'Password123!' });
  adminToken = login.data.token;
  assert.ok(adminToken);

  t.after(async () => {
    if (httpServer) httpServer.close();
    await mongoose.connection.close();
  });

  const subPayload = (endpoint, phone) => ({
    subscription: { endpoint, keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0Pclwt00ea1Hh', auth: 'tBHItJI5svbpez7KI4CCXg' } },
    phone,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
  });

  await t.test('Guest subscription is stored without a customer link', async () => {
    const res = await json('/api/notifications/subscribe', subPayload('https://fcm.googleapis.com/fcm/send/guest-1'));
    assert.equal(res.status, 201);
    assert.ok(res.data.subscriptionId);
    const doc = await PushSubscription.findById(res.data.subscriptionId).lean();
    assert.ok(doc);
    assert.equal(doc.customerId, null);
  });

  await t.test('Duplicate endpoint upserts instead of duplicating', async () => {
    await json('/api/notifications/subscribe', subPayload('https://fcm.googleapis.com/fcm/send/guest-1'));
    const count = await PushSubscription.countDocuments({ endpoint: 'https://fcm.googleapis.com/fcm/send/guest-1' });
    assert.equal(count, 1);
  });

  let customer;
  await t.test('Customer-linked subscription sets permission + preferences', async () => {
    customer = await Customer.create({ name: 'Test User', phone: '+911234567890' });
    const res = await json(
      '/api/notifications/subscribe',
      subPayload('https://fcm.googleapis.com/fcm/send/cust-1', '1234567890')
    );
    assert.equal(res.status, 201);
    const updated = await Customer.findById(customer._id).lean();
    assert.equal(updated.notificationPermission, true);
    assert.equal(updated.notificationPreferences.webPush, true);
  });

  await t.test('Invalid subscription payload is rejected', async () => {
    const res = await json('/api/notifications/subscribe', { subscription: { endpoint: '' } });
    assert.equal(res.status, 400);
  });

  await t.test('Unsubscribe deactivates the endpoint', async () => {
    const res = await delJson('/api/notifications/unsubscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/guest-1' });
    assert.equal(res.status, 200);
    const doc = await PushSubscription.findOne({ endpoint: 'https://fcm.googleapis.com/fcm/send/guest-1' }).lean();
    assert.equal(doc.isActive, false);
  });

  await t.test('Send requires admin authentication', async () => {
    const res = await json('/api/notifications/send', { title: 'Hi', message: 'Hello' });
    assert.equal(res.status, 401);
  });

  await t.test('Send validates title and message', async () => {
    const res = await json('/api/notifications/send', { title: '', message: '' }, { token: adminToken });
    assert.equal(res.status, 400);
  });

  await t.test('SMS and WhatsApp channels are rejected as coming soon', async () => {
    for (const channel of ['sms', 'whatsapp']) {
      const res = await json(
        '/api/notifications/send',
        { title: 'Hi', message: 'Hello', channel },
        { token: adminToken }
      );
      assert.equal(res.status, 400);
      assert.equal(res.data.code, 'CHANNEL_COMING_SOON');
    }
  });

  await t.test('Channels metadata marks only web as active', async () => {
    const res = await getJson('/api/notifications/channels');
    assert.equal(res.status, 200);
    const web = res.data.channels.find((c) => c.id === 'web');
    assert.equal(web.active, true);
    assert.equal(res.data.channels.find((c) => c.id === 'sms').active, false);
    assert.equal(res.data.channels.find((c) => c.id === 'whatsapp').active, false);
  });

  await t.test('Send to all starts a campaign and completes via background dispatch', async () => {
    const original = notificationService.sendPushNotification;
    notificationService.sendPushNotification = async () => ({ success: true, status: 'delivered' });
    try {
      const res = await json(
        '/api/notifications/send',
        { title: 'Weekend Offer', message: 'Fresh brews await!', url: '/offers', audienceType: 'all' },
        { token: adminToken }
      );
      assert.equal(res.status, 202);
      assert.equal(res.data.message, 'Notification campaign started.');
      assert.ok(res.data.campaignId);
      assert.ok(res.data.recipients >= 1);

      const finished = await waitForTerminal(res.data.campaignId);
      assert.equal(finished.status, 'sent');
      assert.ok(finished.totalSent >= 1);
    } finally {
      notificationService.sendPushNotification = original;
    }
  });

  await t.test('Selected audience reaches only picked customers', async () => {
    const other = await Customer.create({ name: 'Other User', phone: '+911234567891' });
    await json('/api/notifications/subscribe', subPayload('https://fcm.googleapis.com/fcm/send/cust-2', '1234567891'));

    const original = notificationService.sendPushNotification;
    const reached = [];
    notificationService.sendPushNotification = async ({ subscription }) => {
      reached.push(subscription.endpoint);
      return { success: true, status: 'delivered' };
    };
    try {
      const res = await json(
        '/api/notifications/send',
        { title: 'Just for you', message: 'Personal treat', audienceType: 'selected', targetCustomers: [String(customer._id)] },
        { token: adminToken }
      );
      assert.equal(res.status, 202);
      assert.equal(res.data.recipients, 1);
      await waitForTerminal(res.data.campaignId);
      assert.deepEqual(reached, ['https://fcm.googleapis.com/fcm/send/cust-1']);
      void other;
    } finally {
      notificationService.sendPushNotification = original;
    }
  });

  await t.test('Stats endpoint returns the spec fields', async () => {
    const res = await getJson('/api/notifications/stats', { token: adminToken });
    assert.equal(res.status, 200);
    for (const field of ['totalNotifications', 'totalCustomers', 'webPushSubscribers', 'notificationsSent', 'successfulDeliveries', 'failedDeliveries', 'activeSubscriptions', 'inactiveSubscriptions']) {
      assert.ok(typeof res.data[field] === 'number', `${field} should be a number`);
    }
    assert.ok(res.data.webPushSubscribers >= 2);
  });

  await t.test('Test mode sends to a single customer device', async () => {
    const original = notificationService.sendPushNotification;
    let calls = 0;
    notificationService.sendPushNotification = async () => {
      calls += 1;
      return { success: true, status: 'delivered' };
    };
    try {
      const res = await json(
        '/api/notifications/test',
        { customerId: String(customer._id), title: 'Ping', message: 'Test body' },
        { token: adminToken }
      );
      assert.equal(res.status, 200);
      assert.equal(res.data.message, 'Test notification sent successfully.');
      assert.equal(calls, 1);
    } finally {
      notificationService.sendPushNotification = original;
    }
  });

  await t.test('Test mode reports unknown devices clearly', async () => {
    const res = await json(
      '/api/notifications/test',
      { phone: '+910000000000', title: 'Ping', message: 'Test' },
      { token: adminToken }
    );
    assert.equal(res.status, 404);
  });
});
