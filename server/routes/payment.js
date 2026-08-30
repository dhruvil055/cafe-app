import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';
import { verifyRazorpaySignature } from '../utils/security.js';

const router = express.Router();

const getRazorpay = () => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
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
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order already paid.' });
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
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification data.' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order already paid.' });
    }
    if (order.razorpayOrderId && order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ error: 'Order payment mismatch detected.' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || secret === 'placeholder_secret') {
      return res.status(500).json({ error: 'Razorpay secret is not configured.' });
    }

    const isValid = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      keySecret: secret,
    });

    if (!isValid) {
      await Order.findByIdAndUpdate(orderId, { paymentStatus: 'failed' });
      return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
      { new: true }
    );

    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed.' });
  }
});

export default router;
