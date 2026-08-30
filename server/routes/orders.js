import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Table from '../models/Table.js';
import { adminOnly, protect, staffOrAdmin } from '../middleware/auth.js';
import { generateReceipt } from '../services/receipt.js';
import {
  generateOrderAccessToken,
  hashAccessToken,
  verifyAccessToken,
  validateAndFetchProductPrices,
  calculateServerTotals,
} from '../utils/orderSecurity.js';

const router = express.Router();

// POST /api/orders — Create order (public)
// SECURITY: Accepts only productId, quantity, variantId, addonIds
// Backend fetches real prices from MongoDB
router.post('/', async (req, res) => {
  try {
    const { tableNumber, customer, items, paymentMethod, notes } = req.body;

    // Validate required fields
    if (!Number.isInteger(Number(tableNumber)) || Number(tableNumber) <= 0) {
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

    // Validate table exists and is active
    const table = await Table.findOne({
      tableNumber: Number(tableNumber),
      active: true,
    });
    if (!table) {
      return res.status(400).json({ error: 'Invalid or inactive table.' });
    }

    // Validate and fetch all product prices from database
    const validatedItems = await validateAndFetchProductPrices(items, Product);

    // Calculate totals server-side
    const { subtotal, tax, total, taxRate } = calculateServerTotals(validatedItems);

    // Generate secure access token
    const accessToken = generateOrderAccessToken();
    const accessTokenHash = hashAccessToken(accessToken);

    // Sanitize customer data
    const phone = String(customer.phone).trim();
    if (!/^[0-9+()\-\s]{7,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Customer phone number is invalid.' });
    }

    // Create order with server-calculated totals only
    const order = await Order.create({
      tableNumber: Number(tableNumber),
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
      orderStatus: 'pending',
      notes: String(notes || '').slice(0, 500),
      accessTokenHash,
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
        orderStatus: order.orderStatus,
        createdAt: order.createdAt,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/orders/:id — Retrieve order (requires access token)
router.get('/:id', async (req, res) => {
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
router.get('/list/all', protect, staffOrAdmin, async (req, res) => {
  try {
    const { status, date, limit = 50 } = req.query;
    let query = {};

    if (status && ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].includes(status)) {
      query.orderStatus = status;
    }

    if (date === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: start };
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await Order.find({ createdAt: { $gte: today } });

    const stats = {
      todayCount: todayOrders.length,
      todayRevenue: todayOrders
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

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.json({ order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/orders/:id/cash-payment — staff/admin only
// Cash settlement is a separate, constrained payment transition. It cannot
// be used for Razorpay orders or to set arbitrary payment fields.
router.put('/:id/cash-payment', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    if (req.body.paymentStatus !== 'paid' || Object.keys(req.body).some((key) => key !== 'paymentStatus')) {
      return res.status(400).json({ error: 'Only paymentStatus=paid is accepted for cash settlement.' });
    }

    const updated = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        orderStatus: { $ne: 'cancelled' },
      },
      {
        $set: {
          paymentStatus: 'paid',
          paymentVerifiedAt: new Date(),
          orderStatus: 'confirmed',
        },
      },
      { new: true, runValidators: true }
    );

    if (updated) return res.json({ order: updated });

    const current = await Order.findById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Order not found.' });
    if (current.paymentMethod !== 'cash') {
      return res.status(400).json({ error: 'Only cash orders can be settled here.' });
    }
    if (current.paymentStatus === 'paid') return res.json({ order: current });
    return res.status(400).json({ error: 'Cash order is not eligible for settlement.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/orders/:id/receipt — Download receipt (requires access token)
router.get('/:id/receipt', async (req, res) => {
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

    // Verify access token before generating receipt
    try {
      if (!verifyAccessToken(accessToken, order.accessTokenHash)) {
        return res.status(403).json({ error: 'Invalid access token.' });
      }
    } catch (e) {
      return res.status(403).json({ error: 'Invalid access token.' });
    }

    const pdfBuffer = await generateReceipt(order);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${order.orderNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Receipt error:', error);
    res.status(500).json({ error: 'Failed to generate receipt.' });
  }
});

export default router;
