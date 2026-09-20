import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phoneNormalizer.js';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_TEST_URI || `mongodb://127.0.0.1:27017/cafe_crm_test_${process.pid}`;
process.env.JWT_SECRET = 'test-jwt-secret-minimum-thirty-two-characters-long';
process.env.CLIENT_URL = 'http://localhost:5173';

const { createApp } = await import('../index.js');
const { default: User } = await import('../models/User.js');
const { default: Table } = await import('../models/Table.js');
const { default: Product } = await import('../models/Product.js');
const { default: Category } = await import('../models/Category.js');
const { default: Customer } = await import('../models/Customer.js');
const { default: Campaign } = await import('../models/Campaign.js');
const { default: CampaignDelivery } = await import('../models/CampaignDelivery.js');
const { default: Order } = await import('../models/Order.js');

let baseUrl;
let httpServer;

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
const putJson = (route, body, options = {}) => request(route, { ...options, method: 'PUT', body });

test('CRM & Marketing System Suite', async (t) => {
  // ── 1. Phone Normalizer Unit Tests ──────────────────────────────────────────
  await t.test('phoneNormalizer handles various formats and invalid inputs', () => {
    assert.equal(normalizePhoneNumber('9876543210'), '+919876543210');
    assert.equal(normalizePhoneNumber('09876543210'), '+919876543210');
    assert.equal(normalizePhoneNumber('919876543210'), '+919876543210');
    assert.equal(normalizePhoneNumber('+91 98765 43210'), '+919876543210');
    assert.equal(normalizePhoneNumber('+91-98765-43210'), '+919876543210');
    assert.equal(normalizePhoneNumber('+91 (987) 654-3210'), '+919876543210');
    assert.equal(normalizePhoneNumber('+14155552671'), '+14155552671');

    assert.equal(normalizePhoneNumber('123'), null);
    assert.equal(normalizePhoneNumber('invalid'), null);
    assert.equal(normalizePhoneNumber(''), null);
    assert.equal(normalizePhoneNumber(null), null);

    assert.equal(isValidPhoneNumber('9876543210'), true);
    assert.equal(isValidPhoneNumber('not-a-phone'), false);
  });

  // ── Database & Server Setup ────────────────────────────────────────────────
  let mongoConnected = false;
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2000 });
    mongoConnected = true;
  } catch (err) {
    console.warn('MongoDB connection not available in current test environment, skipping database-bound tests:', err.message);
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
    Campaign.deleteMany({}),
    CampaignDelivery.deleteMany({}),
    Order.deleteMany({}),
  ]);

  // Seed Admin & Table & Product
  const admin = await User.create({
    name: 'Admin Test',
    email: 'admin.crm@brewhaus.com',
    password: 'AdminPassword123',
    role: 'admin',
  });

  const adminLoginRes = await json('/api/auth/login', {
    email: 'admin.crm@brewhaus.com',
    password: 'AdminPassword123',
  });
  assert.equal(adminLoginRes.status, 200);
  const adminToken = adminLoginRes.data.token;

  await Table.create({ tableNumber: 1, active: true, capacity: 4 });
  const cat = await Category.create({ name: 'Coffee', icon: '☕' });
  const product = await Product.create({
    name: 'Signature Cappuccino',
    category: cat._id,
    price: 200,
    available: true,
  });

  // ── 2. Order -> Customer Creation & Normalization Flow ───────────────────────
  await t.test('Order placement creates customer and normalizes phone number', async () => {
    const res = await json('/api/orders', {
      tableNumber: 1,
      customer: {
        name: 'Aarav Sharma',
        phone: '9876543210',
        email: 'aarav@example.com',
        marketingConsent: true,
      },
      items: [{ productId: String(product._id), quantity: 2 }],
      paymentMethod: 'cash',
    });

    assert.equal(res.status, 201, JSON.stringify(res.data));
    assert.ok(res.data.order);
    assert.ok(res.data.order.customerId);
    assert.equal(res.data.order.customer.phone, '+919876543210');
    assert.equal(res.data.order.customer.marketingConsent, true);

    // Verify Customer document in database
    const cust = await Customer.findById(res.data.order.customerId);
    assert.ok(cust);
    assert.equal(cust.name, 'Aarav Sharma');
    assert.equal(cust.phone, '+919876543210');
    assert.equal(cust.email, 'aarav@example.com');
    assert.equal(cust.marketingConsent, true);
    assert.ok(cust.marketingConsentAt);
    assert.equal(cust.totalOrders, 1);
    assert.equal(cust.totalSpent, res.data.order.total);
    assert.equal(cust.status, 'active');
  });

  // ── 3. Subsequent Orders Update Stats without Duplication ───────────────────
  await t.test('Subsequent order by same customer with different phone format updates existing customer', async () => {
    const res2 = await json('/api/orders', {
      tableNumber: 1,
      customer: {
        name: 'Aarav Sharma',
        phone: '+91 98765 43210', // Different formatting
      },
      items: [{ productId: String(product._id), quantity: 1 }],
      paymentMethod: 'cash',
    });

    assert.equal(res2.status, 201);
    const order2 = res2.data.order;

    // Verify only ONE customer document exists for +919876543210
    const count = await Customer.countDocuments({ phone: '+919876543210' });
    assert.equal(count, 1);

    const cust = await Customer.findOne({ phone: '+919876543210' });
    assert.equal(cust.totalOrders, 2);
    // Consent should be preserved as true even if second order did not check the box
    assert.equal(cust.marketingConsent, true);
  });

  // ── 4. Marketing Consent Preservation (Never Silently True) ──────────────────
  await t.test('Customer who does not opt in remains marketingConsent: false', async () => {
    const res = await json('/api/orders', {
      tableNumber: 1,
      customer: {
        name: 'Priya Patel',
        phone: '9123456789',
        marketingConsent: false,
      },
      items: [{ productId: String(product._id), quantity: 1 }],
      paymentMethod: 'cash',
    });

    assert.equal(res.status, 201);
    const cust = await Customer.findOne({ phone: '+919123456789' });
    assert.ok(cust);
    assert.equal(cust.marketingConsent, false);
    assert.equal(cust.marketingConsentAt, null);
  });

  // ── 5. Customer CRM APIs ────────────────────────────────────────────────────
  await t.test('Admin Customer CRM endpoints: list, stats, profile, update, unsubscribe', async () => {
    // Stats
    const statsRes = await getJson('/api/customers/stats', { token: adminToken });
    assert.equal(statsRes.status, 200);
    assert.equal(statsRes.data.stats.totalCustomers, 2);
    assert.equal(statsRes.data.stats.marketingOptedIn, 1);
    assert.equal(statsRes.data.stats.marketingOptedOut, 1);

    // List with search
    const listRes = await getJson('/api/customers?search=Aarav', { token: adminToken });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.customers.length, 1);
    assert.equal(listRes.data.customers[0].name, 'Aarav Sharma');

    // Customer Profile
    const cust = listRes.data.customers[0];
    const profileRes = await getJson(`/api/customers/${cust._id}`, { token: adminToken });
    assert.equal(profileRes.status, 200);
    assert.ok(profileRes.data.customer);
    assert.ok(profileRes.data.orders.length >= 2);
    assert.ok(profileRes.data.metrics.averageOrderValue > 0);

    // Admin Unsubscribe
    const unsubRes = await json(`/api/customers/${cust._id}/unsubscribe`, {}, { token: adminToken });
    assert.equal(unsubRes.status, 200);
    assert.equal(unsubRes.data.customer.marketingConsent, false);
    assert.equal(unsubRes.data.customer.status, 'unsubscribed');

    // Admin Re-Subscribe
    const subRes = await json(`/api/customers/${cust._id}/subscribe`, {}, { token: adminToken });
    assert.equal(subRes.status, 200);
    assert.equal(subRes.data.customer.marketingConsent, true);
    assert.equal(subRes.data.customer.status, 'active');

    // Public Unsubscribe
    const pubUnsub = await json('/api/customers/public-unsubscribe', { phone: '9876543210' });
    assert.equal(pubUnsub.status, 200);
    const updatedCust = await Customer.findById(cust._id);
    assert.equal(updatedCust.marketingConsent, false);
    assert.equal(updatedCust.status, 'unsubscribed');
  });

  // ── 6. Marketing Campaign & Segmentation ────────────────────────────────────
  await t.test('Campaign creation, audience filtering, and dispatch', async () => {
    // Re-opt-in Priya for testing campaign dispatch
    await Customer.updateOne({ phone: '+919123456789' }, { marketingConsent: true, status: 'active' });

    // Check estimated audience count (Aarav is unsubscribed, Priya is opted-in -> exactly 1)
    const countRes = await getJson('/api/marketing/audience/count?audienceType=all_opted_in', { token: adminToken });
    assert.equal(countRes.status, 200);
    assert.equal(countRes.data.count, 1);

    // Create & dispatch campaign
    const campRes = await json('/api/marketing/campaigns', {
      name: 'Weekend Coffee Treat',
      title: '☕ Weekend Special at Brewhaus!',
      message: 'Hello {{name}}! Enjoy 20% off with code {{code}}.',
      channel: 'whatsapp',
      audienceType: 'all_opted_in',
      offerCode: 'BREW20',
      sendImmediately: true,
    }, { token: adminToken });

    assert.equal(campRes.status, 201);
    const campaignId = campRes.data.campaign._id;

    // Allow async execution
    await new Promise((resolve) => setTimeout(resolve, 300));

    const reportRes = await getJson(`/api/marketing/campaigns/${campaignId}`, { token: adminToken });
    assert.equal(reportRes.status, 200);
    assert.equal(reportRes.data.campaign.totalRecipients, 1);
    assert.equal(reportRes.data.campaign.totalDelivered, 1);
    assert.equal(reportRes.data.campaign.status, 'sent');
    assert.equal(reportRes.data.deliveries.length, 1);
    assert.equal(reportRes.data.deliveries[0].recipientPhone, '+919123456789');
    assert.equal(reportRes.data.deliveries[0].status, 'delivered');
  });

  // Cleanup
  httpServer.close();
  await mongoose.disconnect();
});
