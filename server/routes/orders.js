import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Table from '../models/Table.js';
import DiningBill from '../models/DiningBill.js';
import { adminOnly, protect, staffOrAdmin } from '../middleware/auth.js';
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

const router = express.Router();

const publicReceiptUrl = (req, orderId, accessToken) => {
  const baseUrl = process.env.PUBLIC_APP_URL || process.env.CUSTOMER_APP_URL || process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? `https://${req.get('host')}` : '');
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
    receiptUrl: publicReceiptUrl(req, order._id, accessToken),
  });
  return { order, bill, receipt };
};

// POST /api/orders — Create order (public)
// SECURITY: Accepts only productId, quantity, variantId, addonIds
// Backend fetches real prices from MongoDB
router.post('/', async (req, res) => {
  try {
    const { tableNumber, customer, items, paymentMethod, notes } = req.body;

    // Validate required fields
    const normalizedTableNumber = Number(tableNumber);
    if (!Number.isInteger(normalizedTableNumber) || normalizedTableNumber <= 0) {
      return res.status(400).json({ error: 'Invalid table number.' });
    }

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
    const table = await Table.findOne({
      tableNumber: normalizedTableNumber,
      active: true,
    });
    if (!table) {
      return res.status(400).json({ error: 'Invalid or inactive table.' });
    }

    // Check for idempotency key to prevent duplicate orders
    const rawIdempotencyKey = req.body?.idempotencyKey || req.headers['idempotency-key'];
    const idempotencyKey = typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim().length > 0
      ? rawIdempotencyKey.trim().slice(0, 100)
      : null;

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

    // Sanitize customer data
    const phone = String(customer.phone).trim();
    if (!/^[0-9+()\-\s]{7,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Customer phone number is invalid.' });
    }

    // Validate and fetch all product prices from database
    const validatedItems = await validateAndFetchProductPrices(items, Product);

    // Guard against rapid duplicate clicks (exact same name, phone, table, within 2 seconds)
    const recentDuplicate = await Order.findOne({
      tableNumber: normalizedTableNumber,
      'customer.name': String(customer.name).trim(),
      'customer.phone': phone,
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
    const { subtotal, tax, total, taxRate } = calculateServerTotals(validatedItems);

    // Generate secure access token (deterministic if idempotencyKey supplied)
    const accessToken = idempotencyKey
      ? generateIdempotentAccessToken(idempotencyKey)
      : generateOrderAccessToken();
    const accessTokenHash = hashAccessToken(accessToken);

    // Create order with server-calculated totals only
    const order = await Order.create({
      tableNumber: normalizedTableNumber,
      diningSessionId: diningSessionId || undefined,
      customer: {
        name: String(customer.name).trim(),
        phone,
      },
      items: validatedItems,
      subtotal,
      tax,
      total,
      taxRate,
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
    });

    // Return order with access token (only on creation)
    res.status(201).json({
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        customer: order.customer,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
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
    res.status(400).json({ error: error.message, code: error.code });
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
        tax: order.tax,
        total: order.total,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        cashVerificationStatus: order.cashVerificationStatus,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    console.error('Order retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve order.' });
  }
});

// GET /api/orders (list) — List orders (admin/staff only)
router.get(['/', '/list/all'], protect, staffOrAdmin, async (req, res) => {
  try {
    const { status, date, limit = 50 } = req.query;
    let query = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (status && ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].includes(status)) {
      query.orderStatus = status;
    }

    if (date === 'today') {
      query.createdAt = { $gte: today };
    } else if (date === 'previous') {
      query.createdAt = { $lt: today };
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    const todayOrders = await Order.find({ createdAt: { $gte: today } });
    const previousOrders = await Order.find({ createdAt: { $lt: today } });

    const stats = {
      todayCount: todayOrders.length,
      todayRevenue: todayOrders
        .filter(o => o.paymentStatus === 'paid')
        .reduce((s, o) => s + o.total, 0),
      previousCount: previousOrders.length,
      previousRevenue: previousOrders
        .filter(o => o.paymentStatus === 'paid')
        .reduce((s, o) => s + o.total, 0),
      pending: todayOrders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.orderStatus)).length,
      completed: todayOrders.filter(o => o.orderStatus === 'completed').length,
    };

    res.json({ orders, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/orders/:id/status — Update order status (admin/staff only)
// SECURITY: Only allows updating orderStatus, NOT paymentStatus
router.put('/:id/status', protect, staffOrAdmin, async (req, res) => {
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
router.put('/:id/cash-payment', protect, staffOrAdmin, async (req, res) => {
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
router.put('/:id/cash-confirmation', protect, staffOrAdmin, async (req, res) => {
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
      return res.json({ order: result.order });
    } else {
      order.cashVerificationStatus = 'rejected';
      order.orderStatus = 'cancelled';
      await order.save();
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
router.get('/admin/:id/receipt', protect, staffOrAdmin, async (req, res) => {
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
    const receipt = await createReceiptData({ orders, bill, tableNumber: order.tableNumber });
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
