import express from 'express';
import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import CampaignDelivery from '../models/CampaignDelivery.js';
import PushSubscription from '../models/PushSubscription.js';
import { protect, staffOrAdmin } from '../middleware/auth.js';
import { normalizePhoneNumber } from '../utils/phoneNormalizer.js';

const router = express.Router();

/**
 * Public Customer Unsubscribe
 * POST /api/customers/public-unsubscribe
 */
router.post('/public-unsubscribe', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required to unsubscribe.' });
    }

    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }

    const customer = await Customer.findOne({ phone: normalized });
    if (customer) {
      customer.marketingConsent = false;
      customer.marketingOptOutAt = new Date();
      if (customer.status !== 'blocked') {
        customer.status = 'unsubscribed';
      }
      await customer.save();
    }

    return res.status(200).json({
      success: true,
      message: 'You have been successfully unsubscribed from Brewhaus Café promotional offers.',
    });
  } catch (err) {
    console.error('Public unsubscribe error:', err);
    return res.status(500).json({ error: 'Failed to process unsubscribe request.' });
  }
});

/**
 * CRM Statistics
 * GET /api/customers/stats
 */
router.get('/stats', protect, staffOrAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCustomers,
      notificationEnabled,
      notificationDisabled,
      marketingOptedIn,
      marketingOptedOut,
      activeCustomers,
      newThisMonth,
    ] = await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({ notificationPermission: true }),
      Customer.countDocuments({ notificationPermission: { $ne: true } }),
      Customer.countDocuments({ marketingConsent: true }),
      Customer.countDocuments({ marketingConsent: false }),
      Customer.countDocuments({ status: 'active' }),
      Customer.countDocuments({ createdAt: { $gte: startOfMonth } }),
    ]);

    res.json({
      stats: {
        totalCustomers,
        notificationEnabled,
        notificationDisabled,
        notificationsEnabled: notificationEnabled,
        notificationsDisabled: notificationDisabled,
        marketingOptIn: marketingOptedIn,
        marketingOptOut: marketingOptedOut,
        marketingOptedIn,
        marketingOptedOut,
        activeCustomers,
        newThisMonth,
        newCustomers: newThisMonth,
      },
    });
  } catch (err) {
    console.error('Customer stats error:', err);
    res.status(500).json({ error: 'Failed to fetch customer statistics.' });
  }
});

/**
 * Export Customers to CSV
 * GET /api/customers/export
 */
router.get('/export', protect, staffOrAdmin, async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 }).lean();

    const headers = [
      'Customer Name',
      'Mobile Number',
      'Email',
      'Marketing Consent',
      'Status',
      'Total Orders',
      'Total Spent (INR)',
      'First Order Date',
      'Last Order Date',
      'Customer Since',
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = customers.map((c) => [
      escapeCsv(c.name),
      escapeCsv(c.phone),
      escapeCsv(c.email || ''),
      escapeCsv(c.marketingConsent ? 'Opted-In' : 'Opted-Out'),
      escapeCsv(c.status),
      escapeCsv(c.totalOrders || 0),
      escapeCsv((c.totalSpent || 0).toFixed(2)),
      escapeCsv(c.firstOrderAt ? new Date(c.firstOrderAt).toLocaleDateString('en-IN') : ''),
      escapeCsv(c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('en-IN') : ''),
      escapeCsv(c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="brewhaus-customers-${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('Customer export error:', err);
    res.status(500).json({ error: 'Failed to export customers.' });
  }
});

/**
 * List Customers with Search, Filtering, Sorting & Pagination
 * GET /api/customers
 */
router.get('/', protect, staffOrAdmin, async (req, res) => {
  try {
    const {
      search = '',
      marketingConsent,
      notifications,
      status,
      frequency,
      minSpent,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    // Search by name, phone, or email
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
      ];
    }

    // Filter by consent
    if (marketingConsent === 'true' || marketingConsent === 'opt_in') query.marketingConsent = true;
    else if (marketingConsent === 'false' || marketingConsent === 'opt_out') query.marketingConsent = false;

    // Filter by notification permission (Phase 8)
    if (notifications === 'enabled') {
      query.notificationPermission = true;
    } else if (notifications === 'disabled') {
      query.notificationPermission = { $ne: true };
    }

    // Filter by status
    if (status && ['active', 'blocked', 'unsubscribed'].includes(status)) {
      query.status = status;
    }

    // Filter by order frequency
    if (frequency === '1') {
      query.totalOrders = 1;
    } else if (frequency === '2-4') {
      query.totalOrders = { $gte: 2, $lte: 4 };
    } else if (frequency === '5+') {
      query.totalOrders = { $gte: 5 };
    }

    // Filter by minimum spent
    if (minSpent && !isNaN(Number(minSpent))) {
      query.totalSpent = { $gte: Number(minSpent) };
    }

    // Sorting
    const allowedSortFields = ['createdAt', 'totalSpent', 'totalOrders', 'lastOrderAt', 'firstOrderAt', 'name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Customer.countDocuments(query),
    ]);

    // Attach active subscription count to each customer
    const customerIds = customers.map((c) => c._id);
    const activeSubs = await PushSubscription.aggregate([
      {
        $match: {
          customerId: { $in: customerIds },
          $or: [{ isActive: true }, { active: true }],
        },
      },
      {
        $group: {
          _id: '$customerId',
          count: { $sum: 1 },
        },
      },
    ]);

    const subCountMap = new Map(activeSubs.map((s) => [String(s._id), s.count]));
    const customersWithSubs = customers.map((c) => ({
      ...c,
      activeDevicesCount: subCountMap.get(String(c._id)) || 0,
    }));

    res.json({
      customers: customersWithSubs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      limit: limitNum,
    });
  } catch (err) {
    console.error('List customers error:', err);
    res.status(500).json({ error: 'Failed to retrieve customers.' });
  }
});

/**
 * Customer Profile Details + Order History + Campaign Deliveries + Devices
 * GET /api/customers/:id
 */
router.get('/:id', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid customer ID.' });
    }

    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // Query order history matching either customerId or normalized phone
    const orders = await Order.find({
      $or: [
        { customerId: customer._id },
        { 'customer.phone': customer.phone },
      ],
    })
      .select('orderNumber tableNumber items total subtotal tax paymentMethod paymentStatus orderStatus createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Query recent campaign deliveries
    const deliveries = await CampaignDelivery.find({ customerId: customer._id })
      .populate('campaignId', 'name title channel offerCode')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Query all push subscription devices (Phase 9)
    const devices = await PushSubscription.find({ customerId: customer._id })
      .select('deviceType browser userAgent deviceInfo isActive active createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    const aov = customer.totalOrders > 0
      ? Math.round((customer.totalSpent / customer.totalOrders) * 100) / 100
      : 0;

    res.json({
      customer,
      orders,
      deliveries,
      devices: devices.map((d) => ({
        ...d,
        isActive: d.isActive !== undefined ? d.isActive : d.active,
      })),
      metrics: {
        averageOrderValue: aov,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
      },
    });
  } catch (err) {
    console.error('Customer profile error:', err);
    res.status(500).json({ error: 'Failed to load customer profile.' });
  }
});

/**
 * Update Customer details, status, notes, tags
 * PUT /api/customers/:id
 */
router.put('/:id', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid customer ID.' });
    }

    const { name, email, status, notes, tags } = req.body;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    if (name && name.trim()) customer.name = name.trim();
    if (email !== undefined) customer.email = String(email).trim().toLowerCase();
    if (status && ['active', 'blocked', 'unsubscribed'].includes(status)) {
      customer.status = status;
      if (status === 'unsubscribed') {
        customer.marketingConsent = false;
        customer.marketingOptOutAt = new Date();
      }
    }
    if (notes !== undefined) customer.notes = String(notes).slice(0, 1000);
    if (Array.isArray(tags)) {
      customer.tags = tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10);
    }

    await customer.save();

    res.json({ customer });
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Failed to update customer.' });
  }
});

/**
 * Unsubscribe Customer (Admin action)
 * POST /api/customers/:id/unsubscribe
 */
router.post('/:id/unsubscribe', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid customer ID.' });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    customer.marketingConsent = false;
    customer.marketingOptOutAt = new Date();
    if (customer.status !== 'blocked') {
      customer.status = 'unsubscribed';
    }
    await customer.save();

    res.json({ customer, message: 'Customer has been unsubscribed from marketing.' });
  } catch (err) {
    console.error('Admin unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to unsubscribe customer.' });
  }
});

/**
 * Subscribe Customer (Admin action)
 * POST /api/customers/:id/subscribe
 */
router.post('/:id/subscribe', protect, staffOrAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid customer ID.' });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    if (customer.status === 'blocked') {
      return res.status(400).json({ error: 'Cannot subscribe a blocked customer. Unblock first.' });
    }

    customer.marketingConsent = true;
    customer.marketingConsentAt = new Date();
    customer.marketingOptOutAt = null;
    customer.status = 'active';
    await customer.save();

    res.json({ customer, message: 'Customer has been opted-in to marketing.' });
  } catch (err) {
    console.error('Admin subscribe error:', err);
    res.status(500).json({ error: 'Failed to opt-in customer.' });
  }
});

export default router;
