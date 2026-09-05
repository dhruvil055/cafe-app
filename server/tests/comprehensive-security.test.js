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
process.env.CLIENT_URL = 'https://client-seven-sigma-26.vercel.app';
process.env.SERVER_URL = 'http://127.0.0.1:0';

const { createApp } = await import('../index.js');
const { default: User } = await import('../models/User.js');
const { default: Category } = await import('../models/Category.js');
const { default: Product } = await import('../models/Product.js');
const { default: Table } = await import('../models/Table.js');
const { default: Order } = await import('../models/Order.js');
const { default: Counter } = await import('../models/Counter.js');

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
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
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

const login = async (email, password) => {
  const result = await json('/api/auth/login', { email, password });
  assert.equal(result.status, 200);
  return result.data.token;
};

const createPublicOrder = async ({ productId, tableNumber = 1, name, paymentMethod = 'cash' }) => {
  const result = await json('/api/orders', {
    tableNumber,
    customer: { name, phone: '9876543210' },
    items: [{ productId: String(productId), quantity: 1 }],
    paymentMethod,
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data;
};

const upload = async (token, bytes, filename, mime) => {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type: mime }), filename);
  return request('/api/upload/image', { method: 'POST', body: form, token });
};

test('real security integration suite', async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Table.deleteMany({}),
    Order.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  const category = await Category.create({ name: 'Integration Category' });
  const product = await Product.create({
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
      assert.equal((await request(`/api/menu/${product._id}`, { method: 'DELETE', token: staffToken })).status, 403);
      assert.equal((await request('/api/orders/list/all', { token: adminToken })).status, 200);
      const allowedCors = await request('/api/health', { origin: process.env.CLIENT_URL });
      assert.equal(allowedCors.status, 200);
      assert.equal(allowedCors.response.headers.get('x-content-type-options'), 'nosniff');
      assert.notEqual((await request('/api/health', { origin: 'https://attacker.example' })).status, 200);
      assert.equal((await json('/api/menu', { name: 'Nope', price: 1, category: category._id }, { token: customerToken })).status, 403);
      assert.equal((await json('/api/categories', { name: 'Nope' }, { token: customerToken })).status, 403);
      assert.equal((await json('/api/tables', { tableNumber: 3 }, { token: customerToken })).status, 403);
      assert.equal((await upload(staffToken, pngBytes, 'staff.png', 'image/png')).status, 403);
    });

    await t.test('server-side pricing ignores malicious client totals', async () => {
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

      const created = await json('/api/payment/create-order', { orderId, accessToken: paymentOrder.accessToken });
      assert.equal(created.status, 200);
      assert.equal(created.data.currency, 'INR');
      assert.equal(created.data.amount, 299 * 105); // ₹299 + 5% GST
      return { paymentOrder, razorpayOrderId: created.data.razorpayOrderId };
    });

    const paymentOrder = await createPublicOrder({ productId: product._id, name: 'Verification Customer', paymentMethod: 'razorpay' });
    const paymentOrderId = paymentOrder.order._id;
    const paymentCreate = await json('/api/payment/create-order', { orderId: paymentOrderId, accessToken: paymentOrder.accessToken });
    assert.equal(paymentCreate.status, 200);
    const razorpayOrderId = paymentCreate.data.razorpayOrderId;
    const expectedAmount = paymentCreate.data.amount;

    await t.test('payment verification rejects unauthorized or invalid payment data', async () => {
      const validSignature = signPayment(razorpayOrderId, 'pay_auth_test');
      assert.equal((await json('/api/payment/verify', { orderId: paymentOrderId, razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_auth_test', razorpay_signature: validSignature })).status, 401);
      assert.equal((await json('/api/payment/verify', { orderId: paymentOrderId, accessToken: 'wrong', razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_auth_test', razorpay_signature: validSignature })).status, 403);
      const wrongCustomer = await createPublicOrder({ productId: product._id, name: 'Wrong Payment Customer', paymentMethod: 'cash' });
      assert.equal((await json('/api/payment/verify', { orderId: paymentOrderId, accessToken: wrongCustomer.accessToken, razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_auth_test', razorpay_signature: validSignature })).status, 403);
      assert.equal((await json('/api/payment/verify', { orderId: paymentOrderId, accessToken: paymentOrder.accessToken, razorpay_order_id: 'wrong_order', razorpay_payment_id: 'pay_auth_test', razorpay_signature: validSignature })).status, 400);

      const missingLocal = await createPublicOrder({ productId: product._id, name: 'Uninitialized Payment', paymentMethod: 'razorpay' });
      const missingSig = signPayment('order_missing_local', 'pay_missing_local');
      assert.equal((await json('/api/payment/verify', { orderId: missingLocal.order._id, accessToken: missingLocal.accessToken, razorpay_order_id: 'order_missing_local', razorpay_payment_id: 'pay_missing_local', razorpay_signature: missingSig })).status, 400);

      fakeGateway.paymentDetails.set('pay_wrong_signature', { order_id: razorpayOrderId, amount: expectedAmount, currency: 'INR', status: 'captured' });
      assert.equal((await json('/api/payment/verify', { orderId: paymentOrderId, accessToken: paymentOrder.accessToken, razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_wrong_signature', razorpay_signature: 'not-a-valid-signature' })).status, 400);

      fakeGateway.paymentDetails.set('pay_wrong_amount', { order_id: razorpayOrderId, amount: expectedAmount + 1, currency: 'INR', status: 'captured' });
      assert.equal((await json('/api/payment/verify', { orderId: paymentOrderId, accessToken: paymentOrder.accessToken, razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_wrong_amount', razorpay_signature: signPayment(razorpayOrderId, 'pay_wrong_amount') })).status, 400);

      fakeGateway.paymentDetails.set('pay_wrong_currency', { order_id: razorpayOrderId, amount: expectedAmount, currency: 'USD', status: 'captured' });
      assert.equal((await json('/api/payment/verify', { orderId: paymentOrderId, accessToken: paymentOrder.accessToken, razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_wrong_currency', razorpay_signature: signPayment(razorpayOrderId, 'pay_wrong_currency') })).status, 400);

      fakeGateway.paymentDetails.set('pay_not_captured', { order_id: razorpayOrderId, amount: expectedAmount, currency: 'INR', status: 'authorized' });
      assert.equal((await json('/api/payment/verify', { orderId: paymentOrderId, accessToken: paymentOrder.accessToken, razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_not_captured', razorpay_signature: signPayment(razorpayOrderId, 'pay_not_captured') })).status, 400);
    });

    await t.test('payment verification is idempotent and atomic under a race', async () => {
      const paymentId = 'pay_successful';
      fakeGateway.paymentDetails.set(paymentId, { order_id: razorpayOrderId, amount: expectedAmount, currency: 'INR', status: 'captured' });
      const verification = {
        orderId: paymentOrderId,
        accessToken: paymentOrder.accessToken,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signPayment(razorpayOrderId, paymentId),
      };
      const first = await json('/api/payment/verify', verification);
      const duplicate = await json('/api/payment/verify', verification);
      assert.equal(first.status, 200);
      assert.equal(duplicate.status, 200);
      assert.equal(duplicate.data.success, true);

      const raceOrder = await createPublicOrder({ productId: product._id, name: 'Race Customer', paymentMethod: 'razorpay' });
      const raceCreate = await json('/api/payment/create-order', { orderId: raceOrder.order._id, accessToken: raceOrder.accessToken });
      const racePaymentId = 'pay_race';
      fakeGateway.paymentDetails.set(racePaymentId, { order_id: raceCreate.data.razorpayOrderId, amount: raceCreate.data.amount, currency: 'INR', status: 'captured' });
      fakeGateway.fetchDelay = 25;
      const racePayload = {
        orderId: raceOrder.order._id,
        accessToken: raceOrder.accessToken,
        razorpay_order_id: raceCreate.data.razorpayOrderId,
        razorpay_payment_id: racePaymentId,
        razorpay_signature: signPayment(raceCreate.data.razorpayOrderId, racePaymentId),
      };
      const raceResults = await Promise.all([
        json('/api/payment/verify', racePayload),
        json('/api/payment/verify', racePayload),
      ]);
      fakeGateway.fetchDelay = 0;
      assert.deepEqual(raceResults.map((result) => result.status).sort(), [200, 200]);
      const storedRaceOrder = await Order.findById(raceOrder.order._id);
      assert.equal(storedRaceOrder.paymentStatus, 'paid');
      assert.equal(storedRaceOrder.orderStatus, 'confirmed');
      assert.equal(storedRaceOrder.razorpayPaymentId, racePaymentId);
      assert.equal(storedRaceOrder.paymentVerifiedAt instanceof Date, true);
    });

    await t.test('cash settlement is constrained and mass assignment is blocked', async () => {
      const cashOrder = await createPublicOrder({ productId: product._id, name: 'Cash Customer' });
      const attack = await putJson(`/api/orders/${cashOrder.order._id}/status`, { orderStatus: 'confirmed', paymentStatus: 'paid', role: 'admin' }, { token: adminToken });
      assert.equal(attack.status, 400);
      const before = await Order.findById(cashOrder.order._id);
      assert.equal(before.paymentStatus, 'pending');
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
      assert.match(qr.data.table.qrUrl, /^https:\/\/client-[a-z0-9-]+\.vercel\.app\/menu\?table=13$/);
      assert.doesNotMatch(qr.data.table.qrUrl, /attacker\.example/);
    });

    await t.test('regex, length, object-id, and request-size validation are real', async () => {
      const injection = await request(`/api/menu?search=${encodeURIComponent('{"$ne":null}')}`);
      assert.equal(injection.status, 200);
      assert.deepEqual(injection.data.products, []);
      assert.equal((await request(`/api/menu?search=${'x'.repeat(101)}`)).status, 400);
      assert.equal((await request('/api/menu/not-an-object-id')).status, 400);
      assert.equal((await json('/api/orders', { tableNumber: 1, customer: { name: 'Bad Quantity', phone: '9876543210' }, items: [{ productId: String(product._id), quantity: 1000 }], paymentMethod: 'cash' })).status, 400);
      assert.equal((await json('/api/orders', { tableNumber: 1, customer: { name: 'Bad Product', phone: '9876543210' }, items: [{ productId: 'not-an-object-id', quantity: 1 }], paymentMethod: 'cash' })).status, 400);
      const oversizedOrder = await json('/api/orders', { tableNumber: 1, customer: { name: 'Large Notes', phone: '9876543210' }, items: [{ productId: String(product._id), quantity: 1 }], paymentMethod: 'cash', notes: 'x'.repeat(110 * 1024) });
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
      const indexes = await Order.collection.indexes();
      assert.ok(indexes.some((index) => index.unique && index.key.orderNumber === 1));
      assert.equal(await Counter.exists({ _id: 'orderNumber' }).then(Boolean), true);
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
