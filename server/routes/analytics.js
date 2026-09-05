import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { protect, staffOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/analytics/summary
// Returns all analytics data in one round-trip
router.get('/summary', protect, staffOrAdmin, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last12MonthsStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // ── KPI cards ────────────────────────────────────────
    const [todayOrders, thisMonthOrders, lastMonthOrders, totalOrders, totalProducts, totalCategories] = await Promise.all([
      Order.find({ createdAt: { $gte: todayStart } }).lean(),
      Order.find({ createdAt: { $gte: thisMonthStart } }).lean(),
      Order.find({ createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } }).lean(),
      Order.countDocuments(),
      Product.countDocuments(),
      Category.countDocuments(),
    ]);

    const paidFilter = (o) => o.paymentStatus === 'paid';
    const revenue = (orders) => orders.filter(paidFilter).reduce((s, o) => s + o.total, 0);

    const thisMonthRevenue = revenue(thisMonthOrders);
    const lastMonthRevenue = revenue(lastMonthOrders);
    const revenueGrowth = lastMonthRevenue === 0 ? null
      : (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1);

    const kpi = {
      todayOrders: todayOrders.length,
      todayRevenue: revenue(todayOrders),
      thisMonthOrders: thisMonthOrders.length,
      thisMonthRevenue,
      lastMonthRevenue,
      revenueGrowth,
      totalOrders,
      totalProducts,
      totalCategories,
      avgOrderValue: thisMonthOrders.length > 0
        ? Math.round(thisMonthRevenue / thisMonthOrders.length)
        : 0,
    };

    // ── Monthly revenue + order count (last 12 months) ─────
    const monthlyRaw = await Order.aggregate([
      { $match: { createdAt: { $gte: last12MonthsStart } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0],
            },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyMap = {};
    monthlyRaw.forEach(({ _id, orders, revenue }) => {
      monthlyMap[`${_id.year}-${_id.month}`] = { orders, revenue: Math.round(revenue) };
    });

    const monthly = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      monthly.push({
        month: MONTHS[d.getMonth()],
        year: d.getFullYear(),
        label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        ...(monthlyMap[key] || { orders: 0, revenue: 0 }),
      });
    }

    // ── Order status breakdown ───────────────────────────
    const statusRaw = await Order.aggregate([
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
        },
      },
    ]);
    const statusBreakdown = statusRaw.map(({ _id, count }) => ({ status: _id, count }));

    // ── Payment method split ─────────────────────────────
    const paymentRaw = await Order.aggregate([
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] },
          },
        },
      },
    ]);
    const paymentSplit = paymentRaw.map(({ _id, count, revenue }) => ({
      method: _id,
      count,
      revenue: Math.round(revenue),
    }));

    // ── Top 10 selling products (by quantity) ────────────
    const topProductsRaw = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.itemTotal' },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 10 },
    ]);
    const topProducts = topProductsRaw.map(({ _id, quantity, revenue }) => ({
      name: _id,
      quantity,
      revenue: Math.round(revenue),
    }));

    // ── Hourly traffic (current month) ───────────────────
    const hourlyRaw = await Order.aggregate([
      { $match: { createdAt: { $gte: thisMonthStart } } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id': 1 } },
    ]);
    const hourlyMap = {};
    hourlyRaw.forEach(({ _id, count }) => { hourlyMap[_id] = count; });
    const hourlyTraffic = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
      orders: hourlyMap[h] || 0,
    }));

    // ── Daily orders this month ───────────────────────────
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyRaw = await Order.aggregate([
      { $match: { createdAt: { $gte: thisMonthStart } } },
      {
        $group: {
          _id: { $dayOfMonth: '$createdAt' },
          orders: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] },
          },
        },
      },
      { $sort: { '_id': 1 } },
    ]);
    const dailyMap = {};
    dailyRaw.forEach(({ _id, orders, revenue }) => { dailyMap[_id] = { orders, revenue: Math.round(revenue) }; });
    const dailyOrders = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      label: `${i + 1}`,
      ...(dailyMap[i + 1] || { orders: 0, revenue: 0 }),
    }));

    res.json({
      kpi,
      monthly,
      statusBreakdown,
      paymentSplit,
      topProducts,
      hourlyTraffic,
      dailyOrders,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to load analytics.' });
  }
});

export default router;
