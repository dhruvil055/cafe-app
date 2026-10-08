import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import Table from '../models/Table.js';
import Counter from '../models/Counter.js';
import Tenant from '../models/Tenant.js';
import { protect, orderReaders, effectiveRole } from '../middleware/auth.js';
import { validateAndFetchProductPrices, generateOrderAccessToken, hashAccessToken } from '../utils/orderSecurity.js';
import { normalizePhoneNumber } from '../utils/phoneNormalizer.js';
import { validateInventoryForOrder, confirmOrderAndDeduct } from '../services/inventoryService.js';
import { calculateGstBreakdown, formatGstInvoiceNumber } from '../services/gstService.js';
import { createReceiptData } from '../services/receipt.js';
import { publishNewOrder, publishOrderUpdate } from '../services/liveUpdates.js';
import { awardLoyaltyPoints } from '../services/loyaltyService.js';
import { findAvailableCoupon, calculateCouponDiscount, normalizeCouponCode } from '../services/couponService.js';
import { ensureMainBranch } from './branches.js';

const router = express.Router();

// Helper to generate next GST invoice number for tenant
const getNextInvoiceNumber = async (tenantId, prefix = 'INV') => {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'gstInvoiceNumber' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return formatGstInvoiceNumber({
    prefix,
    sequenceNumber: counter.seq,
    date: new Date(),
  });
};

// POST /api/pos/orders — Fast POS Order Creation
router.post('/orders', protect, orderReaders, async (req, res, next) => {
  try {
    const {
      tableNumber,
      orderType = 'counter',
      branchId,
      customer: rawCustomer = {},
      items: rawItems,
      paymentMethod = 'cash',
      splitPayments = [],
      couponCode: rawCoupon,
      manualDiscount = 0,
      customerGstin = '',
      notes = '',
      autoComplete = false,
      syncId,
    } = req.body || {};

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: 'At least one item is required.' });
    }

    // Idempotency check for offline sync or retry
    if (syncId) {
      const existing = await Order.findOne({ 'posMetadata.offlineSyncId': syncId });
      if (existing) {
        return res.status(200).json({ success: true, order: existing, duplicate: true });
      }
    }

    // Branch resolution
    let effectiveBranchId = branchId;
    if (!effectiveBranchId || !mongoose.isValidObjectId(effectiveBranchId)) {
      const mainBranch = await ensureMainBranch(req.tenantId, req.tenant?.name);
      effectiveBranchId = mainBranch?._id;
    }

    // Table validation if Dine-in
    let resolvedTableNumber = 0;
    if (orderType === 'dine_in') {
      if (!tableNumber && tableNumber !== 0) {
        return res.status(400).json({ error: 'Table number is required for Dine-in orders.' });
      }
      resolvedTableNumber = Number(tableNumber);
      // Mark table as OCCUPIED
      await Table.updateOne(
        { tableNumber: resolvedTableNumber },
        { $set: { status: 'OCCUPIED' } }
      );
    }

    // Customer normalization
    const customerPhone = normalizePhoneNumber(rawCustomer.phone || '9999999999') || '9999999999';
    const customerName = String(rawCustomer.name || 'Walk-in Customer').trim();
    const customerEmail = String(rawCustomer.email || '').trim().toLowerCase();

    // Fetch and validate real prices from database
    const validatedItems = await validateAndFetchProductPrices(rawItems, Product, req.tenantId);

    // Pre-check inventory
    const inventoryErrors = await validateInventoryForOrder(validatedItems);
    if (inventoryErrors.length > 0) {
      return res.status(409).json({
        error: 'Insufficient inventory for some items.',
        code: 'INVENTORY_INSUFFICIENT',
        details: inventoryErrors,
      });
    }

    // Calculate subtotal
    const subtotal = validatedItems.reduce((sum, item) => sum + item.itemTotal, 0);

    // Coupon / Discount
    let discount = Math.max(0, Number(manualDiscount) || 0);
    const cleanCoupon = normalizeCouponCode(rawCoupon);
    if (cleanCoupon) {
      const coupon = await findAvailableCoupon(cleanCoupon);
      if (coupon && subtotal >= (coupon.minimumSubtotal || 0)) {
        discount = Math.max(discount, calculateCouponDiscount(coupon, subtotal));
      }
    }
    discount = Math.min(discount, subtotal);
    const taxableAmount = Math.max(0, subtotal - discount);

    // GST calculation
    const taxRate = Number(req.tenant?.settings?.taxRate ?? 5);
    const gstBreakdown = calculateGstBreakdown({
      taxableAmount,
      taxRate,
      customerGstin,
    });

    const total = gstBreakdown.totalAmount;
    const tax = gstBreakdown.totalTax;

    // Check payment state
    const isPaid = ['cash', 'upi', 'card', 'split'].includes(paymentMethod) && (autoComplete || req.body?.isPaid);
    const paymentStatus = isPaid ? 'paid' : 'pending';
    const orderStatus = isPaid
      ? (autoComplete ? 'completed' : 'confirmed')
      : 'pending';

    // Generate GST invoice if paid
    let invoiceNumber = '';
    let invoiceDate = null;
    if (isPaid) {
      const prefix = req.tenant?.settings?.gstSettings?.invoicePrefix || 'INV';
      invoiceNumber = await getNextInvoiceNumber(req.tenantId, prefix);
      invoiceDate = new Date();
    }

    // Token for receipt security
    const accessToken = generateOrderAccessToken();
    const accessTokenHash = hashAccessToken(accessToken);

    // Create Order
    const order = await Order.create({
      tenantId: req.tenantId,
      branchId: effectiveBranchId,
      orderType,
      tableNumber: resolvedTableNumber,
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        marketingConsent: Boolean(rawCustomer.marketingConsent),
      },
      items: validatedItems.map(item => ({
        product: item.product,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image || '',
        addons: item.addons || [],
        variant: item.variant || null,
        specialInstructions: item.specialInstructions || '',
        itemTotal: item.itemTotal,
      })),
      subtotal,
      discount,
      couponCode: cleanCoupon || '',
      tax,
      total,
      taxRate,
      currency: req.tenant?.settings?.currency || 'INR',
      gstDetails: {
        invoiceNumber,
        invoiceDate,
        customerGstin,
        cgst: gstBreakdown.cgst,
        sgst: gstBreakdown.sgst,
        igst: gstBreakdown.igst,
        taxableAmount,
      },
      paymentMethod,
      splitPayments: Array.isArray(splitPayments) ? splitPayments : [],
      paymentStatus,
      cashVerificationStatus: paymentMethod === 'cash' && isPaid ? 'confirmed' : 'not_required',
      orderStatus,
      statusHistory: [{
        status: orderStatus,
        changedAt: new Date(),
        changedBy: req.user?._id,
        reason: 'POS Counter Creation',
      }],
      notes,
      posMetadata: {
        cashierId: req.user?._id,
        station: req.body?.station || 'POS-01',
        offlineSynced: Boolean(syncId),
        offlineSyncId: syncId || '',
        isHeld: false,
      },
      accessTokenHash,
    });

    // Update Customer profile
    if (customerPhone && customerPhone !== '9999999999') {
      await Customer.findOneAndUpdate(
        { phone: customerPhone },
        {
          $setOnInsert: { firstOrderAt: new Date(), status: 'active' },
          $set: { name: customerName, email: customerEmail, lastOrderAt: new Date() },
          $inc: { totalOrders: 1, totalSpent: isPaid ? total : 0 },
        },
        { upsert: true }
      );
    }

    // If paid at checkout, deduct inventory & award loyalty
    if (isPaid) {
      try {
        await confirmOrderAndDeduct(order, req.tenantId);
        await awardLoyaltyPoints(order, req.tenantId);
      } catch (stockErr) {
        console.warn('[POS] Stock deduction notice:', stockErr.message);
      }
    }

    // Publish SSE update
    try {
      publishNewOrder(order);
    } catch (_err) {
      // SSE broadcast failure should not block HTTP response
    }

    // Prepare Receipt response
    const receipt = await createReceiptData({
      orders: [order],
      tableNumber: order.tableNumber,
      tenantSettings: req.tenant?.settings,
      receiptUrl: '',
    });

    return res.status(201).json({
      success: true,
      order,
      receipt,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/pos/orders/hold — Park / Hold an order
router.post('/orders/hold', protect, orderReaders, async (req, res, next) => {
  try {
    const { tableNumber = 0, orderType = 'counter', customer = {}, items: rawItems, notes = '' } = req.body || {};
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: 'Order must contain items to hold.' });
    }

    const validatedItems = await validateAndFetchProductPrices(rawItems, Product, req.tenantId);
    const subtotal = validatedItems.reduce((sum, i) => sum + i.itemTotal, 0);
    const taxRate = Number(req.tenant?.settings?.taxRate ?? 5);
    const tax = Number(((subtotal * taxRate) / 100).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    const accessToken = generateOrderAccessToken();
    const accessTokenHash = hashAccessToken(accessToken);

    const order = await Order.create({
      tenantId: req.tenantId,
      orderType,
      tableNumber: Number(tableNumber) || 0,
      customer: {
        name: customer.name || 'Walk-in Customer',
        phone: customer.phone || '',
      },
      items: validatedItems,
      subtotal,
      discount: 0,
      tax,
      total,
      taxRate,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      orderStatus: 'held',
      notes,
      posMetadata: {
        cashierId: req.user?._id,
        isHeld: true,
        heldAt: new Date(),
      },
      accessTokenHash,
    });

    return res.status(201).json({ success: true, order });
  } catch (error) {
    next(error);
  }
});

// GET /api/pos/held-orders — Retrieve all held orders
router.get('/held-orders', protect, orderReaders, async (req, res, next) => {
  try {
    const heldOrders = await Order.find({ orderStatus: 'held' }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, orders: heldOrders });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/pos/held-orders/:id — Delete or dismiss a held order
router.delete('/held-orders/:id', protect, orderReaders, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, orderStatus: 'held' });
    if (!order) {
      return res.status(404).json({ error: 'Held order not found.' });
    }
    await Order.deleteOne({ _id: order._id });
    return res.json({ success: true, message: 'Held order cleared.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/pos/orders/:id/pay — Pay & complete an existing order
router.post('/orders/:id/pay', protect, orderReaders, async (req, res, next) => {
  try {
    const { paymentMethod = 'cash', splitPayments = [] } = req.body || {};
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    order.paymentMethod = paymentMethod;
    if (Array.isArray(splitPayments) && splitPayments.length > 0) {
      order.splitPayments = splitPayments;
    }
    order.paymentStatus = 'paid';
    order.orderStatus = 'completed';
    order.cashVerificationStatus = paymentMethod === 'cash' ? 'confirmed' : 'not_required';

    if (!order.gstDetails?.invoiceNumber) {
      const prefix = req.tenant?.settings?.gstSettings?.invoicePrefix || 'INV';
      order.gstDetails = order.gstDetails || {};
      order.gstDetails.invoiceNumber = await getNextInvoiceNumber(req.tenantId, prefix);
      order.gstDetails.invoiceDate = new Date();
    }

    order.statusHistory.push({
      status: 'completed',
      changedAt: new Date(),
      changedBy: req.user?._id,
      reason: `POS payment completed via ${paymentMethod.toUpperCase()}`,
    });

    await order.save();

    // Release table if Dine-in
    if (order.tableNumber > 0) {
      await Table.updateOne({ tableNumber: order.tableNumber }, { $set: { status: 'AVAILABLE' } });
    }

    // Deduct inventory & award loyalty
    try {
      await confirmOrderAndDeduct(order, req.tenantId);
      await awardLoyaltyPoints(order, req.tenantId);
    } catch (_err) {
      // Stock deduction/loyalty failure on payment does not block receipt
    }

    try {
      publishOrderUpdate(order);
    } catch (_err) {
      // SSE broadcast failure ignored
    }

    const receipt = await createReceiptData({
      orders: [order],
      tableNumber: order.tableNumber,
      tenantSettings: req.tenant?.settings,
    });

    return res.json({ success: true, order, receipt });
  } catch (error) {
    next(error);
  }
});

// POST /api/pos/sync — Bulk Sync for Offline Orders from IndexedDB
router.post('/sync', protect, orderReaders, async (req, res, next) => {
  try {
    const { orders = [] } = req.body || {};
    if (!Array.isArray(orders) || orders.length === 0) {
      return res.json({ success: true, synced: [], failed: [] });
    }

    const synced = [];
    const failed = [];

    for (const item of orders) {
      try {
        const syncId = item.syncId || item.idempotencyKey;
        if (!syncId) {
          failed.push({ item, reason: 'Missing syncId' });
          continue;
        }

        const existing = await Order.findOne({ 'posMetadata.offlineSyncId': syncId });
        if (existing) {
          synced.push({ syncId, orderId: existing._id, alreadySynced: true });
          continue;
        }

        // Process single order
        const validatedItems = await validateAndFetchProductPrices(item.items, Product, req.tenantId);
        const subtotal = validatedItems.reduce((sum, i) => sum + i.itemTotal, 0);
        const taxRate = Number(req.tenant?.settings?.taxRate ?? 5);
        const tax = Number(((subtotal * taxRate) / 100).toFixed(2));
        const total = Number((subtotal + tax).toFixed(2));

        const prefix = req.tenant?.settings?.gstSettings?.invoicePrefix || 'INV';
        const invoiceNumber = await getNextInvoiceNumber(req.tenantId, prefix);

        const accessToken = generateOrderAccessToken();
        const order = await Order.create({
          tenantId: req.tenantId,
          orderType: item.orderType || 'counter',
          tableNumber: Number(item.tableNumber) || 0,
          customer: {
            name: item.customer?.name || 'Walk-in Customer',
            phone: item.customer?.phone || '9999999999',
          },
          items: validatedItems,
          subtotal,
          discount: item.discount || 0,
          tax,
          total,
          taxRate,
          paymentMethod: item.paymentMethod || 'cash',
          paymentStatus: 'paid',
          orderStatus: 'completed',
          gstDetails: {
            invoiceNumber,
            invoiceDate: new Date(),
          },
          posMetadata: {
            cashierId: req.user?._id,
            offlineSynced: true,
            offlineSyncId: syncId,
          },
          accessTokenHash: hashAccessToken(accessToken),
        });

        try {
          await confirmOrderAndDeduct(order, req.tenantId);
        } catch (_err) {
          // Stock deduction failure on offline sync should not prevent recording order
        }

        synced.push({ syncId, orderId: order._id });
      } catch (err) {
        failed.push({ item, reason: err.message });
      }
    }

    return res.json({ success: true, synced, failed });
  } catch (error) {
    next(error);
  }
});

// GET /api/pos/recent — Recent 20 POS Orders
router.get('/recent', protect, orderReaders, async (req, res, next) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return res.json({ success: true, orders });
  } catch (error) {
    next(error);
  }
});

export default router;
