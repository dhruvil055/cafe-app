import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { ownerOrManager, protect } from '../middleware/auth.js';

const router = express.Router();

const resolveReportRange = (query) => {
  const now = new Date();
  const from = query.from ? new Date(`${query.from}T00:00:00.000`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = query.to ? new Date(`${query.to}T23:59:59.999`) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
  if ((to - from) > 366 * 24 * 60 * 60 * 1000) return null;
  return { from, to };
};

const csvCell = (value) => {
  const safe = String(value ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""');
  return `"${safe}"`;
};

const loadPaidOrders = async (range) => {
  const query = { paymentStatus: 'paid', createdAt: { $gte: range.from, $lte: range.to } };
  if (await Order.countDocuments(query) > 100000) {
    const error = new Error('Report exceeds 100,000 orders; choose a shorter date range.');
    error.status = 413;
    throw error;
  }
  return Order.find(query)
    .select('orderNumber createdAt tableNumber customer items subtotal discount couponCode tax total paymentMethod paymentStatus')
    .sort({ createdAt: 1 })
    .lean();
};

router.get('/exports/sales.csv', protect, ownerOrManager, async (req, res) => {
  try {
    const range = resolveReportRange(req.query);
    if (!range) return res.status(400).json({ error: 'Provide a valid date range of at most 366 days.' });
    const orders = await loadPaidOrders(range);
    const headers = ['Order', 'Date', 'Customer', 'Phone', 'Table', 'Items', 'Payment', 'Subtotal', 'Discount', 'Coupon', 'Tax', 'Total'];
    const rows = orders.map((order) => [order.orderNumber, order.createdAt.toISOString(), order.customer?.name, order.customer?.phone, order.tableNumber, order.items?.map((item) => `${item.name} x${item.quantity}`).join('; '), order.paymentMethod, order.subtotal, order.discount || 0, order.couponCode, order.tax, order.total]);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="brewhaus-sales-${range.from.toISOString().slice(0, 10)}.csv"` });
    return res.send([headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'));
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to export sales.' });
  }
});

router.get('/reports/gst', protect, ownerOrManager, async (req, res) => {
  try {
    const range = resolveReportRange(req.query);
    if (!range) return res.status(400).json({ error: 'Provide a valid date range of at most 366 days.' });
    const orders = await loadPaidOrders(range);
    const totals = orders.reduce((report, order) => {
      const tax = Number(order.tax || 0);
      report.orders += 1;
      report.taxableValue += Number(order.subtotal || 0) - Number(order.discount || 0);
      report.cgst += Math.round(tax / 2 * 100) / 100;
      report.sgst += Number((tax - Math.round(tax / 2 * 100) / 100).toFixed(2));
      report.totalTax += tax;
      report.invoiceValue += Number(order.total || 0);
      return report;
    }, { orders: 0, taxableValue: 0, cgst: 0, sgst: 0, totalTax: 0, invoiceValue: 0 });
    Object.keys(totals).forEach((key) => { if (key !== 'orders') totals[key] = Number(totals[key].toFixed(2)); });
    return res.json({ range, gstRate: 5, totals, orders: orders.map((order) => ({ orderNumber: order.orderNumber, date: order.createdAt, taxableValue: Number((order.subtotal - (order.discount || 0)).toFixed(2)), discount: order.discount || 0, cgst: Number((order.tax / 2).toFixed(2)), sgst: Number((order.tax - Number((order.tax / 2).toFixed(2))).toFixed(2)), tax: order.tax, invoiceValue: order.total })) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to generate GST report.' });
  }
});

router.get('/reports/gst.csv', protect, ownerOrManager, async (req, res) => {
  try {
    const range = resolveReportRange(req.query);
    if (!range) return res.status(400).json({ error: 'Provide a valid date range of at most 366 days.' });
    const orders = await loadPaidOrders(range);
    const headers = ['Invoice', 'Date', 'GSTIN', 'Taxable Value', 'CGST 2.5%', 'SGST 2.5%', 'Total GST', 'Invoice Value'];
    const rows = orders.map((order) => [order.orderNumber, order.createdAt.toISOString(), process.env.GSTIN || '', Number((order.subtotal - (order.discount || 0)).toFixed(2)), Number((order.tax / 2).toFixed(2)), Number((order.tax - Number((order.tax / 2).toFixed(2))).toFixed(2)), order.tax, order.total]);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="brewhaus-gst-${range.from.toISOString().slice(0, 10)}.csv"` });
    return res.send([headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'));
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to export GST report.' });
  }
});

// GET /api/analytics/summary
// Returns all analytics data in one round-trip
router.get('/summary', protect, ownerOrManager, async (req, res) => {
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
      avgOrderValue: thisMonthOrders.filter(paidFilter).length > 0
        ? Math.round(thisMonthRevenue / thisMonthOrders.filter(paidFilter).length)
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

// GET /api/analytics/reports/sales.xlsx — Sales report as Excel
router.get('/reports/sales.xlsx', protect, ownerOrManager, async (req, res) => {
  try {
    const range = resolveReportRange(req.query);
    if (!range) return res.status(400).json({ error: 'Provide a valid date range of at most 366 days.' });
    const orders = await loadPaidOrders(range);

    // Dynamic import exceljs to avoid loading in tests unless needed
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sales Report');

    // Headers
    const headers = ['Order', 'Date', 'Customer', 'Phone', 'Table', 'Items', 'Payment', 'Subtotal', 'Discount', 'Coupon', 'Tax', 'Total'];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7D5436' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Data rows
    for (const order of orders) {
      const row = sheet.addRow([
        order.orderNumber,
        order.createdAt.toISOString().split('T')[0],
        order.customer?.name || '',
        order.customer?.phone || '',
        order.tableNumber,
        order.items?.map((item) => `${item.name} x${item.quantity}`).join('; '),
        order.paymentMethod,
        order.subtotal,
        order.discount || 0,
        order.couponCode,
        order.tax,
        order.total,
      ]);
      row.eachCell((cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
    }

    // Auto-fit columns
    sheet.columns.forEach((column) => {
      column.width = Math.max(15, Math.min(40, (column.width || 15)));
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="brewhaus-sales-${range.from.toISOString().slice(0, 10)}.xlsx"`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    return res.status(500).json({ error: 'Failed to generate Excel report.' });
  }
});

export default router;
