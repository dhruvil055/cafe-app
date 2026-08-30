import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  calculateOrderTotals,
  normalizeOrderItems,
  verifyRazorpaySignature,
  validateOrderItems,
} from '../utils/security.js';

test('normalizeOrderItems rejects tampered totals', () => {
  const items = [
    { name: 'Espresso', price: 120, quantity: 2, itemTotal: 250 },
  ];

  assert.throws(() => normalizeOrderItems(items), /itemTotal/i);
});

test('calculateOrderTotals computes GST and totals deterministically', () => {
  const items = [
    { name: 'Latte', price: 180, quantity: 2, itemTotal: 360 },
    { name: 'Sandwich', price: 250, quantity: 1, itemTotal: 250 },
  ];

  const totals = calculateOrderTotals(items);

  assert.equal(totals.subtotal, 610);
  assert.equal(totals.tax, 31);
  assert.equal(totals.total, 641);
});

test('verifyRazorpaySignature accepts valid signatures and rejects invalid ones', () => {
  const secret = 'super_secure_razorpay_secret_key';
  const orderId = 'order_123';
  const paymentId = 'pay_456';
  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  assert.equal(
    verifyRazorpaySignature({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: validSignature,
      keySecret: secret,
    }),
    true,
  );

  assert.equal(
    verifyRazorpaySignature({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: 'bad_signature',
      keySecret: secret,
    }),
    false,
  );
});

test('validateOrderItems enforces positive quantities and valid numbers', () => {
  const items = [
    { name: 'Tea', price: 75, quantity: 0, itemTotal: 0 },
  ];

  assert.throws(() => validateOrderItems(items), /quantity/i);
});
