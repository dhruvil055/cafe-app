import express from 'express';
import Table from '../models/Table.js';
import DiningSession from '../models/DiningSession.js';
import DiningBill from '../models/DiningBill.js';
import Order from '../models/Order.js';
import { protect, staffOrAdmin } from '../middleware/auth.js';
import {
  createDiningSessionToken,
  getSessionDurationMs,
  hashDiningSessionToken,
  verifyCafePresence,
  requireActiveDiningSession,
} from '../utils/diningSession.js';

const router = express.Router();

const sessionTokenFromRequest = (req) => req.body?.diningSessionToken || req.query?.diningSessionToken;

const refreshBill = async (sessionId) => {
  const orders = await Order.find({ diningSessionId: sessionId, orderStatus: { $ne: 'cancelled' } })
    .select('subtotal tax total paymentStatus')
    .lean();
  const subtotal = orders.reduce((sum, order) => sum + order.subtotal, 0);
  const taxTotal = orders.reduce((sum, order) => sum + order.tax, 0);
  const grandTotal = orders.reduce((sum, order) => sum + order.total, 0);
  const paidAmount = orders.filter((order) => order.paymentStatus === 'paid')
    .reduce((sum, order) => sum + order.total, 0);
  const existing = await DiningBill.findOne({ diningSessionId: sessionId }).lean();
  const status = existing?.status === 'CASH_PENDING'
    ? 'CASH_PENDING'
    : paidAmount >= grandTotal && grandTotal > 0 ? 'PAID' : 'OPEN';

  return DiningBill.findOneAndUpdate(
    { diningSessionId: sessionId },
    { $set: { subtotal, taxTotal, grandTotal, paidAmount, dueAmount: Math.max(0, grandTotal - paidAmount), status } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );
};

router.post('/', async (req, res) => {
  try {
    const tableNumber = Number(req.body.tableNumber);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
      return res.status(400).json({ error: 'A valid cafe table is required.' });
    }

    const table = await Table.findOne({ tableNumber, active: true }).select('tableNumber');
    if (!table) return res.status(404).json({ error: 'Invalid or inactive cafe table.' });

    verifyCafePresence(req.body);

    const token = createDiningSessionToken();
    const now = new Date();
    const session = await DiningSession.create({
      tokenHash: hashDiningSessionToken(token),
      tableNumber,
      verificationMethod: 'geofence',
      startedAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + getSessionDurationMs()),
    });

    return res.status(201).json({
      session: {
        id: session._id,
        tableNumber: session.tableNumber,
        status: session.status,
        expiresAt: session.expiresAt,
      },
      diningSessionToken: token,
    });
  } catch (error) {
    const status = ['PRESENCE_NOT_CONFIGURED', 'PRESENCE_VERIFICATION_FAILED'].includes(error.code) ? 403 : 400;
    return res.status(status).json({ error: error.message, code: error.code });
  }
});

router.get('/bill', async (req, res) => {
  try {
    const session = await requireActiveDiningSession(sessionTokenFromRequest(req));
    const bill = await refreshBill(session._id);
    const orders = await Order.find({ diningSessionId: session._id, orderStatus: { $ne: 'cancelled' } })
      .select('orderNumber total paymentStatus orderStatus createdAt items')
      .sort({ createdAt: 1 })
      .lean();
    return res.json({ bill, orders });
  } catch (error) {
    return res.status(403).json({ error: error.message, code: error.code });
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
    await DiningSession.updateOne({ _id: session._id }, { $set: { status: 'PAYMENT_PENDING' } });
    return res.json({ bill });
  } catch (error) {
    return res.status(403).json({ error: error.message, code: error.code });
  }
});

router.put('/bill/:billId/confirm-cash', protect, staffOrAdmin, async (req, res) => {
  try {
    const bill = await DiningBill.findOne({ _id: req.params.billId, status: 'CASH_PENDING' });
    if (!bill) return res.status(404).json({ error: 'Cash payment request not found.' });
    bill.status = 'PAID';
    bill.paidAmount = bill.grandTotal;
    bill.dueAmount = 0;
    bill.paidAt = new Date();
    bill.paidBy = req.user._id;
    await bill.save();
    await DiningSession.findOneAndUpdate(
      { _id: bill.diningSessionId, status: 'PAYMENT_PENDING' },
      { $set: { status: 'CLOSED', closedAt: new Date() } },
    );
    return res.json({ bill });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.put('/:id/close', protect, staffOrAdmin, async (req, res) => {
  try {
    const session = await DiningSession.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['ACTIVE', 'IDLE', 'PAYMENT_PENDING'] } },
      { $set: { status: 'CLOSED', closedAt: new Date() } },
      { new: true },
    );
    if (!session) return res.status(404).json({ error: 'Active dining session not found.' });
    return res.json({ session });
  } catch (error) {
    return res.status(400).json({ error: 'Invalid dining session.' });
  }
});

export default router;