import express from 'express';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import Table from '../models/Table.js';
import Order from '../models/Order.js';
import DiningBill from '../models/DiningBill.js';
import DiningSession from '../models/DiningSession.js';
import { createReceiptData, ensureReceiptNumber, generateReceiptPdf } from '../services/receipt.js';
import { protect, staffOrAdmin } from '../middleware/auth.js';
import { verifyRazorpaySignature } from '../utils/orderSecurity.js';
import {
  createDiningSessionToken,
  hashDiningSessionToken,
  requireActiveDiningSession,
  sessionExpiresAt,
} from '../utils/diningSession.js';

const router = express.Router();

const getRazorpay = (req) => {
  if (typeof req.app.locals.razorpayFactory === 'function') return req.app.locals.razorpayFactory();
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === 'placeholder_secret' || (process.env.NODE_ENV === 'production' && process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_'))) {
    throw new Error('Razorpay live credentials are not configured.');
  }
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};

const refreshBill = async (sessionId) => {
  const orders = await Order.find({ diningSessionId: sessionId, orderStatus: { $ne: 'cancelled' } }).select('subtotal tax total paymentStatus').lean();
  const subtotal = orders.reduce((sum, order) => sum + order.subtotal, 0);
  const taxTotal = orders.reduce((sum, order) => sum + order.tax, 0);
  const grandTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const paidAmount = orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.total, 0);
  const dueAmount = Math.max(0, grandTotal - paidAmount);
  const existing = await DiningBill.findOne({ diningSessionId: sessionId }).select('status receiptNumber').lean();
  const status = existing?.status === 'CASH_PENDING' && dueAmount > 0
    ? 'CASH_PENDING'
    : dueAmount === 0 && grandTotal > 0 ? 'PAID' : 'OPEN';
  const bill = await DiningBill.findOneAndUpdate(
    { diningSessionId: sessionId },
    { $set: { subtotal, taxTotal, grandTotal, paidAmount, dueAmount, status } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );

  await ensureReceiptNumber(bill);

  return bill;
};

router.post('/', async (req, res) => {
  try {
    const tableNumber = Number(req.body.tableNumber);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) return res.status(400).json({ error: 'A valid table is required.' });
    const table = await Table.findOne({ tableNumber, active: true }).select('tableNumber');
    if (!table) return res.status(404).json({ error: 'Invalid or inactive table.' });

    if (req.body.diningSessionToken) {
      try {
        const existing = await requireActiveDiningSession(req.body.diningSessionToken);
        if (existing.tableNumber === tableNumber) {
          return res.status(200).json({
            session: { id: existing._id, tableNumber, status: existing.status, expiresAt: existing.expiresAt },
            diningSessionToken: req.body.diningSessionToken,
          });
        }
      } catch {
        // A stale token is never reactivated; the fresh QR scan starts a new session.
      }
    }

    const token = createDiningSessionToken();
    const session = await DiningSession.create({
      tokenHash: hashDiningSessionToken(token),
      tableNumber,
      expiresAt: sessionExpiresAt(),
    });
    return res.status(201).json({
      session: { id: session._id, tableNumber, status: session.status, expiresAt: session.expiresAt },
      diningSessionToken: token,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/bill', async (req, res) => {
  try {
    const session = await requireActiveDiningSession(req.query.diningSessionToken);
    const bill = await refreshBill(session._id);
    const orders = await Order.find({ diningSessionId: session._id, orderStatus: { $ne: 'cancelled' } }).sort({ createdAt: 1 }).lean();
    return res.json({ bill: { ...bill.toObject(), tableNumber: session.tableNumber }, orders });
  } catch (error) {
    return res.status(403).json({ error: error.message, code: error.code });
  }
});

router.get('/bill/receipt-data', async (req, res) => {
  try {
    const session = await requireActiveDiningSession(req.query.diningSessionToken);
    const bill = await refreshBill(session._id);
    const orders = await Order.find({ diningSessionId: session._id, orderStatus: { $ne: 'cancelled' } }).sort({ createdAt: 1 }).lean();
    const receipt = await createReceiptData({ orders, bill, tableNumber: session.tableNumber });
    return res.json({ receipt });
  } catch (error) {
    return res.status(403).json({ error: error.message || 'Unable to load receipt.', code: error.code });
  }
});

router.get('/bill/receipt', async (req, res) => {
  try {
    const session = await requireActiveDiningSession(req.query.diningSessionToken);
    const bill = await refreshBill(session._id);
    const orders = await Order.find({ diningSessionId: session._id, orderStatus: { $ne: 'cancelled' } }).sort({ createdAt: 1 }).lean();
    const receipt = await createReceiptData({ orders, bill, tableNumber: session.tableNumber });
    const pdfBuffer = await generateReceiptPdf(receipt);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(403).json({ error: error.message || 'Unable to generate receipt.', code: error.code });
  }
});

router.post('/bill/cash', async (req, res) => {
  try {
    const session = await requireActiveDiningSession(req.body.diningSessionToken);
    const bill = await refreshBill(session._id);
    if (bill.dueAmount <= 0) return res.status(400).json({ error: 'This bill has no outstanding balance.' });
    bill.status = 'CASH_PENDING';
    bill.cashRequestedAt = new Date();
    await bill.save();
    return res.json({ bill });
  } catch (error) {
    return res.status(403).json({ error: error.message, code: error.code });
  }
});

router.post('/bill/payment/create', async (req, res) => {
  try {
    const session = await requireActiveDiningSession(req.body.diningSessionToken);
    const bill = await refreshBill(session._id);
    if (bill.dueAmount <= 0) return res.status(400).json({ error: 'This bill has no outstanding balance.' });
    if (bill.razorpayOrderId) return res.json({ razorpayOrderId: bill.razorpayOrderId, amount: Math.round(bill.dueAmount * 100), currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID });
    const gatewayOrder = await getRazorpay(req).orders.create({ amount: Math.round(bill.dueAmount * 100), currency: 'INR', receipt: `BILL-${bill._id}` });
    bill.razorpayOrderId = gatewayOrder.id;
    bill.status = 'PAYMENT_PENDING';
    await bill.save();
    return res.json({ razorpayOrderId: gatewayOrder.id, amount: gatewayOrder.amount, currency: gatewayOrder.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    return res.status(500).json({ error: 'Final bill payment initialization failed.' });
  }
});

router.post('/bill/payment/verify', async (req, res) => {
  try {
    const { diningSessionToken, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const session = await requireActiveDiningSession(diningSessionToken);
    const bill = await refreshBill(session._id);
    if (!bill.razorpayOrderId || bill.razorpayOrderId !== razorpay_order_id) return res.status(400).json({ error: 'Payment order ID mismatch.' });
    if (!verifyRazorpaySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret: process.env.RAZORPAY_KEY_SECRET })) return res.status(400).json({ error: 'Payment verification failed.' });
    if (bill.status === 'PAID') return res.json({ success: true, bill });
    const payment = await getRazorpay(req).payments.fetch(razorpay_payment_id);
    if (payment.order_id !== razorpay_order_id || payment.amount !== Math.round(bill.dueAmount * 100) || payment.currency !== 'INR' || payment.status !== 'captured') return res.status(400).json({ error: 'Payment details could not be verified.' });
    bill.paidAmount = bill.grandTotal;
    bill.dueAmount = 0;
    bill.status = 'PAID';
    bill.paidAt = new Date();
    bill.razorpayPaymentId = razorpay_payment_id;
    bill.razorpaySignature = razorpay_signature;
    await bill.save();
    await Order.updateMany(
      { diningSessionId: session._id, paymentStatus: { $ne: 'paid' }, orderStatus: { $ne: 'cancelled' } },
      { $set: { paymentStatus: 'paid', paymentVerifiedAt: new Date() } },
    );
    await DiningSession.findOneAndUpdate({ _id: session._id, status: 'ACTIVE' }, { $set: { status: 'CLOSED', closedAt: new Date() } });
    return res.json({ success: true, bill });
  } catch (error) {
    return res.status(500).json({ error: 'Final bill payment verification failed.' });
  }
});

router.put('/bill/:billId/confirm-cash', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.billId)) return res.status(400).json({ error: 'Invalid bill ID.' });
    const bill = await DiningBill.findOneAndUpdate(
      { _id: req.params.billId, status: 'CASH_PENDING', dueAmount: { $gt: 0 } },
      { $set: { status: 'PAID', dueAmount: 0, paidAt: new Date(), paidBy: req.user._id }, $currentDate: { updatedAt: true } },
      { new: true, runValidators: true },
    );
    if (!bill) return res.status(409).json({ error: 'Bill is no longer awaiting cash payment.' });
    bill.paidAmount = bill.grandTotal;
    await bill.save();
    await Order.updateMany(
      { diningSessionId: bill.diningSessionId, paymentStatus: { $ne: 'paid' }, orderStatus: { $ne: 'cancelled' } },
      { $set: { paymentStatus: 'paid', paymentVerifiedAt: new Date() } },
    );
    await DiningSession.findOneAndUpdate({ _id: bill.diningSessionId, status: { $ne: 'CLOSED' } }, { $set: { status: 'CLOSED', closedAt: new Date(), closedBy: req.user._id } });
    return res.json({ bill });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.put('/:id/close', protect, staffOrAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid session ID.' });
  const session = await DiningSession.findOneAndUpdate({ _id: req.params.id, status: { $in: ['ACTIVE', 'IDLE', 'PAYMENT_PENDING'] } }, { $set: { status: 'CLOSED', closedAt: new Date(), closedBy: req.user._id } }, { new: true });
  if (!session) return res.status(404).json({ error: 'Active session not found.' });
  return res.json({ session });
});

export default router;