import express from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Tenant from '../models/Tenant.js';
import { decryptTenantCredentials } from '../utils/tenantSecrets.js';
import DiningBill from '../models/DiningBill.js';
import DiningSession from '../models/DiningSession.js';
import {
  verifyAccessToken,
} from '../utils/orderSecurity.js';
import { confirmOrderAndDeduct } from '../services/inventoryService.js';
import { withMongoTransaction } from '../utils/mongoTransaction.js';
import { publishLiveUpdate, publishOrderUpdate } from '../services/liveUpdates.js';
import { writeAuditLog } from '../services/auditLog.js';
import { awardLoyaltyPoints, reverseLoyaltyPoints } from '../services/loyaltyService.js';

const router = express.Router();

const getTenantPaymentConfig = async (req) => {
  const tenant = await Tenant.findById(req.tenantId).select('+paymentCredentialsEncrypted').lean();
  const credentials = decryptTenantCredentials(tenant?.paymentCredentialsEncrypted);
  if (!credentials.keyId || !credentials.keySecret || !credentials.webhookSecret || credentials.keySecret === 'placeholder_secret' || (process.env.NODE_ENV === 'production' && credentials.keyId.startsWith('rzp_test_'))) {
    const error = new Error('Online payments are not configured for this café.');
    error.code = 'PAYMENT_CONFIG_INVALID';
    error.status = 503;
    throw error;
  }
  return credentials;
};

const getRazorpay = async (req) => {
  // Test-only dependency seam. Production constructs the official Razorpay
  // client from server-side credentials.
  if (typeof req.app.locals.razorpayFactory === 'function') {
    return { client: req.app.locals.razorpayFactory(), ...(await getTenantPaymentConfig(req)) };
  }
  const config = await getTenantPaymentConfig(req);
  return { ...config, client: new Razorpay({ key_id: config.keyId, key_secret: config.keySecret }) };
};

const minorUnits = (amount, currency) => Math.round(Number(amount) * (10 ** new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits));

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

  return order;
};

const publicPaymentState = (order) => ({
  _id: order._id,
  orderNumber: order.orderNumber,
  paymentStatus: order.paymentStatus,
  orderStatus: order.orderStatus,
});

const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!Buffer.isBuffer(rawBody) || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const suppliedBytes = Buffer.from(String(signature));
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && crypto.timingSafeEqual(suppliedBytes, expectedBytes);
};

// Kept as a 404 compatibility route: payment state can only be completed by
// the verified provider webhook.
router.post('/demo-complete', async (req, res) => {
  return res.status(404).json({ error: 'Demo payments are disabled. Payment completion requires the provider webhook.' });
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

    if (!['pending', 'payment_created'].includes(order.paymentStatus) || ['cancelled', 'completed'].includes(order.orderStatus)) {
      return res.status(400).json({ error: 'Order is not eligible for payment.' });
    }

    // Reuse a locally initialized Razorpay order. The amount always comes
    // from the server-persisted order total.
    const currency = String(order.currency || req.tenant.settings?.currency || 'INR');
    const config = await getTenantPaymentConfig(req);
    if (order.razorpayOrderId) {
      return res.json({
        razorpayOrderId: order.razorpayOrderId,
        amount: minorUnits(order.total, currency),
        currency,
        keyId: config.keyId,
      });
    }

    const { client: razorpay } = await getRazorpay(req);
    const amountInMinorUnits = minorUnits(order.total, currency);
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInMinorUnits,
      currency,
      receipt: order.orderNumber,
      notes: {
        orderId: order._id.toString(),
        tableNumber: order.tableNumber.toString(),
        customerName: order.customer.name,
      },
    });

    if (!razorpayOrder?.id || razorpayOrder.currency !== currency || razorpayOrder.amount !== amountInMinorUnits) {
      return res.status(502).json({ error: 'Payment gateway returned an invalid order.' });
    }

    // Persist the provider order against both records atomically. If a retry
    // races with this request, it reuses whichever provider order won.
    let updated;
    const persistGatewayOrder = async (session) => {
        updated = await Order.findOneAndUpdate(
          { _id: order._id, paymentStatus: { $in: ['pending', 'payment_created'] }, razorpayOrderId: '' },
          { $set: { razorpayOrderId: razorpayOrder.id, paymentStatus: 'payment_created' } },
          { new: true, runValidators: true, session }
        );
        if (updated) {
          const updatedPayment = await Payment.findOneAndUpdate(
            { orderId: order._id, status: 'pending' },
            { $set: { razorpayOrderId: razorpayOrder.id, status: 'created' } },
            { new: true, runValidators: true, session }
          );
          if (!updatedPayment) throw new Error('Payment intent record is missing. Apply the Phase 1 database migration.');
        }
    };
    await withMongoTransaction(persistGatewayOrder, async () => {
      try {
        await persistGatewayOrder(undefined);
      } catch (error) {
        await Order.updateOne({ _id: order._id, razorpayOrderId: razorpayOrder.id }, { $set: { razorpayOrderId: '', paymentStatus: 'pending' } });
        throw error;
      }
    });

    if (!updated) {
      const current = await Order.findById(order._id);
      if (current?.razorpayOrderId) {
        return res.json({
          razorpayOrderId: current.razorpayOrderId,
          amount: minorUnits(current.total, currency),
          currency,
          keyId: config.keyId,
        });
      }
      return res.status(409).json({ error: 'Order changed while initializing payment.' });
    }

    return res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: config.keyId,
    });
  } catch (error) {
    console.error('Razorpay create order error:', error.message);
    const status = error.status || (error.code === 'PAYMENT_CONFIG_INVALID' ? 503 : 502);
    const message = error.code === 'PAYMENT_CONFIG_INVALID'
      ? error.message
      : 'Payment gateway could not initialize the order. Please try again.';
    return res.status(status).json({ error: message, ...(error.code && { code: error.code }) });
  }
});

// POST /api/payment/cancel
// Customer cancelled/dismissed the payment modal.
router.post('/cancel', async (req, res) => {
  try {
    const { orderId, accessToken } = req.body;
    const validOrderId = getOrderId(orderId);
    if (!validOrderId) return res.status(400).json({ error: 'A valid order ID is required.' });

    const order = await requireOrderAccess(req, res, validOrderId, accessToken);
    if (!order) return;

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order has already been paid.' });
    }

    // A browser dismiss event is not authoritative: a payment may still be
    // captured by the gateway. Leave server payment state for the webhook.
    return res.status(202).json({ success: true, verified: false, message: 'Payment state awaits the provider webhook.', order: publicPaymentState(order) });
  } catch (error) {
    console.error('Payment cancel error:', error.message);
    return res.status(500).json({ error: 'Failed to record payment cancellation.' });
  }
});

// POST /api/payment/webhook — only this signed server-to-server event can
// mark a Razorpay order paid.
router.post('/webhook', async (req, res) => {
  try {
    const config = await getTenantPaymentConfig(req);
    const secret = config.webhookSecret;
    const signature = req.get('x-razorpay-signature');
    if (!secret || !verifyWebhookSignature(req.rawBody, signature, secret)) {
      return res.status(400).json({ error: 'Invalid Razorpay webhook signature.' });
    }

    const event = req.body?.event;
    const refund = req.body?.payload?.refund?.entity;
    if (['refund.processed', 'refund.failed'].includes(event) && refund?.payment_id && refund?.id) {
      const paymentRecord = await Payment.findOne({ razorpayPaymentId: refund.payment_id });
      if (!paymentRecord) return res.status(404).json({ error: 'Payment record for this refund was not found.' });
      if (refund.amount !== minorUnits(paymentRecord.amount, paymentRecord.currency || 'INR')) return res.status(400).json({ error: 'Refund amount does not match the payment record.' });
      if (paymentRecord.status === 'refunded') return res.json({ received: true, duplicate: true });
      if (paymentRecord.refundId && paymentRecord.refundId !== refund.id) return res.status(409).json({ error: 'Refund ID does not match the active refund.' });
      const successful = event === 'refund.processed';
      await Payment.updateOne({ _id: paymentRecord._id, status: { $in: ['refunding', 'captured'] } }, { $set: { status: successful ? 'refunded' : 'captured', refundId: refund.id } });
      if (paymentRecord.orderId) {
        const order = await Order.findByIdAndUpdate(paymentRecord.orderId, { $set: { paymentStatus: successful ? 'refunded' : 'paid' } }, { new: true });
        if (successful) await reverseLoyaltyPoints(paymentRecord.orderId);
        if (order) publishOrderUpdate(order);
        await writeAuditLog({ actor: { email: 'razorpay-webhook', role: 'system' }, action: successful ? 'order.refunded' : 'order.refund_failed', targetType: 'Order', targetId: paymentRecord.orderId, details: { refundId: refund.id, amount: paymentRecord.amount } });
      }
      return res.json({ received: true, refundStatus: successful ? 'refunded' : 'failed' });
    }

    const payment = req.body?.payload?.payment?.entity;
    if (event !== 'payment.captured' || !payment?.order_id || !payment?.id) {
      return res.json({ received: true, ignored: true });
    }

    const paymentRecord = await Payment.findOne({ razorpayOrderId: payment.order_id });
    if (!paymentRecord) return res.status(404).json({ error: 'Payment record for this Razorpay order was not found.' });
    if (payment.currency !== (paymentRecord.currency || 'INR') || payment.amount !== minorUnits(paymentRecord.amount, paymentRecord.currency || 'INR') || payment.status !== 'captured') {
      return res.status(400).json({ error: 'Captured payment amount, currency, or status does not match the payment record.' });
    }
    if (paymentRecord.status === 'captured') {
      const completedOrder = paymentRecord.orderId ? await Order.findById(paymentRecord.orderId) : null;
      return res.json({ received: true, duplicate: true, ...(completedOrder && { order: publicPaymentState(completedOrder) }) });
    }

    if (paymentRecord.diningBillId) {
      const bill = await DiningBill.findById(paymentRecord.diningBillId);
      if (!bill) return res.status(404).json({ error: 'Dining bill for this payment was not found.' });
      if (bill.razorpayOrderId !== payment.order_id || bill.dueAmount !== paymentRecord.amount) {
        return res.status(409).json({ error: 'Dining bill changed after payment initialization.' });
      }
      const session = await mongoose.startSession();
      let updatedBill;
      try {
        await session.withTransaction(async () => {
          updatedBill = await DiningBill.findOneAndUpdate(
            { _id: bill._id, status: { $ne: 'PAID' }, dueAmount: paymentRecord.amount },
            { $set: { paidAmount: bill.grandTotal, dueAmount: 0, status: 'PAID', paidAt: new Date(), razorpayPaymentId: payment.id } },
            { new: true, runValidators: true, session }
          );
          if (!updatedBill) return;
          await Order.updateMany(
            { diningSessionId: bill.diningSessionId, paymentStatus: { $ne: 'paid' }, orderStatus: { $ne: 'cancelled' } },
            { $set: { paymentStatus: 'paid', paymentVerifiedAt: new Date(), razorpayPaymentId: payment.id } },
            { session }
          );
          await DiningSession.findOneAndUpdate(
            { _id: bill.diningSessionId, status: { $ne: 'CLOSED' } },
            { $set: { status: 'CLOSED', closedAt: new Date() } },
            { new: true, session }
          );
          await Payment.updateOne(
            { _id: paymentRecord._id, status: { $ne: 'captured' } },
            { $set: { status: 'captured', razorpayPaymentId: payment.id, webhookEventId: String(req.get('x-razorpay-event-id') || '').slice(0, 150), capturedAt: new Date() } },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
      if (!updatedBill) return res.json({ received: true, duplicate: true });
      const settledOrders = await Order.find({ diningSessionId: bill.diningSessionId }).lean();
      for (const settledOrder of settledOrders) {
        await awardLoyaltyPoints(settledOrder._id);
        publishOrderUpdate(settledOrder);
      }
      publishLiveUpdate('admin', 'bill-updated', { bill: updatedBill });
      return res.json({ received: true, bill: { _id: updatedBill._id, status: updatedBill.status, dueAmount: updatedBill.dueAmount } });
    }

    const order = await Order.findById(paymentRecord.orderId);
    if (!order) return res.status(404).json({ error: 'Order for this Razorpay payment was not found.' });
    if (order.paymentMethod !== 'razorpay' || order.razorpayOrderId !== payment.order_id) return res.status(400).json({ error: 'Payment method or gateway order mismatch.' });

    const result = await confirmOrderAndDeduct(order._id, {
      additionalUpdates: {
        paymentStatus: 'paid',
        paymentVerifiedAt: new Date(),
        razorpayPaymentId: payment.id,
      },
    });
    await awardLoyaltyPoints(result.order._id);
    publishOrderUpdate(result.order);
    const eventId = String(req.get('x-razorpay-event-id') || '').slice(0, 150);
    await Payment.findOneAndUpdate(
      { _id: paymentRecord._id, status: { $ne: 'captured' } },
      { $set: { status: 'captured', razorpayPaymentId: payment.id, webhookEventId: eventId, capturedAt: new Date() } },
      { new: true, runValidators: true }
    );
    return res.json({ received: true, order: publicPaymentState(result.order) });
  } catch (error) {
    console.error('Razorpay webhook error:', error.message);
    const status = error.statusCode || error.status || 500;
    return res.status(status).json({ error: error.message || 'Unable to process Razorpay webhook.', code: error.code });
  }
});

// POST /api/payment/verify
// Compatibility endpoint for older customer bundles. A browser callback is
// never a payment authority; completion is handled exclusively by /webhook.
router.post('/verify', async (req, res) => {
  try {
    const validOrderId = getOrderId(req.body?.orderId);
    if (!validOrderId) return res.status(400).json({ error: 'A valid order ID is required.' });
    const order = await requireOrderAccess(req, res, validOrderId, req.body?.accessToken);
    if (!order) return;
    return res.status(order.paymentStatus === 'paid' ? 200 : 202).json({
      success: order.paymentStatus === 'paid',
      verified: false,
      message: order.paymentStatus === 'paid' ? 'Payment was confirmed by webhook.' : 'Payment is awaiting the provider webhook.',
      order: publicPaymentState(order),
    });
  } catch (error) {
    console.error('Payment callback status error:', error.message);
    const status = error.statusCode || error.status || 500;
    return res.status(status).json({ error: error.message || 'Unable to load payment status.', code: error.code });
  }
});

export default router;
