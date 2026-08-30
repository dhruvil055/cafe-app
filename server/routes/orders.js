import express from 'express';
import Order from '../models/Order.js';
import { protect } from '../middleware/auth.js';
import { generateReceipt } from '../services/receipt.js';

const router = express.Router();

// POST /api/orders — public (customer places order)
router.post('/', async (req, res) => {
  try {
    const { tableNumber, customer, items, paymentMethod, notes } = req.body;

    if (!tableNumber || !customer?.name || !customer?.phone || !items?.length) {
      return res.status(400).json({ error: 'Missing required order fields.' });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
    const taxRate = 5; // 5% GST
    const tax = Math.round(subtotal * taxRate / 100);
    const total = subtotal + tax;

    const order = await Order.create({
      tableNumber,
      customer,
      items,
      subtotal,
      tax,
      total,
      taxRate,
      paymentMethod,
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'pending',
      orderStatus: paymentMethod === 'cash' ? 'confirmed' : 'pending',
      notes: notes || '',
    });

    res.status(201).json({ order });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/orders — admin
router.get('/', protect, async (req, res) => {
  try {
    const { status, date, limit = 50 } = req.query;
    let query = {};

    if (status) query.orderStatus = status;
    if (date === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: start };
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    // Dashboard stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await Order.find({ createdAt: { $gte: today } });
    const stats = {
      todayCount: todayOrders.length,
      todayRevenue: todayOrders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0),
      pending: todayOrders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.orderStatus)).length,
      completed: todayOrders.filter(o => o.orderStatus === 'completed').length,
    };

    res.json({ orders, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/orders/:id — public (customer can track)
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/orders/:id/status — admin
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    const update = {};
    if (orderStatus) update.orderStatus = orderStatus;
    if (paymentStatus) update.paymentStatus = paymentStatus;

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json({ order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/orders/:id/receipt — generate PDF
router.get('/:id/receipt', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

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
