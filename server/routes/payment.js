import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';
import { verifyRazorpaySignature } from '../utils/orderSecurity.js';

const router = express.Router();

const getRazorpay = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || keySecret === 'placeholder_secret' || !keySecret) {
    throw new Error('Razorpay credentials are not properly configured.');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

// POST /api/payment/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required.' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (order.paymentMethod !== 'razorpay') {
      return res.status(400).json({ error: 'This order is not configured for online payment.' });
    }

    // Prevent creating multiple Razorpay orders
    if (order.razorpayOrderId && order.razorpayOrderId !== '') {
      // Already has a Razorpay order - use existing
      return res.json({
        razorpayOrderId: order.razorpayOrderId,
        amount: Math.round(order.total * 100),
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order is already paid.' });
    }

    const razorpay = getRazorpay();
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

    // Store Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Razorpay create order error:', error);
    res.status(500).json({ error: 'Payment initialization failed. Please try again.' });
  }
});

// POST /api/payment/verify
// SECURITY: Idempotent, validates amount, signature, and order match
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification data.' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // IDEMPOTENCY: If already verified successfully, return success safely
    if (order.paymentStatus === 'paid' && order.paymentVerifiedAt) {
      return res.json({
        success: true,
        message: 'Payment already verified',
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
        },
      });
    }

    // Payment status must be pending to verify
    if (order.paymentStatus !== 'pending') {
      return res.status(400).json({ error: 'Order payment is not in pending state.' });
    }

    // Verify Razorpay order ID matches
    if (order.razorpayOrderId && order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ error: 'Payment order ID mismatch detected.' });
    }

    // Get and validate Razorpay secret
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || secret === 'placeholder_secret') {
      return res.status(500).json({ error: 'Razorpay secret is not configured.' });
    }

    // Verify HMAC signature with constant-time comparison
    const isValidSignature = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      keySecret: secret,
    });

    if (!isValidSignature) {
      // Mark as failed for failed signature
      await Order.findByIdAndUpdate(orderId, { paymentStatus: 'failed' });
      return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
    }

    try {
      // Verify payment details from Razorpay API
      const razorpay = getRazorpay();
      const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

      // Verify amount matches server-calculated total
      const expectedAmount = Math.round(order.total * 100);
      if (paymentDetails.amount !== expectedAmount) {
        await Order.findByIdAndUpdate(orderId, { paymentStatus: 'failed' });
        console.error(
          `Amount mismatch: expected ${expectedAmount}, got ${paymentDetails.amount}`
        );
        return res.status(400).json({ error: 'Payment amount mismatch.' });
      }

      // Verify currency
      if (paymentDetails.currency !== 'INR') {
        await Order.findByIdAndUpdate(orderId, { paymentStatus: 'failed' });
        return res.status(400).json({ error: 'Invalid payment currency.' });
      }

      // Verify payment is captured
      if (paymentDetails.status !== 'captured') {
        await Order.findByIdAndUpdate(orderId, { paymentStatus: 'failed' });
        return res.status(400).json({ error: 'Payment not captured by Razorpay.' });
      }
    } catch (razorpayError) {
      console.error('Razorpay API error:', razorpayError);
      return res.status(500).json({ error: 'Could not verify payment with Razorpay.' });
    }

    // All checks passed: update order
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        paymentVerifiedAt: new Date(),
      },
      { new: true }
    );

    res.json({
      success: true,
      order: {
        _id: updatedOrder._id,
        orderNumber: updatedOrder.orderNumber,
        paymentStatus: updatedOrder.paymentStatus,
        orderStatus: updatedOrder.orderStatus,
      },
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed.' });
  }
});

export default router;
