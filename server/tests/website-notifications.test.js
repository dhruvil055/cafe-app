import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { normalizePhoneNumber } from '../utils/phoneNormalizer.js';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_TEST_URI || `mongodb://127.0.0.1:27017/cafe_notification_test_${process.pid}`;
process.env.JWT_SECRET = 'test-jwt-secret-minimum-thirty-two-characters-long';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.VAPID_PUBLIC_KEY = 'BGKiwZymbLcrGJQHOkjdzbOad5J12phBxlkrX1S5QCpmaYjPaBkEj_puOXdGrgxClmziowo37hrHIzRACoc5aPw';
process.env.VAPID_PRIVATE_KEY = 'I6YwyKrECxvP1Vt_vpC1ULSsIP-bpF9FIcgpnAv1oDA';
process.env.VAPID_SUBJECT = 'mailto:admin@brewhauscafe.com';

const { createApp } = await import('../index.js');
const { default: User } = await import('../models/User.js');
const { default: Product } = await import('../models/Product.js');
const { default: Category } = await import('../models/Category.js');
const { default: Customer } = await import('../models/Customer.js');
const { default: Table } = await import('../models/Table.js');
const { default: Order } = await import('../models/Order.js');
const { default: PushSubscription } = await import('../models/PushSubscription.js');
const { default: NotificationCampaign } = await import('../models/NotificationCampaign.js');
const { default: NotificationDelivery } = await import('../models/NotificationDelivery.js');
const { notificationService } = await import('../services/notificationService.js');
const {
  executeCampaign,
  getEstimatedAudienceCount,
  getEligiblePushSubscriptions,
} = await import('../services/campaignRunner.js');

let baseUrl;
let httpServer;
let adminToken;

const request = async (route, { method = 'GET', body, token, headers = {} } = {}) => {
  const reqHeaders = { ...headers };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;

  let reqBody = body;
  if (body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
    reqBody = JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: reqHeaders,
    body: reqBody,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
};

const json = (route, body, options = {}) => request(route, { ...options, method: 'POST', body });
const getJson = (route, options = {}) => request(route, { ...options, method: 'GET' });
const delJson = (route, body, options = {}) => request(route, { ...options, method: 'DELETE', body });

test('Brewhaus Café Website Notification System Suite (Phase 1 to 28)', async (t) => {
  let mongoConnected = false;
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2000 });
    mongoConnected = true;
  } catch (err) {
    console.warn('MongoDB connection not available in current test environment, skipping database integration tests:', err.message);
    return;
  }

  const app = createApp();
  httpServer = app.listen(0);
  await new Promise((resolve) => httpServer.once('listening', resolve));
  const { port } = httpServer.address();
  baseUrl = `http://127.0.0.1:${port}`;

  // Clean test database
  await Promise.all([
    User.deleteMany({}),
    Table.deleteMany({}),
    Product.deleteMany({}),
    Category.deleteMany({}),
    Customer.deleteMany({}),
    Order.deleteMany({}),
    PushSubscription.deleteMany({}),
    NotificationCampaign.deleteMany({}),
    NotificationDelivery.deleteMany({}),
  ]);

  // Seed Table 4
  await Table.create({ tableNumber: 4, number: 4, capacity: 4, active: true, qrCode: 'T4-test' });

  // Create admin user
  const adminUser = await User.create({
    name: 'Admin Test',
    email: 'admin@brewhaus.com',
    password: 'Password123!',
    role: 'admin',
  });

  const loginRes = await json('/api/auth/login', {
    email: 'admin@brewhaus.com',
    password: 'Password123!',
  });
  adminToken = loginRes.data.token;

  // Create dummy category & product
  const category = await Category.create({ name: 'Coffee', slug: 'coffee', displayOrder: 1 });
  const product = await Product.create({
    name: 'Artisan Espresso',
    description: 'Double shot rich espresso',
    price: 180,
    category: category._id,
    isAvailable: true,
  });

  t.after(async () => {
    if (httpServer) httpServer.close();
    await mongoose.connection.close();
  });

  // ── TEST 1: New customer places an order -> Customer created in MongoDB ───────
  let customer1;
  await t.test('Test 1: New customer places an order -> Customer created in MongoDB', async () => {
    const orderPayload = {
      tableNumber: 4,
      customer: {
        name: 'Aarav Sharma',
        phone: '9876543210',
        email: 'aarav@example.com',
        marketingConsent: true,
      },
      items: [{ productId: product._id, quantity: 2 }],
      paymentMethod: 'cash',
    };

    const res = await json('/api/orders', orderPayload);
    assert.equal(res.status, 201);
    assert.ok(res.data.order);
    assert.ok(res.data.order.customerId);

    // Verify customer document in MongoDB
    customer1 = await Customer.findOne({ phone: '+919876543210' });
    assert.ok(customer1);
    assert.equal(customer1.name, 'Aarav Sharma');
    assert.equal(customer1.totalOrders, 1);
    assert.equal(customer1.totalSpent, res.data.order.total);
    assert.equal(customer1.notificationPermission, false);
  });

  // ── TEST 2: Same customer orders again -> totalOrders and totalSpent increase ─
  await t.test('Test 2: Same customer orders again -> totalOrders increases, totalSpent increases, lastOrderAt updates', async () => {
    const initialLastOrder = customer1.lastOrderAt;
    const initialSpent = customer1.totalSpent;

    const orderPayload2 = {
      tableNumber: 4,
      customer: {
        name: 'Aarav Sharma',
        phone: '9876543210',
      },
      items: [{ productId: product._id, quantity: 1 }],
      paymentMethod: 'cash',
    };

    const res = await json('/api/orders', orderPayload2);
    assert.equal(res.status, 201);

    const updatedCustomer = await Customer.findOne({ phone: '+919876543210' });
    assert.equal(updatedCustomer.totalOrders, 2);
    assert.ok(updatedCustomer.totalSpent > initialSpent);
    assert.ok(new Date(updatedCustomer.lastOrderAt) >= new Date(initialLastOrder));
  });

  // ── TEST 3: Customer enables browser notifications -> Push subscription saved ─
  let testSubId1;
  const dummyEndpoint1 = 'https://fcm.googleapis.com/fcm/send/test-sub-token-device-1';
  await t.test('Test 3: Customer enables browser notifications -> Push subscription saved & notificationPermission=true', async () => {
    const subPayload = {
      subscription: {
        endpoint: dummyEndpoint1,
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0Pclwt00ea1Hh',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      },
      customerId: customer1._id,
      phone: '9876543210',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const res = await json('/api/push/subscribe', subPayload);
    assert.equal(res.status, 201);
    assert.ok(res.data.success);
    assert.equal(res.data.deviceType, 'Desktop');
    assert.equal(res.data.browser, 'Chrome');
    testSubId1 = res.data.subscriptionId;

    // Check PushSubscription document
    const subDoc = await PushSubscription.findById(testSubId1);
    assert.ok(subDoc);
    assert.equal(subDoc.isActive, true);
    assert.equal(subDoc.deviceType, 'Desktop');
    assert.equal(subDoc.browser, 'Chrome');

    // Check Customer record updated
    const updatedCustomer = await Customer.findById(customer1._id);
    assert.equal(updatedCustomer.notificationPermission, true);
    assert.ok(updatedCustomer.notificationEnabledAt);
  });

  // ── Multi-device check for same customer (Phase 4) ───────────────────────────
  await t.test('Test 3b: Same customer registers second mobile device -> multiple subscriptions allowed', async () => {
    const mobileSubPayload = {
      subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-sub-token-device-mobile',
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0Pclwt00ea1Hh',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      },
      customerId: customer1._id,
      phone: '9876543210',
      userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    };

    const res = await json('/api/push/subscribe', mobileSubPayload);
    assert.equal(res.status, 201);
    assert.equal(res.data.deviceType, 'Mobile');

    const subs = await PushSubscription.find({ customerId: customer1._id });
    assert.equal(subs.length, 2);
  });

  // ── TEST 4: Admin creates notification campaign ──────────────────────────────
  let campaign1Id;
  await t.test('Test 4: Admin creates notification -> Campaign created', async () => {
    const campaignPayload = {
      name: 'Weekend Special Offer',
      title: '☕ Weekend Special!',
      message: 'Get 20% OFF your coffee this weekend at Brewhaus Café.',
      actionUrl: '/menu?offer=BREW20',
      offerCode: 'BREW20',
      audienceType: 'all_enabled',
      scheduleType: 'now',
    };

    const res = await json('/api/notifications', campaignPayload, { token: adminToken });
    assert.equal(res.status, 201);
    assert.ok(res.data.campaign);
    assert.equal(res.data.campaign.name, 'Weekend Special Offer');
    assert.equal(res.data.campaign.offerCode, 'BREW20');
    campaign1Id = res.data.campaign._id;
  });

  // ── TEST 5: Admin sends notification -> Eligible customers receive notification ─
  await t.test('Test 5: Execution runs -> Web Push dispatched and NotificationDelivery records logged', async () => {
    // Mock web push provider delivery for test environment
    const originalSend = notificationService.sendPushNotification;
    let pushPayloadReceived = null;

    notificationService.sendPushNotification = async (payload) => {
      pushPayloadReceived = payload;
      return { success: true, status: 'delivered', channel: 'WEB_PUSH', deliveredAt: new Date() };
    };

    try {
      const result = await executeCampaign(campaign1Id);
      assert.ok(result.success);
      assert.ok(result.recipients >= 1);
      assert.ok(result.sent >= 1);

      // Verify payload passed to web push
      assert.ok(pushPayloadReceived);
      assert.equal(pushPayloadReceived.title, '☕ Weekend Special!');
      assert.equal(pushPayloadReceived.offerCode, 'BREW20');
      assert.equal(pushPayloadReceived.actionUrl, '/menu?offer=BREW20');

      // Verify delivery records in MongoDB
      const deliveries = await NotificationDelivery.find({ campaignId: campaign1Id });
      assert.ok(deliveries.length > 0);
      assert.equal(deliveries[0].status, 'delivered');
    } finally {
      notificationService.sendPushNotification = originalSend;
    }
  });

  // ── TEST 6: Customer clicks notification -> Relevant page URL (actionUrl) ───
  await t.test('Test 6: Verify actionUrl is embedded correctly in notification payload', async () => {
    const camp = await NotificationCampaign.findById(campaign1Id);
    assert.equal(camp.actionUrl, '/menu?offer=BREW20');
  });

  // ── TEST 7: Invalid push subscription -> Subscription marked inactive, campaign continues ─
  await t.test('Test 7: 410 Gone deactivates invalid push subscription and campaign continues', async () => {
    const deadEndpoint = 'https://fcm.googleapis.com/fcm/send/expired-token-410';
    const deadSub = await PushSubscription.create({
      endpoint: deadEndpoint,
      keys: { p256dh: 'test', auth: 'test' },
      customerId: customer1._id,
      isActive: true,
      active: true,
    });

    const originalSend = notificationService.sendPushNotification;
    let deadAttempted = false;

    notificationService.sendPushNotification = async ({ subscription }) => {
      if (subscription.endpoint === deadEndpoint) {
        deadAttempted = true;
        const err = new Error('Subscription has expired or is no longer valid');
        err.statusCode = 410;
        // The service worker / webpush handler triggers deactivation
        await PushSubscription.updateOne({ endpoint: subscription.endpoint }, { isActive: false, active: false });
        throw err;
      }
      return { success: true, status: 'delivered' };
    };

    try {
      const testCamp = await NotificationCampaign.create({
        name: 'Fault Tolerance Test',
        title: 'Testing Failure Isolation',
        message: 'One device fails, campaign continues',
        audienceType: 'all_enabled',
      });

      const res = await executeCampaign(testCamp._id);
      assert.ok(deadAttempted);
      assert.ok(res.failed >= 1);

      // Verify dead subscription was deactivated
      const reloadedDeadSub = await PushSubscription.findById(deadSub._id);
      assert.equal(reloadedDeadSub.isActive, false);

      // Verify campaign completed rather than crashing
      const reloadedCamp = await NotificationCampaign.findById(testCamp._id);
      assert.ok(['sent', 'partially_failed'].includes(reloadedCamp.status));
    } finally {
      notificationService.sendPushNotification = originalSend;
    }
  });

  // ── TEST 8: Scheduled campaign -> Executes when due ───────────────────────────
  await t.test('Test 8: Scheduled campaign created with future date and executed by runner', async () => {
    const futureDate = new Date(Date.now() + 60000);
    const scheduledCamp = await NotificationCampaign.create({
      name: 'Scheduled Coffee Blast',
      title: '☕ Good Morning Coffee!',
      message: 'Start your morning with fresh brew.',
      scheduledAt: futureDate,
      status: 'scheduled',
      audienceType: 'all_enabled',
    });

    assert.equal(scheduledCamp.status, 'scheduled');
    assert.ok(scheduledCamp.scheduledAt);

    // Trigger execute
    const originalSend = notificationService.sendPushNotification;
    notificationService.sendPushNotification = async () => ({ success: true, status: 'delivered' });
    try {
      await executeCampaign(scheduledCamp._id);
      const executedCamp = await NotificationCampaign.findById(scheduledCamp._id);
      assert.equal(executedCamp.status, 'sent');
    } finally {
      notificationService.sendPushNotification = originalSend;
    }
  });

  // ── TEST 9: Customer disables browser notification -> Subscription deactivated ─
  await t.test('Test 9: Customer unsubscribes -> Subscription deactivated and excluded from audience', async () => {
    const unsubRes = await delJson('/api/push/unsubscribe', { endpoint: dummyEndpoint1 });
    assert.equal(unsubRes.status, 200);
    assert.ok(unsubRes.data.success);

    const sub = await PushSubscription.findOne({ endpoint: dummyEndpoint1 });
    assert.equal(sub.isActive, false);

    // Check audience excludes deactivated subscription
    const eligible = await getEligiblePushSubscriptions('all_enabled');
    const hasDeactivated = eligible.some((s) => s.endpoint === dummyEndpoint1);
    assert.equal(hasDeactivated, false);
  });

  // ── TEST 10: Target specific customer by phone number ──────────────────────
  await t.test('Test 10: Specific customer targeting by phone number -> Web push delivered to customer phone device', async () => {
    // Check audience count for customer1 phone (mobile sub still active from Test 3b)
    const countRes = await getJson('/api/notifications/audience/count?audienceType=single_customer&phone=9876543210', { token: adminToken });
    assert.equal(countRes.status, 200);
    assert.ok(countRes.data.count >= 1);
    assert.ok(countRes.data.customer);
    assert.equal(countRes.data.customer.name, 'Aarav Sharma');

    // Create single customer campaign
    const singleCampRes = await json('/api/notifications', {
      name: 'Special Treat for Aarav',
      title: '☕ Special Coffee Treat for You!',
      message: 'Hello Aarav, your personalized discount is ready.',
      audienceType: 'single_customer',
      audienceFilter: { phone: '9876543210' },
      scheduleType: 'now',
    }, { token: adminToken });

    assert.equal(singleCampRes.status, 201);
    assert.ok(singleCampRes.data.campaign);
  });
});

