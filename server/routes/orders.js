import express from 'express';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Tenant from '../models/Tenant.js';
import { decryptTenantCredentials } from '../utils/tenantSecrets.js';
import Product from '../models/Product.js';
import Table from '../models/Table.js';
import DiningBill from '../models/DiningBill.js';
import Customer from '../models/Customer.js';
import { normalizePhoneNumber } from '../utils/phoneNormalizer.js';
import { authorizeRoles, cashiers, kitchenStaff, orderReaders, ownerOrManager, protect } from '../middleware/auth.js';
import { createReceiptData, ensureReceiptNumber, generateReceiptPdf } from '../services/receipt.js';
import {
  generateOrderAccessToken,
  generateIdempotentAccessToken,
  hashAccessToken,
  verifyAccessToken,
  validateAndFetchProductPrices,
  calculateServerTotals,
} from '../utils/orderSecurity.js';
import { confirmOrderAndDeduct, restoreForOrder, validateInventoryForOrder } from '../services/inventoryService.js';
import { requireActiveDiningSession } from '../utils/diningSession.js';
import { verifyTableQrToken } from '../utils/tableQr.js';
import { withMongoTransaction } from '../utils/mongoTransaction.js';
import { openLiveStream, publishLiveUpdate, publishNewOrder, publishOrderUpdate } from '../services/liveUpdates.js';
import { writeAuditLog } from '../services/auditLog.js';
import Coupon from '../models/Coupon.js';
import { calculateCouponDiscount, claimCoupon, findAvailableCoupon, normalizeCouponCode } from '../services/couponService.js';
import { awardLoyaltyPoints, reverseLoyaltyPoints } from '../services/loyaltyService.js';

const router = express.Router();

const publicReceiptUrl = (req, orderId, accessToken) => {
  const baseUrl = process.env.PUBLIC_APP_URL || process.env.CUSTOMER_APP_URL || process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://cafe.infinigrowsoftech.com' : `https://${req.get('host')}`);
  if (!baseUrl) return '';
  return `${baseUrl.replace(/\/$/, '')}/receipt/${orderId}?accessToken=${encodeURIComponent(accessToken)}`;
};

const getAuthorizedReceipt = async (req) => {
  const { accessToken } = req.query;
  if (!accessToken) {
    const error = new Error('Access token is required.');
    error.status = 401;
    throw error;
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    const error = new Error('Invalid order ID.');
    error.status = 400;
    throw error;
  }
  const order = await Order.findById(req.params.id).lean();
  if (!order) {
    const error = new Error('Order not found.');
    error.status = 404;
    throw error;
  }
  if (!verifyAccessToken(accessToken, order.accessTokenHash)) {
    const error = new Error('Invalid access token.');
    error.status = 403;
    throw error;
  }

  let bill = null;
  if (order.diningSessionId) {
    bill = await DiningBill.findOne({ diningSessionId: order.diningSessionId });
    if (!bill) bill = await DiningBill.create({ diningSessionId: order.diningSessionId });
    await ensureReceiptNumber(bill);
  }

  const orders = order.diningSessionId
    ? await Order.find({ diningSessionId: order.diningSessionId, orderStatus: { $ne: 'cancelled' } }).sort({ createdAt: 1 }).lean()
    : [order];

  const receipt = await createReceiptData({
    orders,
    bill,
    tableNumber: order.tableNumber,
    tenantSettings: req.tenant.settings,
    receiptUrl: publicReceiptUrl(req, order._id, accessToken),
  });
  return { order, bill, receipt };
};

// POST /api/orders — Create order (public)
// SECURITY: Accepts only productId, quantity, variantId, addonIds
// Backend fetches real prices from MongoDB
router.post('/', async (req, res) => {
  try {
    const { tableNumber, tableToken, customer, items, paymentMethod, notes } = req.body;
    const couponCode = normalizeCouponCode(req.body?.couponCode);

    // Validate required fields
    const tableClaims = verifyTableQrToken(tableToken);
    if (!tableClaims) return res.status(400).json({ error: 'A valid, unexpired table QR token is required.' });
    if (String(tableClaims.tenantId) !== String(req.tenantId)) return res.status(404).json({ error: 'Invalid table QR code.' });

    if (!customer?.name?.trim() || !customer?.phone?.trim()) {
      return res.status(400).json({ error: 'Customer name and phone are required.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required.' });
    }

    if (!['razorpay', 'cash'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method.' });
    }

    // Validate the table exists and is active
    const table = await Table.findOne({ _id: tableClaims.tableId, active: true });
    if (!table) {
      return res.status(400).json({ error: 'Invalid or inactive table.' });
    }
    const normalizedTableNumber = table.tableNumber;
    if (tableNumber !== undefined && Number(tableNumber) !== normalizedTableNumber) {
      return res.status(400).json({ error: 'Table number does not match the signed table QR token.' });
    }

    // Check for idempotency key to prevent duplicate orders
    const rawIdempotencyKey = req.body?.idempotencyKey || req.headers['idempotency-key'];
    if (typeof rawIdempotencyKey !== 'string' || rawIdempotencyKey.trim().length < 8 || rawIdempotencyKey.trim().length > 100) {
      return res.status(400).json({ error: 'A unique idempotency key between 8 and 100 characters is required.' });
    }
    const idempotencyKey = rawIdempotencyKey.trim();

    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey });
      if (existingOrder) {
        const derivedToken = generateIdempotentAccessToken(idempotencyKey);
        if (verifyAccessToken(derivedToken, existingOrder.accessTokenHash)) {
          return res.status(200).json({
            order: {
              _id: existingOrder._id,
              orderNumber: existingOrder.orderNumber,
              tableNumber: existingOrder.tableNumber,
              customer: existingOrder.customer,
              items: existingOrder.items,
              subtotal: existingOrder.subtotal,
              discount: existingOrder.discount || 0,
              couponCode: existingOrder.couponCode || '',
              tax: existingOrder.tax,
              total: existingOrder.total,
              paymentMethod: existingOrder.paymentMethod,
              paymentStatus: existingOrder.paymentStatus,
              cashVerificationStatus: existingOrder.cashVerificationStatus,
              orderStatus: existingOrder.orderStatus,
              createdAt: existingOrder.createdAt,
            },
            accessToken: derivedToken,
            idempotent: true,
          });
        }
      }
    }

    // Sanitize and normalize customer data
    const normalizedPhone = normalizePhoneNumber(customer.phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Customer phone number is invalid.' });
    }
    const customerName = String(customer.name).trim();
    const customerEmail = typeof customer.email === 'string' ? customer.email.trim().toLowerCase() : '';
    const explicitMarketingConsent = customer.marketingConsent === true;

    // Validate and fetch all product prices from database
    const validatedItems = await validateAndFetchProductPrices(items, Product);

    // Guard against rapid duplicate clicks (exact same name, phone, table, within 2 seconds)
    const recentDuplicate = await Order.findOne({
      tableNumber: normalizedTableNumber,
      'customer.name': customerName,
      'customer.phone': { $in: [normalizedPhone, String(customer.phone).trim()] },
      createdAt: { $gte: new Date(Date.now() - 2000) },
    }).sort({ createdAt: -1 });

    if (recentDuplicate && recentDuplicate.items?.length === validatedItems.length) {
      const sameItems = validatedItems.every((item, idx) => {
        const existing = recentDuplicate.items[idx];
        return existing && String(existing.product) === String(item.product) && existing.quantity === item.quantity;
      });
      if (sameItems) {
        return res.status(409).json({
          error: 'An identical order was just placed. Please wait a moment.',
          code: 'DUPLICATE_ORDER_ATTEMPT',
          orderId: recentDuplicate._id,
        });
      }
    }

    // Optional dining session linkage if valid dining session token provided
    let diningSessionId = null;
    if (req.body?.diningSessionToken) {
      try {
        const session = await requireActiveDiningSession(req.body.diningSessionToken);
        if (session && Number(session.tableNumber) === normalizedTableNumber) {
          diningSessionId = session._id;
        }
      } catch {
        // Invalid or expired token does not block basic order creation
      }
    }

    // Inventory pre-check — verify stock before accepting order
    const inventoryErrors = await validateInventoryForOrder(validatedItems);
    if (inventoryErrors.length > 0) {
      return res.status(409).json({
        error: 'Some items are no longer available in the requested quantity.',
        code: 'INVENTORY_INSUFFICIENT',
        details: inventoryErrors.map(e => ({
          inventoryItem: e.inventoryItem,
          needed: e.needed,
          available: e.available,
          unit: e.unit,
        })),
      });
    }

    // Calculate totals server-side
    const taxRate = Number(req.tenant.settings?.taxRate ?? 5);
    const baseTotals = calculateServerTotals(validatedItems, taxRate);
    const subtotal = baseTotals.subtotal;
    const coupon = couponCode ? await findAvailableCoupon(couponCode) : null;
    if (couponCode && !coupon) return res.status(400).json({ error: 'Coupon is invalid, expired, or fully redeemed.' });
    if (coupon && subtotal < coupon.minimumSubtotal) return res.status(400).json({ error: `Minimum cart subtotal is ₹${coupon.minimumSubtotal}.` });
    const discount = coupon ? calculateCouponDiscount(coupon, subtotal) : 0;
    const tax = Number(((subtotal - discount) * taxRate / 100).toFixed(2));
    const total = Number((subtotal - discount + tax).toFixed(2));

    // Find or create Customer document
    const now = new Date();
    let customerDoc = await Customer.findOne({ phone: normalizedPhone });

    if (!customerDoc) {
      customerDoc = await Customer.create({
        name: customerName,
        phone: normalizedPhone,
        email: customerEmail,
        marketingConsent: explicitMarketingConsent,
        marketingConsentAt: explicitMarketingConsent ? now : null,
        firstOrderAt: now,
        lastOrderAt: now,
        totalOrders: 1,
        totalSpent: total,
        status: 'active',
      });
    } else {
      customerDoc.lastOrderAt = now;
      customerDoc.totalOrders = (customerDoc.totalOrders || 0) + 1;
      customerDoc.totalSpent = (customerDoc.totalSpent || 0) + total;

      if (customerName && (!customerDoc.name || customerDoc.name.toLowerCase() === 'guest')) {
        customerDoc.name = customerName;
      }
      if (customerEmail && !customerDoc.email) {
        customerDoc.email = customerEmail;
      }

      // Preserve existing consent; never silently change false to true unless explicit
      if (explicitMarketingConsent && !customerDoc.marketingConsent && customerDoc.status !== 'blocked') {
        customerDoc.marketingConsent = true;
        customerDoc.marketingConsentAt = now;
        customerDoc.marketingOptOutAt = null;
        if (customerDoc.status === 'unsubscribed') {
          customerDoc.status = 'active';
        }
      }
      await customerDoc.save();
    }

    // Generate secure access token (deterministic if idempotencyKey supplied)
    const accessToken = idempotencyKey
      ? generateIdempotentAccessToken(idempotencyKey)
      : generateOrderAccessToken();
    const accessTokenHash = hashAccessToken(accessToken);

    // Create order with server-calculated totals only
    let order;
    let couponClaimed = false;
    const createOrderAndPayment = async (session) => {
        try {
        if (coupon) {
          const claimed = await claimCoupon(coupon, session);
          if (!claimed) {
            const error = new Error('Coupon is no longer available.');
            error.status = 409;
            throw error;
          }
          couponClaimed = true;
        }
        [order] = await Order.create([{
      tableNumber: normalizedTableNumber,
      diningSessionId: diningSessionId || undefined,
      customerId: customerDoc._id,
      customer: {
        name: customerName,
        phone: normalizedPhone,
        email: customerDoc.email || customerEmail,
        marketingConsent: customerDoc.marketingConsent,
      },
      items: validatedItems,
      subtotal,
      discount,
      couponCode: coupon?.code || '',
      tax,
      total,
      taxRate,
      currency: String(req.tenant.settings?.currency || 'INR'),
      paymentMethod,
      paymentStatus: 'pending',
      cashVerificationStatus: paymentMethod === 'cash' ? 'pending' : 'not_required',
      orderStatus: 'pending',
      notes: String(notes || '').slice(0, 500),
      accessTokenHash,
      idempotencyKey: idempotencyKey || undefined,
      statusHistory: [{
        status: 'pending',
        previousStatus: null,
        changedAt: new Date(),
        reason: 'Order placed',
      }],
        }], { session });

        await Payment.create([{
          orderId: order._id,
          idempotencyKey: idempotencyKey || `order:${order._id}`,
          provider: paymentMethod,
          amount: total,
          currency: String(req.tenant.settings?.currency || 'INR'),
          status: 'pending',
        }], { session });
        } catch (error) {
          if (!session && couponClaimed) {
            await Coupon.updateOne({ _id: coupon._id, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
            couponClaimed = false;
          }
          if (!session && order?._id) await Order.deleteOne({ _id: order._id });
          if (!session && order?._id) await Payment.deleteOne({ orderId: order._id });
          throw error;
        }
    };
    await withMongoTransaction(createOrderAndPayment, () => createOrderAndPayment(undefined));

    publishNewOrder(order);

    // Return order with access token (only on creation)
    res.status(201).json({
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        customerId: order.customerId,
        customer: order.customer,
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount || 0,
        couponCode: order.couponCode || '',
        tax: order.tax,
        taxRate: order.taxRate,
        currency: order.currency || req.tenant.settings?.currency || 'INR',
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        cashVerificationStatus: order.cashVerificationStatus,
        orderStatus: order.orderStatus,
        createdAt: order.createdAt,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    if (error?.code === 11000) {
      const duplicateKey = String(req.body?.idempotencyKey || req.headers['idempotency-key'] || '').trim().slice(0, 100);
      if (duplicateKey) {
        const existingOrder = await Order.findOne({ idempotencyKey: duplicateKey }).catch(() => null);
        if (existingOrder) {
          const accessToken = generateIdempotentAccessToken(duplicateKey);
          return res.status(200).json({
            order: {
              _id: existingOrder._id,
              orderNumber: existingOrder.orderNumber,
              tableNumber: existingOrder.tableNumber,
              customer: existingOrder.customer,
              items: existingOrder.items,
              subtotal: existingOrder.subtotal,
              discount: existingOrder.discount || 0,
              couponCode: existingOrder.couponCode || '',
              tax: existingOrder.tax,
              total: existingOrder.total,
              paymentMethod: existingOrder.paymentMethod,
              paymentStatus: existingOrder.paymentStatus,
              cashVerificationStatus: existingOrder.cashVerificationStatus,
              orderStatus: existingOrder.orderStatus,
              createdAt: existingOrder.createdAt,
            },
            accessToken,
            idempotent: true,
          });
        }
      }
    }
    res.status(400).json({ error: error.message, code: error.code });
  }
});

router.get('/events/admin', protect, orderReaders, (req, res) => openLiveStream(req, res, 'admin'));

router.get('/:id([0-9a-fA-F]{24})/events', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select('accessTokenHash').lean();
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const suppliedToken = req.get('x-order-access-token');
    if (!verifyAccessToken(suppliedToken, order.accessTokenHash)) return res.status(403).json({ error: 'Invalid access token.' });
    return openLiveStream(req, res, `order:${req.params.id}`);
  } catch {
    return res.status(500).json({ error: 'Unable to open order updates.' });
  }
});

// GET /api/orders/:id — Retrieve order (requires access token)
router.get('/:id([0-9a-fA-F]{24})', async (req, res) => {
  try {
    const { accessToken } = req.query;

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token is required.' });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Verify access token
    try {
      if (!verifyAccessToken(accessToken, order.accessTokenHash)) {
        return res.status(403).json({ error: 'Invalid access token.' });
      }
    } catch (e) {
      return res.status(403).json({ error: 'Invalid access token.' });
    }

    // Return only necessary fields to customer
    res.json({
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        customer: order.customer,
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount || 0,
        couponCode: order.couponCode || '',
        tax: order.tax,
        taxRate: order.taxRate,
        currency: order.currency || req.tenant.settings?.currency || 'INR',
        total: order.total,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        cashVerificationStatus: order.cashVerificationStatus,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        rating: order.rating,
      },
    });
  } catch (error) {
    console.error('Order retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve order.' });
  }
});

// GET /api/orders (list) — List orders (admin/staff only)
router.get(['/', '/list/all'], protect, orderReaders, async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    const { status, date, page = '1', limit = '50' } = req.query;
    if (status && !['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid order status filter.' });
    }
    if (date && !['today', 'previous', 'all'].includes(date)) return res.status(400).json({ error: 'Invalid date filter.' });
    if (!/^\d{1,6}$/.test(String(page)) || Number(page) < 1 || !/^\d{1,3}$/.test(String(limit)) || Number(limit) < 1) {
      return res.status(400).json({ error: 'Page and limit must be positive integers.' });
    }
    const pageNumber = Number(page);
    const limitNumber = Math.min(100, Number(limit));
    let query = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (status) query.orderStatus = status;

    if (date === 'today') {
      query.createdAt = { $gte: today };
    } else if (date === 'previous') {
      query.createdAt = { $lt: today };
    }

    const [orders, total, todayRows, previousRows] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip((pageNumber - 1) * limitNumber).limit(limitNumber),
      Order.countDocuments(query),
      Order.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] } }, pending: { $sum: { $cond: [{ $in: ['$orderStatus', ['pending', 'confirmed', 'preparing']] }, 1, 0] } }, completed: { $sum: { $cond: [{ $eq: ['$orderStatus', 'completed'] }, 1, 0] } } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $lt: today } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] } } } },
      ]),
    ]);
    const todayStats = todayRows[0] || {};
    const previousStats = previousRows[0] || {};

    const stats = {
      todayCount: todayStats.count || 0,
      todayRevenue: todayStats.revenue || 0,
      previousCount: previousStats.count || 0,
      previousRevenue: previousStats.revenue || 0,
      pending: todayStats.pending || 0,
      completed: todayStats.completed || 0,
    };

    res.json({ orders, stats, pagination: { page: pageNumber, limit: limitNumber, total, pages: Math.max(1, Math.ceil(total / limitNumber)) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/rating', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid order ID.' });
    const { accessToken, score, comment = '' } = req.body || {};
    if (!Number.isInteger(Number(score)) || Number(score) < 1 || Number(score) > 5) return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
    if (typeof comment !== 'string' || comment.length > 500) return res.status(400).json({ error: 'Comment must be 500 characters or fewer.' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (!verifyAccessToken(accessToken, order.accessTokenHash)) return res.status(403).json({ error: 'A valid order access token is required.' });
    if (order.orderStatus !== 'completed' || order.paymentStatus !== 'paid') return res.status(409).json({ error: 'Ratings are available after a paid order has been served.' });
    if (order.rating?.submittedAt) return res.status(409).json({ error: 'A rating has already been submitted for this order.' });
    const rating = { score: Number(score), comment: comment.trim(), submittedAt: new Date() };
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, orderStatus: 'completed', paymentStatus: 'paid', 'rating.submittedAt': { $exists: false } },
      { $set: { rating } },
      { new: true, runValidators: true },
    );
    if (!updated) return res.status(409).json({ error: 'A rating has already been submitted for this order.' });
    return res.status(201).json({ rating: updated.rating });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unable to submit rating.' });
  }
});

// PUT /api/orders/:id/status — Update order status (admin/staff only)
// SECURITY: Only allows updating orderStatus, NOT paymentStatus
router.put('/:id/status', protect, kitchenStaff, async (req, res) => {
  try {
    const { orderStatus } = req.body;

    // Only allow these statuses to be set by staff
    const allowedStatuses = ['confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!orderStatus || !allowedStatuses.includes(orderStatus)) {
      return res.status(400).json({ error: `orderStatus must be one of: ${allowedStatuses.join(', ')}` });
    }

    // EXPLICITLY: Do not allow setting paymentStatus here
    if (req.body.paymentStatus !== undefined) {
      return res.status(400).json({ error: 'Payment status cannot be modified through this endpoint.' });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const previousOrder = await Order.findById(req.params.id);
    if (!previousOrder) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Enforce strict order status state machine transitions
    const VALID_STATUS_TRANSITIONS = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    if (previousOrder.orderStatus === orderStatus) {
      return res.json({ order: previousOrder });
    }

    const allowedNext = VALID_STATUS_TRANSITIONS[previousOrder.orderStatus] || [];
    if (!allowedNext.includes(orderStatus)) {
      return res.status(400).json({
        error: `Cannot transition order from "${previousOrder.orderStatus}" to "${orderStatus}".`,
        allowedTransitions: allowedNext,
      });
    }

    // SINGLE SOURCE TRIGGER: ANY NON-CONFIRMED STATUS -> CONFIRMED
    if (orderStatus === 'confirmed') {
      const result = await confirmOrderAndDeduct(req.params.id, {
        performedBy: req.user?._id,
        additionalUpdates: {
          $push: {
            statusHistory: {
              status: 'confirmed',
              previousStatus: previousOrder.orderStatus,
              changedAt: new Date(),
              changedBy: req.user?._id || null,
              reason: req.body.reason || 'Order confirmed by staff',
            },
          },
        },
      });
      publishOrderUpdate(result.order);
      return res.json({ order: result.order });
    }

    // If order is being cancelled, restore inventory if previously processed
    if (orderStatus === 'cancelled') {
      if (previousOrder.inventoryProcessed && !previousOrder.inventoryRestored) {
        await restoreForOrder(previousOrder._id, {
          performedBy: req.user?._id,
          reason: req.body.reason || 'Order cancelled by staff',
        });
      }
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: { orderStatus },
        $push: {
          statusHistory: {
            status: orderStatus,
            previousStatus: previousOrder.orderStatus,
            changedAt: new Date(),
            changedBy: req.user?._id || null,
            reason: req.body.reason || `Status updated to ${orderStatus}`,
          },
        },
      },
      { new: true }
    );

    publishOrderUpdate(order);

    res.json({ order });
  } catch (error) {
    console.error('Update order status error:', error.message);
    const status = error.statusCode || error.status || 400;
    res.status(status).json({
      error: error.message,
      code: error.code || 'STATUS_UPDATE_ERROR',
      details: error.details,
    });
  }
});

// PUT /api/orders/:id/cash-payment — staff/admin only
// Cash settlement is a separate, constrained payment transition.
router.put('/:id/cash-payment', protect, cashiers, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    if (req.body.paymentStatus !== 'paid' || Object.keys(req.body).some((key) => key !== 'paymentStatus')) {
      return res.status(400).json({ error: 'Only paymentStatus=paid is accepted for cash settlement.' });
    }

    const current = await Order.findById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Order not found.' });
    if (current.paymentMethod !== 'cash') {
      return res.status(400).json({ error: 'Only cash orders can be settled here.' });
    }
    if (current.orderStatus === 'cancelled') {
      return res.status(400).json({ error: 'Cancelled order cannot be settled.' });
    }

    // If order is not yet confirmed, confirm & deduct; if already confirmed, idempotent no-op for inventory
    const result = await confirmOrderAndDeduct(current._id, {
      additionalUpdates: {
        paymentStatus: 'paid',
        paymentVerifiedAt: new Date(),
        cashVerificationStatus: 'confirmed',
      },
      performedBy: req.user?._id,
    });
    await awardLoyaltyPoints(result.order._id);
    await Payment.findOneAndUpdate(
      { orderId: current._id, provider: 'cash' },
      { $set: { status: 'captured', capturedAt: new Date() } },
      { new: true, runValidators: true }
    );

    publishOrderUpdate(result.order);

    return res.json({ order: result.order });
  } catch (error) {
    console.error('Cash payment settlement error:', error.message);
    const status = error.statusCode || error.status || 400;
    res.status(status).json({
      error: error.message,
      code: error.code || 'CASH_PAYMENT_ERROR',
      details: error.details,
    });
  }
});

// PUT /api/orders/:id/cash-confirmation — staff verifies the customer/order
router.put('/:id/cash-confirmation', protect, cashiers, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid order ID.' });
    const { decision } = req.body;
    if (!['confirm', 'reject'].includes(decision)) return res.status(400).json({ error: 'Decision must be confirm or reject.' });

    const order = await Order.findOne({
      _id: req.params.id,
      paymentMethod: 'cash',
      cashVerificationStatus: 'pending',
      paymentStatus: 'pending',
      orderStatus: 'pending',
    });

    if (!order) {
      return res.status(409).json({ error: 'Cash order is no longer awaiting verification.' });
    }

    if (decision === 'confirm') {
      // Execute atomic confirmation + inventory deduction
      const result = await confirmOrderAndDeduct(order._id, {
        additionalUpdates: {
          cashVerificationStatus: 'confirmed',
        },
        performedBy: req.user?._id,
      });
      publishOrderUpdate(result.order);
      return res.json({ order: result.order });
    } else {
      order.cashVerificationStatus = 'rejected';
      order.orderStatus = 'cancelled';
      await order.save();
      publishOrderUpdate(order);
      return res.json({ order });
    }
  } catch (error) {
    console.error('Cash confirmation error:', error.message);
    const status = error.statusCode || error.status || 400;
    return res.status(status).json({
      error: error.message,
      code: error.code || 'CASH_CONFIRMATION_ERROR',
      details: error.details,
    });
  }
});

// GET /api/orders/:id/receipt — Download receipt (requires access token)
router.put('/:id/edit', protect, ownerOrManager, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid order ID.' });
    if (!Array.isArray(req.body?.items) || Object.keys(req.body).some((key) => key !== 'items')) {
      return res.status(400).json({ error: 'Only existing item quantities and instructions can be edited.' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.orderStatus !== 'pending' || order.paymentStatus !== 'pending' || order.razorpayOrderId || order.inventoryProcessed) {
      return res.status(409).json({ error: 'Only unconfirmed orders without an initialized payment can be edited.' });
    }
    if (req.body.items.length !== order.items.length) return res.status(400).json({ error: 'Edit each existing item once; adding or replacing items is not supported.' });
    const edits = new Map();
    for (const item of req.body.items) {
      const index = item?.itemIndex;
      const quantity = Number(item?.quantity);
      if (!Number.isInteger(index) || index < 0 || index >= order.items.length || edits.has(index)) return res.status(400).json({ error: 'Each existing item needs one valid itemIndex.' });
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) return res.status(400).json({ error: 'Quantity must be between 0 and 99; use 0 to remove an item.' });
      if (item.specialInstructions !== undefined && typeof item.specialInstructions !== 'string') return res.status(400).json({ error: 'Special instructions must be text.' });
      edits.set(index, { quantity, ...(item.specialInstructions !== undefined && { specialInstructions: item.specialInstructions.trim().slice(0, 120) }) });
    }
    const before = order.items.map((item) => ({ name: item.name, quantity: item.quantity, itemTotal: item.itemTotal }));
    const updatedItems = order.items.flatMap((item, index) => {
      const edit = edits.get(index);
      if (!edit.quantity) return [];
      const plain = item.toObject();
      plain.quantity = edit.quantity;
      plain.itemTotal = Number((plain.price * edit.quantity).toFixed(2));
      if (edit.specialInstructions !== undefined) plain.specialInstructions = edit.specialInstructions;
      return [plain];
    });
    if (!updatedItems.length) return res.status(400).json({ error: 'An order must contain at least one item.' });
    const inventoryErrors = await validateInventoryForOrder(updatedItems);
    if (inventoryErrors.length) return res.status(409).json({ error: 'The edited quantities exceed current inventory.', code: 'INVENTORY_INSUFFICIENT' });
    const { subtotal, tax, total, taxRate } = calculateServerTotals(updatedItems, Number(req.tenant.settings?.taxRate ?? 5));
    const previousItems = order.items;
    const previousTotals = { subtotal: order.subtotal, tax: order.tax, total: order.total, taxRate: order.taxRate };
    const updateOrder = async (session) => {
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, orderStatus: 'pending', paymentStatus: 'pending', razorpayOrderId: '', inventoryProcessed: false },
        { $set: { items: updatedItems, subtotal, tax, total, taxRate } },
        { new: true, runValidators: true, session },
      );
      if (!updated) throw new Error('Order became ineligible for editing.');
      const payment = await Payment.findOneAndUpdate({ orderId: order._id, status: 'pending' }, { $set: { amount: total } }, { new: true, session });
      if (!payment) throw new Error('Pending payment record is missing.');
    };
    await withMongoTransaction(updateOrder, async () => {
      await Order.updateOne({ _id: order._id }, { $set: { items: previousItems, ...previousTotals } });
      await Payment.updateOne({ orderId: order._id, status: 'pending' }, { $set: { amount: order.total } });
    });
    const updatedOrder = await Order.findById(order._id);
    await writeAuditLog({ actor: req.user, action: 'order.edited', targetType: 'Order', targetId: order._id, details: { before, after: updatedOrder.items.map((item) => ({ name: item.name, quantity: item.quantity, itemTotal: item.itemTotal })) } });
    publishOrderUpdate(updatedOrder);
    return res.json({ order: updatedOrder });
  } catch (error) {
    return res.status(error.message?.includes('ineligible') ? 409 : 400).json({ error: error.message || 'Unable to edit order.' });
  }
});

router.post('/:id/refund', protect, authorizeRoles('owner', 'manager'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid order ID.' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.paymentStatus === 'refunded') return res.json({ order, alreadyRefunded: true });
    if (order.paymentStatus === 'refund_pending') return res.status(202).json({ order, pending: true });
    if (order.paymentStatus !== 'paid') return res.status(409).json({ error: 'Only paid orders can be refunded.' });
    const paymentRecord = await Payment.findOne({ orderId: order._id });
    if (!paymentRecord || paymentRecord.status !== 'captured') return res.status(409).json({ error: 'The captured payment record is unavailable.' });

    if (paymentRecord.provider === 'cash') {
      if (req.body?.confirmCashRefund !== true || Object.keys(req.body || {}).some((key) => key !== 'confirmCashRefund')) {
        return res.status(400).json({ error: 'Confirm that cash was returned before recording this refund.' });
      }
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const result = await Order.updateOne({ _id: order._id, paymentStatus: 'paid' }, { $set: { paymentStatus: 'refunded' } }, { session });
          if (result.modifiedCount !== 1) throw new Error('Order refund is already being processed.');
          await reverseLoyaltyPoints(order._id, session);
          const paymentUpdate = await Payment.updateOne({ _id: paymentRecord._id, status: 'captured' }, { $set: { status: 'refunded', refundId: `cash-${Date.now()}` } }, { session });
          if (paymentUpdate.modifiedCount !== 1) throw new Error('Payment refund is already being processed.');
        });
      } finally {
        await session.endSession();
      }
      const refundedOrder = await Order.findById(order._id);
      await writeAuditLog({ actor: req.user, action: 'order.refunded', targetType: 'Order', targetId: order._id, details: { provider: 'cash', amount: order.total } });
      publishOrderUpdate(refundedOrder);
      return res.json({ order: refundedOrder });
    }

    if (!order.razorpayPaymentId) return res.status(409).json({ error: 'Razorpay payment ID is unavailable.' });
    const claimSession = await mongoose.startSession();
    try {
      await claimSession.withTransaction(async () => {
        const orderClaim = await Order.updateOne({ _id: order._id, paymentStatus: 'paid' }, { $set: { paymentStatus: 'refund_pending' } }, { session: claimSession });
        if (orderClaim.modifiedCount !== 1) throw new Error('Order refund is already being processed.');
        const paymentClaim = await Payment.updateOne({ _id: paymentRecord._id, status: 'captured' }, { $set: { status: 'refunding' } }, { session: claimSession });
        if (paymentClaim.modifiedCount !== 1) throw new Error('Payment refund is already being processed.');
      });
    } finally {
      await claimSession.endSession();
    }
    // A network failure cannot prove the provider did not accept the request.
    // Keep the claim pending to prevent duplicate refunds; the signed webhook
    // resolves the final state.
    const tenant = await Tenant.findById(req.tenantId).select('+paymentCredentialsEncrypted').lean();
    const credentials = decryptTenantCredentials(tenant?.paymentCredentialsEncrypted);
    if (!credentials.keyId || !credentials.keySecret) return res.status(503).json({ error: 'Razorpay credentials are not configured for this café.' });
    const razorpay = typeof req.app.locals.razorpayFactory === 'function'
      ? req.app.locals.razorpayFactory()
      : new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret });
    const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
      amount: Math.round(order.total * (10 ** new Intl.NumberFormat('en', { style: 'currency', currency: paymentRecord.currency || order.currency || 'INR' }).resolvedOptions().maximumFractionDigits)),
      notes: { orderNumber: order.orderNumber, reason: String(req.body?.reason || 'Customer refund').slice(0, 200) },
    });
    if (!refund?.id) throw new Error('Razorpay refund result is uncertain; the order remains pending webhook confirmation.');
    await Payment.updateOne({ _id: paymentRecord._id, status: 'refunding' }, { $set: { refundId: refund.id } });
    await writeAuditLog({ actor: req.user, action: 'order.refund_requested', targetType: 'Order', targetId: order._id, details: { provider: 'razorpay', amount: order.total, refundId: refund.id, status: refund.status } });
    const pendingOrder = await Order.findById(order._id);
    publishOrderUpdate(pendingOrder);
    return res.status(202).json({ order: pendingOrder, refundId: refund.id, pending: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unable to process refund.' });
  }
});

router.get('/admin/:id/receipt', protect, cashiers, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid order ID.' });
    const order = await Order.findById(req.params.id).lean();
    let bill = null;
    if (order.diningSessionId) {
      bill = await DiningBill.findOne({ diningSessionId: order.diningSessionId });
      if (!bill) bill = await DiningBill.create({ diningSessionId: order.diningSessionId });
      await ensureReceiptNumber(bill);
    }
    const orders = order.diningSessionId
      ? await Order.find({ diningSessionId: order.diningSessionId, orderStatus: { $ne: 'cancelled' } }).sort({ createdAt: 1 }).lean()
      : [order];
    const receipt = await createReceiptData({ orders, bill, tableNumber: order.tableNumber, tenantSettings: req.tenant.settings });
    const pdfBuffer = await generateReceiptPdf(receipt);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Admin receipt error:', error);
    return res.status(500).json({ error: 'Unable to generate receipt. Please try again.' });
  }
});

router.get('/:id/receipt', async (req, res) => {
  try {
    const { order, receipt } = await getAuthorizedReceipt(req);
    const pdfBuffer = await generateReceiptPdf(receipt);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${order.orderNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Receipt error:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to generate receipt. Please try again.' });
  }
});

// GET /api/orders/:id/receipt-data — Live receipt data for the customer view.
router.get('/:id/receipt-data', async (req, res) => {
  try {
    const { receipt } = await getAuthorizedReceipt(req);
    return res.json({ receipt });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to load receipt. Please try again.' });
  }
});

export default router;
