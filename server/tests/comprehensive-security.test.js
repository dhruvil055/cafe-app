import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_TEST_URI || `mongodb://127.0.0.1:27017/cafe_security_integration_${process.pid}`;
process.env.JWT_SECRET = 'integration-test-jwt-secret-with-more-than-32-bytes';
process.env.RAZORPAY_KEY_ID = 'rzp_test_integration';
process.env.RAZORPAY_KEY_SECRET = 'integration-test-razorpay-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'integration-test-webhook-secret';
process.env.TABLE_QR_SECRET = 'integration-test-table-qr-secret-with-32-bytes';
process.env.CLIENT_URL = 'https://client-seven-sigma-26.vercel.app';
process.env.SERVER_URL = 'http://127.0.0.1:0';

const { createApp } = await import('../index.js');
const { default: User } = await import('../models/User.js');
const { default: Category } = await import('../models/Category.js');
const { default: Product } = await import('../models/Product.js');
const { default: Table } = await import('../models/Table.js');
const { default: Order } = await import('../models/Order.js');
const { default: Payment } = await import('../models/Payment.js');
const { createTableQrToken, verifyTableQrToken } = await import('../utils/tableQr.js');
const { default: DiningSession } = await import('../models/DiningSession.js');
const { default: DiningBill } = await import('../models/DiningBill.js');
const { default: Counter } = await import('../models/Counter.js');
const { default: ContactMessage } = await import('../models/ContactMessage.js');
const { default: Coupon } = await import('../models/Coupon.js');
const { default: Customer } = await import('../models/Customer.js');
const { setupTestTenant } = await import('./tenantTestSetup.js');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fakeGateway = {
  createdOrderCount: 0,
  paymentDetails: new Map(),
  fetchDelay: 0,
  orders: {
    create: async ({ amount, currency }) => {
      fakeGateway.createdOrderCount += 1;
      return {
        id: `order_test_${fakeGateway.createdOrderCount}`,
        amount,
        currency,
      };
    },
  },
  payments: {
    fetch: async (paymentId) => {
      if (fakeGateway.fetchDelay) await wait(fakeGateway.fetchDelay);
      const details = fakeGateway.paymentDetails.get(paymentId);
      if (!details) throw new Error('Unknown test payment');
      return details;
    },
  },
};

const signPayment = (orderId, paymentId) => crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(`${orderId}|${paymentId}`)
  .digest('hex');

const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const jpegBytes = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AX//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AX//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8Qf//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8Qf//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8Qf//Z',
  'base64',
);
const webpBytes = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=',
  'base64',
);
// The fixture's VP8 chunk is 24 bytes; correct the RIFF container length.
webpBytes.writeUInt32LE(webpBytes.length - 8, 4);

let httpServer;
let baseUrl;
const uploadedFiles = [];

const request = async (route, { method = 'GET', body, token, headers = {}, origin } = {}) => {
  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (origin) requestHeaders.Origin = origin;

  let requestBody = body;
  if (['/api/orders', '/api/session'].includes(route) && body && typeof body === 'object' && !Object.prototype.hasOwnProperty.call(body, 'tableToken')) {
    const table = await Table.findOne({ tableNumber: Number(body.tableNumber) });
    if (table) requestBody = { ...body, tableToken: createTableQrToken(table._id) };
  }
  if (route === '/api/orders' && requestBody && typeof requestBody === 'object' && !Object.prototype.hasOwnProperty.call(requestBody, 'idempotencyKey')) {
    requestBody = { ...requestBody, idempotencyKey: crypto.randomUUID() };
  }
  if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(requestBody);
  }

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: requestHeaders,
    body: requestBody,
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { response, status: response.status, data };
};

const json = (route, body, options = {}) => request(route, { ...options, method: 'POST', body });
const putJson = (route, body, options = {}) => request(route, { ...options, method: 'PUT', body });
const webhook = (payload, eventId = 'evt_test_capture') => {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
  return request('/api/payment/webhook', { method: 'POST', body, headers: {
    'Content-Type': 'application/json',
    'x-razorpay-signature': signature,
    'x-razorpay-event-id': eventId,
  } });
};

const login = async (email, password) => {
  const result = await json('/api/auth/login', { email, password });
  assert.equal(result.status, 200);
  return result.data.token;
};

const createPublicOrder = async ({ productId, tableNumber = 1, name, paymentMethod = 'cash' }) => {
  const session = await json('/api/session', { tableNumber });
  assert.equal(session.status, 201, JSON.stringify(session.data));
  const result = await json('/api/orders', {
    tableNumber,
    customer: { name, phone: '9876543210' },
    items: [{ productId: String(productId), quantity: 1 }],
    paymentMethod,
    diningSessionToken: session.data.diningSessionToken,
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return { ...result.data, diningSessionToken: session.data.diningSessionToken };
};

const upload = async (token, bytes, filename, mime) => {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type: mime }), filename);
  return request('/api/upload/image', { method: 'POST', body: form, token });
};

test('real security integration suite', async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  await setupTestTenant();
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Table.deleteMany({}),
    Order.deleteMany({}),
    Payment.deleteMany({}),
    DiningSession.deleteMany({}),
    DiningBill.deleteMany({}),
    Counter.deleteMany({}),
    ContactMessage.deleteMany({}),
  ]);

  const category = await Category.create({ name: 'Integration Category' });
  let product = await Product.create({
    name: 'Integration Product',
    price: 299,
    category: category._id,
  });
  await Table.create({ tableNumber: 1, seats: 4, active: true });
  await Table.create({ tableNumber: 9, seats: 4, active: false });

  await User.create({ name: 'Integration Admin', email: 'admin.integration@example.com', password: 'AdminPassword123', role: 'admin' });
  await User.create({ name: 'Integration Staff', email: 'staff.integration@example.com', password: 'StaffPassword123', role: 'staff' });
  await User.create({ name: 'Integration Customer', email: 'customer.integration@example.com', password: 'CustomerPassword123', role: 'customer' });

  const app = createApp({ razorpayFactory: () => fakeGateway });
  httpServer = await new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

  const adminToken = await login('admin.integration@example.com', 'AdminPassword123');
  const staffToken = await login('staff.integration@example.com', 'StaffPassword123');
  const customerToken = await login('customer.integration@example.com', 'CustomerPassword123');

  try {
    await t.test('authorization protects admin/staff endpoints', async () => {
      assert.equal((await request('/api/orders/list/all')).status, 401);
      assert.equal((await request('/api/orders/list/all', { token: customerToken })).status, 403);
      assert.equal((await request(`/api/menu/${product._id}`, { method: 'DELETE', token: staffToken })).status, 200);
      product = await Product.create({ name: 'Integration Product', price: 299, category: category._id });
      assert.equal((await request('/api/orders/list/all', { token: adminToken })).status, 200);
      const allowedCors = await request('/api/health', { origin: process.env.CLIENT_URL });
      assert.equal(allowedCors.status, 200);
      assert.equal(allowedCors.response.headers.get('x-content-type-options'), 'nosniff');
      assert.notEqual((await request('/api/health', { origin: 'https://attacker.example' })).status, 200);
      const environment = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const subdomainBypass = await request('/api/health', { origin: 'https://attacker.infinigrowsoftech.com' });
      process.env.NODE_ENV = environment;
      assert.equal(subdomainBypass.status, 403);
      assert.equal((await json('/api/menu', { name: 'Nope', price: 1, category: category._id }, { token: customerToken })).status, 403);
      assert.equal((await json('/api/categories', { name: 'Nope' }, { token: customerToken })).status, 403);
      assert.equal((await json('/api/tables', { tableNumber: 3 }, { token: customerToken })).status, 403);
      assert.equal((await upload(staffToken, pngBytes, 'staff.png', 'image/png')).status, 200);
    });

    await t.test('contact messages are validated, persisted, and protected from duplicates', async () => {
      const invalid = await json('/api/contact', { name: '', contact: 'not-valid', message: 'Hi' });
      assert.equal(invalid.status, 400);

      const payload = {
        name: 'Contact Customer',
        contact: 'customer@example.com',
        subject: 'Catering enquiry',
        message: 'Could you please share your catering options?',
      };
      const submitted = await json('/api/contact', payload);
      assert.equal(submitted.status, 201, JSON.stringify(submitted.data));
      const duplicate = await json('/api/contact', payload);
      assert.equal(duplicate.status, 409);

      const stored = await ContactMessage.findOne({ contact: payload.contact }).lean();
      assert.equal(stored.name, payload.name);
      assert.equal(stored.subject, payload.subject);
      assert.equal(stored.status, 'new');
      assert.ok(stored.createdAt);
    });

    await t.test('server-side pricing ignores malicious client totals', async () => {
      const session = await json('/api/session', { tableNumber: 1 });
      const result = await json('/api/orders', {
        tableNumber: 1,
        customer: { name: 'Price Test', phone: '9876543210' },
        items: [{ productId: String(product._id), quantity: 1, price: 1, itemTotal: 1 }],
        subtotal: 1,
        tax: 0,
        total: 1,
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        paymentMethod: 'cash',
        diningSessionToken: session.data.diningSessionToken,
      });
      assert.equal(result.status, 201);
      assert.equal(result.data.order.subtotal, 299);
      assert.equal(result.data.order.items[0].price, 299);
      assert.equal(result.data.order.items[0].itemTotal, 299);
      assert.equal(result.data.order.paymentMethod, 'cash');
      assert.equal(result.data.order.orderStatus, 'pending');
      assert.equal(result.data.order.paymentStatus, 'pending');
      assert.equal(result.data.order.accessTokenHash, undefined);
    });

    await t.test('signed table QR tokens reject tampering, expiry, and table substitution', async () => {
      const activeTable = await Table.findOne({ tableNumber: 1 });
      const token = createTableQrToken(activeTable._id);
      assert.equal((await request(`/api/tables/qr/validate?token=${encodeURIComponent(token)}`)).data.valid, true);
      assert.equal((await request(`/api/tables/qr/validate?token=${encodeURIComponent(`${token.slice(0, -1)}x`)}`)).status, 400);
      const expired = createTableQrToken(activeTable._id, Date.now() - (3 * 365 * 24 * 60 * 60 * 1000));
      assert.equal(verifyTableQrToken(expired), null);
      const mismatch = await json('/api/orders', {
        tableNumber: 9,
        tableToken: token,
        customer: { name: 'QR Table Test', phone: '9876543210' },
        items: [{ productId: String(product._id), quantity: 1 }],
        paymentMethod: 'cash',
      });
      assert.equal(mismatch.status, 400);
    });

    await t.test('order access tokens enforce privacy for order and receipt', async () => {
      const orderA = await createPublicOrder({ productId: product._id, name: 'Customer A' });
      const orderB = await createPublicOrder({ productId: product._id, name: 'Customer B' });
      const aPath = `/api/orders/${orderA.order._id}?accessToken=${encodeURIComponent(orderA.accessToken)}`;
      const bPath = `/api/orders/${orderB.order._id}?accessToken=${encodeURIComponent(orderB.accessToken)}`;

      assert.equal((await request(aPath)).status, 200);
      assert.equal((await request(`/api/orders/${orderA.order._id}`)).status, 401);
      assert.equal((await request(`/api/orders/${orderA.order._id}?accessToken=invalid`)).status, 403);
      assert.equal((await request(`/api/orders/${orderB.order._id}?accessToken=${encodeURIComponent(orderA.accessToken)}`)).status, 403);
      assert.equal((await request(`/api/orders/${orderA.order._id}?accessToken=${encodeURIComponent(orderB.accessToken)}`)).status, 403);
      assert.equal((await request(`/api/orders/${orderA.order._id}/receipt?accessToken=${encodeURIComponent(orderB.accessToken)}`)).status, 403);
      assert.equal((await request(`/api/orders/${orderB.order._id}/receipt?accessToken=${encodeURIComponent(orderA.accessToken)}`)).status, 403);
      const ownReceipt = await request(`/api/orders/${orderA.order._id}/receipt?accessToken=${encodeURIComponent(orderA.accessToken)}`);
      assert.equal(ownReceipt.status, 200);
      assert.match(ownReceipt.response.headers.get('content-type'), /application\/pdf/);
      assert.equal((await request(bPath)).status, 200);
    });

    await t.test('payment creation requires the correct order token', async () => {
      const paymentOrder = await createPublicOrder({ productId: product._id, name: 'Payment Customer', paymentMethod: 'razorpay' });
      const orderId = paymentOrder.order._id;
      assert.equal((await json('/api/payment/create-order', { orderId })).status, 401);
      assert.equal((await json('/api/payment/create-order', { orderId, accessToken: 'invalid' })).status, 403);
      const other = await createPublicOrder({ productId: product._id, name: 'Other Customer', paymentMethod: 'cash' });
      assert.equal((await json('/api/payment/create-order', { orderId, accessToken: other.accessToken })).status, 403);

      const created = await json('/api/payment/create-order', { orderId, accessToken: paymentOrder.accessToken, diningSessionToken: paymentOrder.diningSessionToken });
      assert.equal(created.status, 200);
      assert.equal(created.data.currency, 'INR');
      assert.equal(created.data.amount, 299 * 105); // ₹299 + 5% GST
      return { paymentOrder, razorpayOrderId: created.data.razorpayOrderId };
    });

    const paymentOrder = await createPublicOrder({ productId: product._id, name: 'Verification Customer', paymentMethod: 'razorpay' });
    const paymentOrderId = paymentOrder.order._id;
    const paymentCreate = await json('/api/payment/create-order', { orderId: paymentOrderId, accessToken: paymentOrder.accessToken, diningSessionToken: paymentOrder.diningSessionToken });
    assert.equal(paymentCreate.status, 200);
    const razorpayOrderId = paymentCreate.data.razorpayOrderId;
    const expectedAmount = paymentCreate.data.amount;

    await t.test('browser payment callbacks cannot complete payment; webhook validates signature, amount, and currency', async () => {
      const validSignature = signPayment(razorpayOrderId, 'pay_auth_test');
      const callbackData = { orderId: paymentOrderId, accessToken: paymentOrder.accessToken, razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_auth_test', razorpay_signature: validSignature };
      assert.equal((await json('/api/payment/verify', { ...callbackData, accessToken: undefined })).status, 401);
      assert.equal((await json('/api/payment/verify', { ...callbackData, accessToken: 'wrong' })).status, 403);
      assert.equal((await json('/api/payment/verify', callbackData)).status, 202);
      assert.notEqual((await Order.findById(paymentOrderId)).paymentStatus, 'paid');

      const event = (amount, currency = 'INR') => ({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_webhook', order_id: razorpayOrderId, amount, currency, status: 'captured' } } } });
      const invalidSignatureBody = JSON.stringify(event(expectedAmount));
      const invalidSignature = await request('/api/payment/webhook', { method: 'POST', body: invalidSignatureBody, headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'invalid' } });
      assert.equal(invalidSignature.status, 400);
      assert.equal((await webhook(event(expectedAmount + 1))).status, 400);
      assert.equal((await webhook(event(expectedAmount, 'USD'))).status, 400);
    });

    await t.test('verified webhook completes payment idempotently under duplicate delivery', async () => {
      const successfulEvent = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_successful', order_id: razorpayOrderId, amount: expectedAmount, currency: 'INR', status: 'captured' } } } };
      const first = await webhook(successfulEvent);
      const duplicate = await webhook(successfulEvent);
      assert.equal(first.status, 200);
      assert.equal(duplicate.status, 200);
      assert.equal(duplicate.data.duplicate, true);
      assert.equal((await Payment.findOne({ orderId: paymentOrderId })).status, 'captured');

      const raceOrder = await createPublicOrder({ productId: product._id, name: 'Race Customer', paymentMethod: 'razorpay' });
      const raceCreate = await json('/api/payment/create-order', { orderId: raceOrder.order._id, accessToken: raceOrder.accessToken, diningSessionToken: raceOrder.diningSessionToken });
      const raceEvent = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_race', order_id: raceCreate.data.razorpayOrderId, amount: raceCreate.data.amount, currency: 'INR', status: 'captured' } } } };
      const raceResults = await Promise.all([
        webhook(raceEvent, 'evt_race_1'),
        webhook(raceEvent, 'evt_race_2'),
      ]);
      assert.deepEqual(raceResults.map((result) => result.status).sort(), [200, 200]);
      const storedRaceOrder = await Order.findById(raceOrder.order._id);
      assert.equal(storedRaceOrder.paymentStatus, 'paid');
      assert.equal(storedRaceOrder.orderStatus, 'confirmed');
      assert.equal(storedRaceOrder.razorpayPaymentId, 'pay_race');
      assert.equal(storedRaceOrder.paymentVerifiedAt instanceof Date, true);
    });

    await t.test('cash settlement is constrained and mass assignment is blocked', async () => {
      const cashOrder = await createPublicOrder({ productId: product._id, name: 'Cash Customer' });
      const attack = await putJson(`/api/orders/${cashOrder.order._id}/status`, { orderStatus: 'confirmed', paymentStatus: 'paid', role: 'admin' }, { token: adminToken });
      assert.equal(attack.status, 400);
      const before = await Order.findById(cashOrder.order._id);
      assert.equal(before.paymentStatus, 'pending');
      const verified = await putJson(`/api/orders/${cashOrder.order._id}/cash-confirmation`, { decision: 'confirm' }, { token: adminToken });
      assert.equal(verified.status, 200);
      assert.equal(verified.data.order.paymentStatus, 'pending');
      const paid = await putJson(`/api/orders/${cashOrder.order._id}/cash-payment`, { paymentStatus: 'paid' }, { token: adminToken });
      assert.equal(paid.status, 200);
      assert.equal(paid.data.order.paymentStatus, 'paid');
      const duplicate = await putJson(`/api/orders/${cashOrder.order._id}/cash-payment`, { paymentStatus: 'paid' }, { token: adminToken });
      assert.equal(duplicate.status, 200);

      const productAttack = await json('/api/menu', { name: 'Mass Assignment', price: 100, category: category._id, rating: 0, role: 'admin', ownerId: 'attacker', verified: true }, { token: staffToken });
      assert.equal(productAttack.status, 201);
      assert.equal(productAttack.data.product.rating, 4.5);
      assert.equal(productAttack.data.product.role, undefined);
      assert.equal(productAttack.data.product.ownerId, undefined);

      const categoryAttack = await json('/api/categories', { name: 'Mass Category', role: 'admin', ownerId: 'attacker' }, { token: staffToken });
      assert.equal(categoryAttack.status, 201);
      assert.equal(categoryAttack.data.category.role, undefined);
      const tableAttack = await json('/api/tables', { tableNumber: 12, active: false, role: 'admin', ownerId: 'attacker' }, { token: staffToken });
      assert.equal(tableAttack.status, 201);
      assert.equal(tableAttack.data.table.active, true);
    });

    await t.test('table validation and trusted QR URL enforcement', async () => {
      assert.equal((await request('/api/tables/1/validate')).status, 200);
      assert.equal((await request('/api/tables/9/validate')).status, 404);
      assert.equal((await request('/api/tables/999/validate')).status, 404);
      assert.equal((await request('/api/tables/not-a-number/validate')).status, 400);
      const qr = await json('/api/tables', { tableNumber: 13, baseUrl: 'https://attacker.example/phishing' }, { token: adminToken });
      assert.equal(qr.status, 201);
      assert.match(qr.data.table.qrUrl, /^(https:\/\/client-[a-z0-9-]+\.vercel\.app|https:\/\/cafe\.infinigrowsoftech\.com)\/menu\?tableToken=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      assert.doesNotMatch(qr.data.table.qrUrl, /attacker\.example/);
      assert.equal((await request(`/api/tables/qr/validate?token=${encodeURIComponent(new URL(qr.data.table.qrUrl).searchParams.get('tableToken'))}`)).data.valid, true);
    });

    await t.test('regex, length, object-id, and request-size validation are real', async () => {
      const injection = await request(`/api/menu?search=${encodeURIComponent('{"$ne":null}')}`);
      assert.equal(injection.status, 200);
      assert.deepEqual(injection.data.products, []);
      assert.equal((await request(`/api/menu?search=${'x'.repeat(101)}`)).status, 400);
      assert.equal((await request('/api/menu/not-an-object-id')).status, 400);
      const session = await json('/api/session', { tableNumber: 1 });
      const diningSessionToken = session.data.diningSessionToken;
      assert.equal((await json('/api/orders', { tableNumber: 1, tableToken: '', customer: { name: 'Unsigned QR', phone: '9876543210' }, items: [{ productId: String(product._id), quantity: 1 }], paymentMethod: 'cash' })).status, 400);
      const tableOne = await Table.findOne({ tableNumber: 1 });
      assert.equal((await json('/api/orders', { tableNumber: 1, tableToken: createTableQrToken(tableOne._id), customer: { name: 'No idempotency', phone: '9876543210' }, items: [{ productId: String(product._id), quantity: 1 }], paymentMethod: 'cash', idempotencyKey: '' })).status, 400);
      assert.equal((await json('/api/orders', { tableNumber: 1, customer: { name: 'Bad Quantity', phone: '9876543210' }, items: [{ productId: String(product._id), quantity: 1000 }], paymentMethod: 'cash', diningSessionToken })).status, 400);
      assert.equal((await json('/api/orders', { tableNumber: 1, customer: { name: 'Bad Product', phone: '9876543210' }, items: [{ productId: 'not-an-object-id', quantity: 1 }], paymentMethod: 'cash', diningSessionToken })).status, 400);
      const oversizedOrder = await json('/api/orders', { tableNumber: 1, customer: { name: 'Large Notes', phone: '9876543210' }, items: [{ productId: String(product._id), quantity: 1 }], paymentMethod: 'cash', diningSessionToken, notes: 'x'.repeat(110 * 1024) });
      assert.equal(oversizedOrder.status, 413);
    });

    await t.test('uploads require admin and validate MIME, extension, and content', async () => {
      const jpeg = await upload(adminToken, jpegBytes, 'valid.jpg', 'image/jpeg');
      const png = await upload(adminToken, pngBytes, 'valid.png', 'image/png');
      const webp = await upload(adminToken, webpBytes, 'valid.webp', 'image/webp');
      for (const result of [jpeg, png, webp]) {
        assert.equal(result.status, 200, JSON.stringify(result.data));
        uploadedFiles.push(result.data.filename);
      }
      assert.equal((await upload(adminToken, Buffer.alloc(5 * 1024 * 1024 + 1, 1), 'large.png', 'image/png')).status, 413);
      assert.equal((await upload(adminToken, jpegBytes, 'fake.png', 'image/png')).status, 400);
      assert.equal((await upload(adminToken, Buffer.from('not an image'), 'invalid.png', 'image/png')).status, 400);
      assert.equal((await upload(adminToken, Buffer.from('MZ executable'), 'malware.exe', 'application/x-msdownload')).status, 400);
      assert.equal((await upload(adminToken, jpegBytes, 'dangerous.php', 'image/jpeg')).status, 400);
    });

    await t.test('order numbers use an atomic counter and a unique index', async () => {
      const results = await Promise.all(Array.from({ length: 8 }, (_, i) => createPublicOrder({ productId: product._id, name: `Concurrent ${i}` })));
      const numbers = results.map((result) => result.order.orderNumber);
      assert.equal(new Set(numbers).size, numbers.length);
      assert.ok(numbers.every((number) => /^CAF\d+$/.test(number)));
      await Order.createIndexes();
      const indexes = await Order.collection.indexes();
      assert.ok(indexes.some((index) => index.unique && index.key.orderNumber === 1));
      assert.equal(await Counter.exists({ _id: 'orderNumber' }).then(Boolean), true);
    });

    await t.test('order numbers are unique per tenant under high concurrency', async () => {
      // This test runs in the default tenant context
      const results = await Promise.all(Array.from({ length: 50 }, (_, i) => createPublicOrder({ productId: product._id, name: `Concurrent ${i}` })));
      const numbers = results.map((result) => result.order.orderNumber);
      assert.equal(new Set(numbers).size, numbers.length, 'All order numbers must be unique');
      // Verify sequential allocation (no gaps from failed attempts)
      const nums = numbers.map(n => parseInt(n.slice(3), 10)).sort((a, b) => a - b);
      for (let i = 1; i < nums.length; i++) {
        assert.equal(nums[i] - nums[i-1], 1, `Order numbers must be sequential: gap at ${nums[i-1]} -> ${nums[i]}`);
      }
    });

    await t.test('unsafe request keys are rejected and 50 concurrent orders are paginated', async (t) => {
      const unsafe = await json('/api/contact', { name: 'Test', contact: 'test@example.com', message: 'hello', $where: 'return true' });
      assert.equal(unsafe.status, 400);
      assert.equal(unsafe.data.code, 'INVALID_REQUEST');

      const startedAt = Date.now();
      const results = await Promise.all(Array.from({ length: 50 }, (_, index) => json('/api/orders', {
        tableNumber: 1,
        customer: { name: `Load order ${index}`, phone: `98${String(index).padStart(8, '0')}` },
        items: [{ productId: String(product._id), quantity: 1 }],
        paymentMethod: 'cash',
        idempotencyKey: `phase4-load-${crypto.randomUUID()}`,
      })));
      const durationMs = Date.now() - startedAt;
      assert.ok(results.every((result) => result.status === 201), `50 concurrent order requests completed in ${durationMs}ms; ${results.filter((result) => result.status === 201).length} succeeded`);
      t.diagnostic(`50 concurrent order requests completed in ${durationMs}ms.`);

      const firstPage = await request('/api/orders?date=all&page=1&limit=1', { token: adminToken });
      assert.equal(firstPage.status, 200);
      assert.equal(firstPage.data.pagination.limit, 1);
      assert.ok(firstPage.data.pagination.total >= 50);
      const capped = await request('/api/orders?date=all&page=1&limit=999', { token: adminToken });
      assert.equal(capped.data.pagination.limit, 100);
    });

    await t.test('coupon redemption, paid-order loyalty, ratings, and sales/GST exports work together', async () => {
      const createdCoupon = await json('/api/coupons', {
        code: 'GROW10', description: 'Ten percent off', discountType: 'percent', value: 10, maximumDiscount: 50, maxUses: 2,
      }, { token: adminToken });
      assert.equal(createdCoupon.status, 201, JSON.stringify(createdCoupon.data));
      const cart = [{ productId: String(product._id), quantity: 1 }];
      const validation = await json('/api/coupons/validate', { code: 'grow10', items: cart });
      assert.equal(validation.status, 200);
      assert.equal(validation.data.discount, 29.9);

      const created = await json('/api/orders', {
        tableNumber: 1,
        customer: { name: 'Growth Customer', phone: '9812345678' },
        items: cart,
        paymentMethod: 'cash',
        couponCode: 'GROW10',
        idempotencyKey: `phase5-coupon-${crypto.randomUUID()}`,
      });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      assert.equal(created.data.order.discount, 29.9);
      assert.equal(created.data.order.couponCode, 'GROW10');
      assert.equal(created.data.order.total, validation.data.total);

      const beforePaidRating = await json(`/api/orders/${created.data.order._id}/rating`, { accessToken: created.data.accessToken, score: 5 });
      assert.equal(beforePaidRating.status, 409);
      const settled = await putJson(`/api/orders/${created.data.order._id}/cash-payment`, { paymentStatus: 'paid' }, { token: adminToken });
      assert.equal(settled.status, 200, JSON.stringify(settled.data));
      assert.equal((await Customer.findOne({ phone: '+919812345678' })).loyaltyPoints, 2);

      await putJson(`/api/orders/${created.data.order._id}/status`, { orderStatus: 'preparing' }, { token: adminToken });
      await putJson(`/api/orders/${created.data.order._id}/status`, { orderStatus: 'ready' }, { token: adminToken });
      const served = await putJson(`/api/orders/${created.data.order._id}/status`, { orderStatus: 'completed' }, { token: adminToken });
      assert.equal(served.status, 200);
      const rated = await json(`/api/orders/${created.data.order._id}/rating`, { accessToken: created.data.accessToken, score: 5, comment: 'Excellent coffee.' });
      assert.equal(rated.status, 201);
      assert.equal((await json(`/api/orders/${created.data.order._id}/rating`, { accessToken: created.data.accessToken, score: 4 })).status, 409);

      const sales = await request('/api/analytics/exports/sales.csv', { token: adminToken });
      assert.equal(sales.status, 200);
      assert.match(sales.data.toString(), /GROW10/);
      const gst = await request('/api/analytics/reports/gst', { token: adminToken });
      assert.equal(gst.status, 200);
      assert.ok(gst.data.totals.orders >= 1);
      assert.ok(gst.data.orders.some((entry) => entry.orderNumber === created.data.order.orderNumber));
      assert.equal((await Coupon.findOne({ code: 'GROW10' })).usageCount, 1);
    });

    await t.test('API rate limiting returns 429 after the configured threshold', async () => {
      const results = await Promise.all(Array.from({ length: 220 }, () => request('/api/health')));
      assert.ok(results.some((result) => result.status === 429));
    });
  } finally {
    for (const filename of uploadedFiles) {
      await fs.rm(path.join(process.cwd(), 'uploads', filename), { force: true });
    }
    await new Promise((resolve) => httpServer.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
