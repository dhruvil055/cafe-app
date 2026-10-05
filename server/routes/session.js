import express from 'express';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import Tenant from '../models/Tenant.js';
import { decryptTenantCredentials } from '../utils/tenantSecrets.js';
import Table from '../models/Table.js';
import Order from '../models/Order.js';
import DiningBill from '../models/DiningBill.js';
import DiningSession from '../models/DiningSession.js';
import Payment from '../models/Payment.js';
import { createReceiptData, ensureReceiptNumber, generateReceiptPdf } from '../services/receipt.js';
import { cashiers, ownerOrManager, protect, tableServiceStaff } from '../middleware/auth.js';
import {
  createDiningSessionToken,
  hashDiningSessionToken,
  requireActiveDiningSession,
  sessionExpiresAt,
} from '../utils/diningSession.js';
import { verifyTableQrToken } from '../utils/tableQr.js';
import { withMongoTransaction } from '../utils/mongoTransaction.js';
import TableServiceRequest from '../models/TableServiceRequest.js';
import { publishLiveUpdate } from '../services/liveUpdates.js';
import { awardLoyaltyPoints } from '../services/loyaltyService.js';

const router = express.Router();

// GET /api/session/validate — lightweight token verification (no side-effects except lastActivityAt refresh)
router.get('/validate', async (req, res) => {
  const token = req.query.diningSessionToken;
  if (!token) {
    return res.status(400).json({ valid: false, code: 'SESSION_REQUIRED', error: 'No session token provided.' });
  }
  try {
    const session = await requireActiveDiningSession(token);
    return res.json({
      valid: true,
      tableNumber: session.tableNumber,
      sessionId: session._id,
      status: session.status,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    return res.status(200).json({ valid: false, code: err.code || 'SESSION_INVALID', error: err.message });
  }
});

const getRazorpay = async (req) => {
  const tenant = await Tenant.findById(req.tenantId).select('+paymentCredentialsEncrypted').lean();
  const credentials = decryptTenantCredentials(tenant?.paymentCredentialsEncrypted);
  if (!credentials.keyId || !credentials.keySecret || !credentials.webhookSecret || credentials.keySecret === 'placeholder_secret' || (process.env.NODE_ENV === 'production' && credentials.keyId.startsWith('rzp_test_'))) {
    throw new Error('Razorpay credentials are not configured for this café.');
  }
  return { ...credentials, client: typeof req.app.locals.razorpayFactory === 'function' ? req.app.locals.razorpayFactory() : new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret }) };
};

const minorUnits = (amount, currency) => Math.round(Number(amount) * (10 ** new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits));

const refreshBill = async (sessionId) => {
  const orders = await Order.find({ diningSessionId: sessionId, orderStatus: { $ne: 'cancelled' } }).select('subtotal tax total paymentStatus').lean();
  const subtotal = orders.reduce((sum, order) => sum + order.subtotal, 0);
  const taxTotal = orders.reduce((sum, order) => sum + order.tax, 0);
  const grandTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const paidAmount = orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.total, 0);
  const dueAmount = Math.max(0, grandTotal - paidAmount);
  const existing = await DiningBill.findOne({ diningSessionId: sessionId }).select('status receiptNumber').lean();
  const status = dueAmount === 0 && grandTotal > 0
    ? 'PAID'
    : existing?.status === 'PAYMENT_PENDING'
      ? 'PAYMENT_PENDING'
      : existing?.status === 'CASH_PENDING'
        ? 'CASH_PENDING'
        : 'OPEN';
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
    const claims = verifyTableQrToken(req.body.tableToken);
    if (!claims) return res.status(400).json({ error: 'A valid, unexpired table QR token is required.' });
    if (String(claims.tenantId) !== String(req.tenantId)) return res.status(404).json({ error: 'Invalid table QR code.' });
    const table = await Table.findOne({ _id: claims.tableId, active: true }).select('tableNumber');
    if (!table) return res.status(404).json({ error: 'Invalid or inactive table.' });
    if (Number.isInteger(tableNumber) && tableNumber !== table.tableNumber) return res.status(400).json({ error: 'Table number does not match the signed table QR token.' });

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

router.post('/request', async (req, res) => {
  try {
    const session = await requireActiveDiningSession(req.body?.diningSessionToken);
    const type = req.body?.type;
    if (!['waiter', 'bill'].includes(type)) return res.status(400).json({ error: 'Request type must be waiter or bill.' });

    let request = await TableServiceRequest.findOne({ diningSessionId: session._id, type, status: 'open' });
    const created = !request;
    if (!request) request = await TableServiceRequest.create({ diningSessionId: session._id, tableNumber: session.tableNumber, type });
    if (created) publishLiveUpdate('admin', 'service-request', { request: request.toObject() });
    return res.status(created ? 201 : 200).json({ request, alreadyOpen: !created });
  } catch (error) {
    return res.status(403).json({ error: error.message || 'Unable to submit table request.', code: error.code });
  }
});

router.get('/requests', protect, tableServiceStaff, async (req, res) => {
  const requests = await TableServiceRequest.find({ status: 'open' }).sort({ createdAt: 1 }).limit(100).lean();
  return res.json({ requests });
});

router.put('/requests/:id/served', protect, tableServiceStaff, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid request ID.' });
  const request = await TableServiceRequest.findOneAndUpdate(
    { _id: req.params.id, status: 'open' },
    { $set: { status: 'served', servedAt: new Date(), servedBy: req.user._id } },
    { new: true, runValidators: true },
  );
  if (!request) return res.status(404).json({ error: 'Open table request not found.' });
  publishLiveUpdate('admin', 'service-request-served', { request });
  return res.json({ request });
});

router.get('/bill/receipt-data', async (req, res) => {
  try {
    const session = await requireActiveDiningSession(req.query.diningSessionToken);
    const bill = await refreshBill(session._id);
    const orders = await Order.find({ diningSessionId: session._id, orderStatus: { $ne: 'cancelled' } }).sort({ createdAt: 1 }).lean();
    const receipt = await createReceiptData({ orders, bill, tableNumber: session.tableNumber, tenantSettings: req.tenant.settings });
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
    const receipt = await createReceiptData({ orders, bill, tableNumber: session.tableNumber, tenantSettings: req.tenant.settings });
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
    const currency = String(req.tenant.settings?.currency || 'INR');
    const razorpay = await getRazorpay(req);
    if (bill.razorpayOrderId) return res.json({ razorpayOrderId: bill.razorpayOrderId, amount: minorUnits(bill.dueAmount, currency), currency, keyId: razorpay.keyId });
    const amountInPaise = minorUnits(bill.dueAmount, currency);
    const gatewayOrder = await razorpay.client.orders.create({ amount: amountInPaise, currency, receipt: `BILL-${bill._id}` });
    if (!gatewayOrder?.id || gatewayOrder.currency !== currency || gatewayOrder.amount !== amountInPaise) return res.status(502).json({ error: 'Payment gateway returned an invalid bill order.' });
    let updatedBill;
    const initializeBillPayment = async (mongoSession) => {
        updatedBill = await DiningBill.findOneAndUpdate(
          { _id: bill._id, razorpayOrderId: '', dueAmount: bill.dueAmount },
          { $set: { razorpayOrderId: gatewayOrder.id, status: 'PAYMENT_PENDING' } },
          { new: true, runValidators: true, session: mongoSession }
        );
        if (updatedBill) {
          await Payment.create([{
            diningBillId: bill._id,
            idempotencyKey: `bill:${bill._id}`,
            provider: 'razorpay',
            amount: bill.dueAmount,
            currency,
            status: 'created',
            razorpayOrderId: gatewayOrder.id,
          }], { session: mongoSession });
        }
    };
    await withMongoTransaction(initializeBillPayment, async () => {
      try {
        await initializeBillPayment(undefined);
      } catch (error) {
        await Payment.deleteOne({ diningBillId: bill._id });
        await DiningBill.updateOne({ _id: bill._id, razorpayOrderId: gatewayOrder.id }, { $set: { razorpayOrderId: '', status: 'OPEN' } });
        throw error;
      }
    });
    if (!updatedBill) {
      const currentBill = await DiningBill.findById(bill._id);
      if (currentBill?.razorpayOrderId) return res.json({ razorpayOrderId: currentBill.razorpayOrderId, amount: minorUnits(currentBill.dueAmount, currency), currency, keyId: razorpay.keyId });
      return res.status(409).json({ error: 'Bill changed while initializing payment.' });
    }
    return res.json({ razorpayOrderId: gatewayOrder.id, amount: gatewayOrder.amount, currency: gatewayOrder.currency, keyId: razorpay.keyId });
  } catch (error) {
    return res.status(500).json({ error: 'Final bill payment initialization failed.' });
  }
});

router.post('/bill/payment/verify', async (req, res) => {
  try {
    const session = await requireActiveDiningSession(req.body?.diningSessionToken);
    const bill = await DiningBill.findOne({ diningSessionId: session._id });
    if (!bill) return res.status(404).json({ error: 'Bill not found.' });
    return res.status(bill.status === 'PAID' ? 200 : 202).json({ success: bill.status === 'PAID', verified: false, message: 'Payment state is controlled by the provider webhook.' });
  } catch (error) {
    return res.status(403).json({ error: error.message || 'Unable to load bill payment status.' });
  }
});

router.put('/bill/:billId/confirm-cash', protect, cashiers, async (req, res) => {
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
    const settledOrders = await Order.find(
      { diningSessionId: bill.diningSessionId, paymentStatus: { $ne: 'paid' }, orderStatus: { $ne: 'cancelled' } },
      { _id: 1 }
    ).lean();
    const settledOrderIds = settledOrders.map((order) => order._id);
    await Order.updateMany(
      { _id: { $in: settledOrderIds } },
      { $set: { paymentStatus: 'paid', paymentVerifiedAt: new Date() } },
    );
    for (const order of settledOrders) await awardLoyaltyPoints(order._id);
    await Payment.updateMany(
      { orderId: { $in: settledOrderIds }, provider: 'cash' },
      { $set: { status: 'captured', capturedAt: new Date() } },
    );
    await DiningSession.findOneAndUpdate({ _id: bill.diningSessionId, status: { $ne: 'CLOSED' } }, { $set: { status: 'CLOSED', closedAt: new Date(), closedBy: req.user._id } });
    return res.json({ bill });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.put('/:id/close', protect, ownerOrManager, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid session ID.' });
  const session = await DiningSession.findOneAndUpdate({ _id: req.params.id, status: { $in: ['ACTIVE', 'IDLE', 'PAYMENT_PENDING'] } }, { $set: { status: 'CLOSED', closedAt: new Date(), closedBy: req.user._id } }, { new: true });
  if (!session) return res.status(404).json({ error: 'Active session not found.' });
  return res.json({ session });
});

export default router;
