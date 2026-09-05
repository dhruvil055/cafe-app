import express from 'express';
import Razorpay from 'razorpay';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import {
  verifyAccessToken,
  verifyRazorpaySignature,
} from '../utils/orderSecurity.js';
import { requireActiveDiningSession } from '../utils/diningSession.js';

const router = express.Router();

const getRazorpay = (req) => {
  // Test-only dependency seam. Production constructs the official Razorpay
  // client from server-side credentials.
  if (typeof req.app.locals.razorpayFactory === 'function') {
    return req.app.locals.razorpayFactory();
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keySecret === 'placeholder_secret') {
    throw new Error('Razorpay credentials are not properly configured.');
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

const getOrderId = (value) => {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return value;
};

const requireOrderAccess = async (req, res, orderId, accessToken) => {
  if (!accessToken) {
    res.status(401).json({ error: 'Order access token is required.' });
    return null;
  }

  const order = await Order.findById(orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return null;
  }

  if (!verifyAccessToken(accessToken, order.accessTokenHash)) {
    res.status(403).json({ error: 'Invalid order access token.' });
    return null;
  }

  try {
    await requireActiveDiningSession(req.body.diningSessionToken);
  } catch (error) {
    res.status(403).json({ error: error.message, code: error.code });
    return null;
  }

  return order;
};

const publicPaymentState = (order) => ({
  _id: order._id,
  orderNumber: order.orderNumber,
  paymentStatus: order.paymentStatus,
  orderStatus: order.orderStatus,
});

const alreadyVerifiedResponse = (res, order) => res.json({
  success: true,
  message: 'Payment already verified.',
  order: publicPaymentState(order),
});

// POST /api/payment/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { orderId, accessToken } = req.body;
    const validOrderId = getOrderId(orderId);
    if (!validOrderId) {
      return res.status(400).json({ error: 'A valid order ID is required.' });
    }

    const order = await requireOrderAccess(req, res, validOrderId, accessToken);
    if (!order) return;

    if (order.paymentMethod !== 'razorpay') {
      return res.status(400).json({ error: 'This order is not configured for online payment.' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order is already paid.' });
    }

    if (order.paymentStatus !== 'pending' || ['cancelled', 'completed'].includes(order.orderStatus)) {
      return res.status(400).json({ error: 'Order is not eligible for payment.' });
    }

    // Reuse a locally initialized Razorpay order. The amount always comes
    // from the server-persisted order total.
    if (order.razorpayOrderId) {
      return res.json({
        razorpayOrderId: order.razorpayOrderId,
        amount: Math.round(order.total * 100),
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    }

    const razorpay = getRazorpay(req);
    const amountInPaise = Math.round(order.total * 100);
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: {
        orderId: order._id.toString(),
        tableNumber: order.tableNumber.toString(),
        customerName: order.customer.name,
      },
    });

    if (!razorpayOrder?.id || razorpayOrder.currency !== 'INR' || razorpayOrder.amount !== amountInPaise) {
      return res.status(502).json({ error: 'Payment gateway returned an invalid order.' });
    }

    // Only persist a gateway order created for this still-pending order.
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: 'pending', razorpayOrderId: '' },
      { $set: { razorpayOrderId: razorpayOrder.id } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      const current = await Order.findById(order._id);
      if (current?.razorpayOrderId) {
        return res.json({
          razorpayOrderId: current.razorpayOrderId,
          amount: Math.round(current.total * 100),
          currency: 'INR',
          keyId: process.env.RAZORPAY_KEY_ID,
        });
      }
      return res.status(409).json({ error: 'Order changed while initializing payment.' });
    }

    return res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Razorpay create order error:', error.message);
    return res.status(500).json({ error: 'Payment initialization failed. Please try again.' });
  }
});

// POST /api/payment/verify
// Requires order access authorization, binds the payment to the locally
// initialized Razorpay order, and performs an atomic pending -> paid update.
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
      accessToken,
    } = req.body;

    const validOrderId = getOrderId(orderId);
    if (!validOrderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification data.' });
    }

    const order = await requireOrderAccess(req, res, validOrderId, accessToken);
    if (!order) return;

    if (!order.razorpayOrderId) {
      return res.status(400).json({ error: 'Payment order has not been initialized.' });
    }

    if (order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ error: 'Payment order ID mismatch.' });
    }

    if (!['pending', 'paid'].includes(order.paymentStatus)) {
      return res.status(400).json({ error: 'Order payment is not in a verifiable state.' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || secret === 'placeholder_secret') {
      return res.status(500).json({ error: 'Razorpay secret is not configured.' });
    }

    if (!verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      keySecret: secret,
    })) {
      return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
    }

    // A duplicate of the exact successful verification is idempotent and does
    // not need to call Razorpay or write the order again.
    if (
      order.paymentStatus === 'paid' &&
      order.paymentVerifiedAt &&
      order.razorpayPaymentId === razorpay_payment_id &&
      order.razorpaySignature === razorpay_signature
    ) {
      return alreadyVerifiedResponse(res, order);
    }

    const razorpay = getRazorpay(req);
    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

    if (!paymentDetails?.order_id || paymentDetails.order_id !== razorpay_order_id) {
      return res.status(400).json({ error: 'Payment order ID mismatch.' });
    }

    const expectedAmount = Math.round(Number(order.total) * 100);
    if (!Number.isSafeInteger(expectedAmount) || paymentDetails?.amount !== expectedAmount) {
      return res.status(400).json({ error: 'Payment amount mismatch.' });
    }

    if (paymentDetails.currency !== 'INR') {
      return res.status(400).json({ error: 'Invalid payment currency.' });
    }

    if (paymentDetails.status !== 'captured') {
      return res.status(400).json({ error: 'Payment not captured by Razorpay.' });
    }

    if (order.paymentStatus === 'paid') {
      // A different valid payment cannot overwrite an already settled order.
      return res.status(409).json({ error: 'Order payment has already been completed.' });
    }

    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        paymentStatus: 'pending',
        razorpayOrderId: razorpay_order_id,
      },
      {
        $set: {
          paymentStatus: 'paid',
          paymentVerifiedAt: new Date(),
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          orderStatus: 'confirmed',
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      const current = await Order.findById(order._id);
      if (
        current?.paymentStatus === 'paid' &&
        current.paymentVerifiedAt &&
        current.razorpayOrderId === razorpay_order_id &&
        current.razorpayPaymentId === razorpay_payment_id &&
        current.razorpaySignature === razorpay_signature
      ) {
        return alreadyVerifiedResponse(res, current);
      }
      return res.status(409).json({ error: 'Payment was already processed or the order changed.' });
    }

    return res.json({ success: true, order: publicPaymentState(updatedOrder) });
  } catch (error) {
    console.error('Payment verification error:', error.message);
    return res.status(500).json({ error: 'Payment verification failed.' });
  }
});

export default router;
