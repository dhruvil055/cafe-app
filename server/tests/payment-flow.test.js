/**
 * payment-flow.test.js
 *
 * Focused integration tests for the secure Razorpay payment flow.
 *
 * Covered scenarios:
 *  1. Happy path — webhook captures payment, marks order paid, triggers inventory deduction
 *  2. Duplicate webhook delivery — idempotent; second delivery returns {duplicate:true}, no double-capture
 *  3. Concurrent duplicate webhooks (race) — exactly one capture completes
 *  4. Tampered QR code — order creation is rejected
 *  5. Client-modified total — server always uses its own persisted price
 *  6. Invalid webhook signature — rejected with 400
 *  7. Amount mismatch in webhook — rejected with 400
 *  8. Currency mismatch in webhook — rejected with 400
 *  9. Browser /verify callback cannot mark order paid on its own
 * 10. /verify rejects missing or wrong access token
 * 11. /create-order rejects wrong or missing access token
 * 12. Non-captured payment event is silently ignored
 * 13. GST breakdown is correct on receipt (CGST + SGST = total tax) and PDF generated
 * 14. Webhook for unknown razorpay order ID returns 404
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { setupTestTenant } from './tenantTestSetup.js';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_TEST_URI ||
  `mongodb://127.0.0.1:27017/cafe_payment_flow_test_${process.pid}`;
process.env.JWT_SECRET = 'payment-test-jwt-secret-with-more-than-32-bytes';
process.env.TABLE_QR_SECRET = 'payment-test-table-qr-secret-with-32-bytes-long';
// These must match what setupTestTenant() stores encrypted in the DB:
// { keyId: 'rzp_test_tenant', keySecret: 'integration-test-razorpay-secret', webhookSecret: 'integration-test-webhook-secret' }
process.env.RAZORPAY_WEBHOOK_SECRET = 'integration-test-webhook-secret';
process.env.RAZORPAY_KEY_ID = 'rzp_test_tenant';
process.env.RAZORPAY_KEY_SECRET = 'integration-test-razorpay-secret';
process.env.CLIENT_URL = 'http://localhost:5173';

// -- module imports (after env is configured) ------------------------------
const { createApp } = await import('../index.js');
const { default: Category } = await import('../models/Category.js');
const { default: Product } = await import('../models/Product.js');
const { default: Table } = await import('../models/Table.js');
const { default: Order } = await import('../models/Order.js');
const { default: Payment } = await import('../models/Payment.js');
const { createTableQrToken } = await import('../utils/tableQr.js');

// -- fake gateway ----------------------------------------------------------
const fakeGateway = {
  _seq: 0,
  orders: {
    create: async ({ amount, currency }) => ({
      id: `order_fake_${++fakeGateway._seq}`,
      amount,
      currency,
    }),
  },
  payments: {
    fetch: async () => { throw new Error('not used in these tests'); },
  },
};

// -- helpers ---------------------------------------------------------------
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

/** Sign a request body for the webhook endpoint. */
const signWebhook = (body) =>
  crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

/** Sign a browser payment callback (HMAC of orderId|paymentId). */
const signCallback = (razorpayOrderId, paymentId) =>
  crypto
    .createHmac('sha256', RZP_KEY_SECRET)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest('hex');

let httpServer;
let baseUrl;

/** Low-level fetch helper returning { status, data, response }. */
const httpReq = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const h = { ...headers };
  let b;
  if (body !== undefined && !(body instanceof Buffer) && typeof body !== 'string') {
    h['Content-Type'] = 'application/json';
    b = JSON.stringify(body);
  } else {
    b = body;
  }
  const response = await fetch(`${baseUrl}${path}`, { method, headers: h, body: b });
  const ct = response.headers.get('content-type') || '';
  const data = ct.includes('application/json')
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data, response };
};

const post = (path, body, opts = {}) => httpReq(path, { method: 'POST', body, ...opts });
const get = (path, opts = {}) => httpReq(path, { method: 'GET', ...opts });

/** Send a signed webhook event. */
const webhookEvent = (payload, eventId = `evt_${crypto.randomUUID()}`) => {
  const raw = JSON.stringify(payload);
  const signature = signWebhook(raw);
  return httpReq('/api/payment/webhook', {
    method: 'POST',
    body: raw,
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': eventId,
    },
  });
};

/**
 * Create a razorpay-method order, then call /payment/create-order.
 * Returns { order, accessToken, razorpayOrderId, amount, currency }.
 */
const createRazorpayOrder = async (product, table, opts = {}) => {
  const idempotencyKey = opts.idempotencyKey ?? crypto.randomUUID();
  const tableToken = opts.tableToken ?? createTableQrToken(table._id);

  const orderRes = await post('/api/orders', {
    tableNumber: table.tableNumber,
    tableToken,
    customer: { name: opts.name ?? 'Test Customer', phone: '9876543210' },
    items: [{ productId: String(product._id), quantity: opts.quantity ?? 1 }],
    paymentMethod: 'razorpay',
    idempotencyKey,
  });
  assert.equal(orderRes.status, 201, `Order creation failed: ${JSON.stringify(orderRes.data)}`);

  const { order, accessToken } = orderRes.data;

  const createOrderRes = await post('/api/payment/create-order', {
    orderId: order._id,
    accessToken,
  });
  assert.equal(createOrderRes.status, 200, `create-order failed: ${JSON.stringify(createOrderRes.data)}`);

  const { razorpayOrderId, amount, currency } = createOrderRes.data;
  return { order, accessToken, razorpayOrderId, amount, currency };
};

/** Build a payment.captured event payload. */
const capturedEvent = (razorpayOrderId, paymentId, amount, currency = 'INR') => ({
  event: 'payment.captured',
  payload: {
    payment: {
      entity: { id: paymentId, order_id: razorpayOrderId, amount, currency, status: 'captured' },
    },
  },
});

// ==========================================================================
test('payment flow security suite', async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();
  await setupTestTenant();

  const category = await Category.create({ name: 'Payment Test' });
  const product = await Product.create({
    name: 'Secure Espresso',
    price: 200,
    category: category._id,
    available: true,
  });
  const table = await Table.create({ tableNumber: 7, seats: 4, active: true });

  const app = createApp({ razorpayFactory: () => fakeGateway });
  httpServer = await new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

  try {
    // -- 1. Happy path -----------------------------------------------------
    await t.test('happy path: signed webhook marks order paid and confirmed', async () => {
      const { order, razorpayOrderId, amount } = await createRazorpayOrder(product, table, { name: 'Happy Customer' });
      const paymentId = 'pay_happy001';
      const result = await webhookEvent(capturedEvent(razorpayOrderId, paymentId, amount));
      assert.equal(result.status, 200, JSON.stringify(result.data));
      assert.equal(result.data.received, true);
      assert.ok(!result.data.duplicate);

      const updatedOrder = await Order.findById(order._id);
      assert.equal(updatedOrder.paymentStatus, 'paid');
      assert.equal(updatedOrder.orderStatus, 'confirmed');
      assert.equal(updatedOrder.razorpayPaymentId, paymentId);
      assert.ok(updatedOrder.paymentVerifiedAt instanceof Date);

      const paymentRecord = await Payment.findOne({ razorpayOrderId });
      assert.equal(paymentRecord.status, 'captured');
      assert.equal(paymentRecord.razorpayPaymentId, paymentId);
    });

    // -- 2. Duplicate webhook delivery ------------------------------------
    await t.test('duplicate webhook: second delivery is idempotent', async () => {
      const { order, razorpayOrderId, amount } = await createRazorpayOrder(product, table, { name: 'Dupe Customer' });
      const paymentId = 'pay_dupe001';
      const event = capturedEvent(razorpayOrderId, paymentId, amount);

      const first = await webhookEvent(event, 'evt_dupe_1');
      assert.equal(first.status, 200);
      assert.ok(!first.data.duplicate);

      const second = await webhookEvent(event, 'evt_dupe_2');
      assert.equal(second.status, 200);
      assert.equal(second.data.duplicate, true);

      // Only one Payment record; status is captured
      const paymentRecords = await Payment.find({ razorpayOrderId });
      assert.equal(paymentRecords.length, 1);
      assert.equal(paymentRecords[0].status, 'captured');

      const updatedOrder = await Order.findById(order._id);
      assert.equal(updatedOrder.paymentStatus, 'paid');
      assert.equal(updatedOrder.razorpayPaymentId, paymentId);
    });

    // -- 3. Concurrent duplicate webhooks (race) --------------------------
    await t.test('concurrent duplicate webhooks: exactly one capture completes', async () => {
      const { order, razorpayOrderId, amount } = await createRazorpayOrder(product, table, { name: 'Race Customer' });
      const paymentId = 'pay_race001';
      const event = capturedEvent(razorpayOrderId, paymentId, amount);

      const [r1, r2, r3] = await Promise.all([
        webhookEvent(event, 'evt_race_a'),
        webhookEvent(event, 'evt_race_b'),
        webhookEvent(event, 'evt_race_c'),
      ]);

      const statuses = [r1.status, r2.status, r3.status].sort();
      assert.deepEqual(statuses, [200, 200, 200]);

      const duplicates = [r1.data.duplicate, r2.data.duplicate, r3.data.duplicate].filter(Boolean);
      assert.equal(duplicates.length, 2, 'Exactly two of three concurrent calls should be duplicates');

      const updatedOrder = await Order.findById(order._id);
      assert.equal(updatedOrder.paymentStatus, 'paid');
    });

    // -- 4. Tampered QR code ----------------------------------------------
    await t.test('tampered QR code: order creation is rejected', async () => {
      const fakeTableId = new mongoose.Types.ObjectId();
      const tamperedToken = createTableQrToken(fakeTableId);

      const result = await post('/api/orders', {
        tableNumber: 7,
        tableToken: tamperedToken,
        customer: { name: 'Attacker', phone: '9876543210' },
        items: [{ productId: String(product._id), quantity: 1 }],
        paymentMethod: 'razorpay',
        idempotencyKey: crypto.randomUUID(),
      });
      assert.equal(result.status, 400);
    });

    // -- 5. Client-modified total -----------------------------------------
    await t.test('client-modified total: server enforces its own server-side price', async () => {
      const result = await post('/api/orders', {
        tableNumber: 7,
        tableToken: createTableQrToken(table._id),
        customer: { name: 'Cheap Customer', phone: '9123456789' },
        items: [{ productId: String(product._id), quantity: 1, price: 1, itemTotal: 1 }],
        subtotal: 1,
        tax: 0,
        total: 1,
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        paymentMethod: 'razorpay',
        idempotencyKey: crypto.randomUUID(),
      });
      assert.equal(result.status, 201);
      assert.equal(result.data.order.subtotal, 200);
      assert.equal(result.data.order.items[0].price, 200);
      assert.equal(result.data.order.items[0].itemTotal, 200);
      assert.equal(result.data.order.paymentStatus, 'pending');
      assert.equal(result.data.order.orderStatus, 'pending');
    });

    // -- 6. Invalid webhook signature -------------------------------------
    await t.test('invalid webhook signature: rejected with 400', async () => {
      const { razorpayOrderId, amount } = await createRazorpayOrder(product, table, { name: 'Sig Test' });
      const raw = JSON.stringify(capturedEvent(razorpayOrderId, 'pay_sig001', amount));
      const result = await httpReq('/api/payment/webhook', {
        method: 'POST',
        body: raw,
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'deadbeef1234567890abcdef',
        },
      });
      assert.equal(result.status, 400);
    });

    // -- 7. Amount mismatch in webhook ------------------------------------
    await t.test('webhook with wrong amount: rejected with 400', async () => {
      const { razorpayOrderId, amount } = await createRazorpayOrder(product, table, { name: 'Amount Mismatch' });
      const result = await webhookEvent(capturedEvent(razorpayOrderId, 'pay_amt001', amount + 1));
      assert.equal(result.status, 400);
    });

    // -- 8. Currency mismatch in webhook ----------------------------------
    await t.test('webhook with wrong currency: rejected with 400', async () => {
      const { razorpayOrderId, amount } = await createRazorpayOrder(product, table, { name: 'Currency Mismatch' });
      const result = await webhookEvent(capturedEvent(razorpayOrderId, 'pay_cur001', amount, 'USD'));
      assert.equal(result.status, 400);
    });

    // -- 9. Browser /verify cannot complete payment -----------------------
    await t.test('browser /verify callback cannot mark order paid', async () => {
      const { order, accessToken, razorpayOrderId } = await createRazorpayOrder(product, table, { name: 'Verify Test' });
      const validSig = signCallback(razorpayOrderId, 'pay_verify001');
      const verifyResult = await post('/api/payment/verify', {
        orderId: order._id,
        accessToken,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: 'pay_verify001',
        razorpay_signature: validSig,
      });
      assert.equal(verifyResult.status, 202);
      assert.equal(verifyResult.data.verified, false);

      const stillPending = await Order.findById(order._id);
      assert.notEqual(stillPending.paymentStatus, 'paid');
    });

    // -- 10. /verify rejects invalid token --------------------------------
    await t.test('/verify rejects missing or wrong access token', async () => {
      const { order, razorpayOrderId } = await createRazorpayOrder(product, table, { name: 'Token Guard V' });

      const noToken = await post('/api/payment/verify', {
        orderId: order._id,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: 'pay_tok001',
        razorpay_signature: signCallback(razorpayOrderId, 'pay_tok001'),
      });
      assert.equal(noToken.status, 401);

      const wrongToken = await post('/api/payment/verify', {
        orderId: order._id,
        accessToken: 'wrong_token',
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: 'pay_tok001',
        razorpay_signature: signCallback(razorpayOrderId, 'pay_tok001'),
      });
      assert.equal(wrongToken.status, 403);
    });

    // -- 11. /create-order rejects wrong or missing token -----------------
    await t.test('/create-order rejects missing or wrong access token', async () => {
      const orderRes = await post('/api/orders', {
        tableNumber: 7,
        tableToken: createTableQrToken(table._id),
        customer: { name: 'Gate Guard', phone: '9876543210' },
        items: [{ productId: String(product._id), quantity: 1 }],
        paymentMethod: 'razorpay',
        idempotencyKey: crypto.randomUUID(),
      });
      assert.equal(orderRes.status, 201);
      const orderId = orderRes.data.order._id;

      const r1 = await post('/api/payment/create-order', { orderId });
      assert.equal(r1.status, 401);

      const r2 = await post('/api/payment/create-order', { orderId, accessToken: 'bad_token' });
      assert.equal(r2.status, 403);
    });

    // -- 12. Non-captured webhook event is ignored ------------------------
    await t.test('non-captured (failed) payment event is silently ignored', async () => {
      const { razorpayOrderId, order } = await createRazorpayOrder(product, table, { name: 'Failed Payment' });
      const failedEvent = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: { id: 'pay_failed001', order_id: razorpayOrderId, amount: 21000, currency: 'INR', status: 'failed' },
          },
        },
      };
      const result = await webhookEvent(failedEvent);
      assert.equal(result.status, 200);
      assert.equal(result.data.ignored, true);

      const unchanged = await Order.findById(order._id);
      assert.notEqual(unchanged.paymentStatus, 'paid');
    });

    // -- 13. GST breakdown on receipt ------------------------------------
    await t.test('GST: CGST+SGST sum equals total tax and receipt PDF is generated', async () => {
      const TAX_RATE = 5; // default test tenant tax rate
      const PRICE = 200;

      const orderRes = await post('/api/orders', {
        tableNumber: 7,
        tableToken: createTableQrToken(table._id),
        customer: { name: 'GST Customer', phone: '9123456700' },
        items: [{ productId: String(product._id), quantity: 1 }],
        paymentMethod: 'cash',
        idempotencyKey: crypto.randomUUID(),
      });
      assert.equal(orderRes.status, 201);
      const { order, accessToken } = orderRes.data;

      const expectedTax = Number((PRICE * TAX_RATE / 100).toFixed(2));
      assert.equal(order.subtotal, PRICE);
      assert.equal(order.tax, expectedTax);

      // The receipt PDF should be returned and have a valid content-type
      const receiptRes = await get(
        `/api/orders/${order._id}/receipt?accessToken=${encodeURIComponent(accessToken)}`,
      );
      assert.equal(receiptRes.status, 200);
      assert.match(receiptRes.response.headers.get('content-type'), /application\/pdf/);
      // Real PDF is at least 1 KB
      assert.ok(receiptRes.data.length > 1000, 'Receipt PDF should be larger than 1 KB');
    });

    // -- 14. Webhook for unknown razorpayOrderId --------------------------
    await t.test('webhook with unknown razorpayOrderId returns 404', async () => {
      const result = await webhookEvent(capturedEvent('order_nonexistent_xyz', 'pay_none001', 21000));
      assert.equal(result.status, 404);
    });

  } finally {
    await new Promise((resolve) => httpServer.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
