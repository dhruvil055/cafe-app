import express from 'express';
import mongoose from 'mongoose';
import { protect, staffOrAdmin, adminOnly } from '../middleware/auth.js';
import InventoryCategory from '../models/InventoryCategory.js';
import InventoryItem, { INVENTORY_UNITS } from '../models/InventoryItem.js';
import MenuInventoryMapping from '../models/MenuInventoryMapping.js';
import InventoryTransaction, { TRANSACTION_TYPES } from '../models/InventoryTransaction.js';
import Product from '../models/Product.js';
import {
  checkAvailability,
  getInventoryStats,
  syncProductAvailability,
} from '../services/inventoryService.js';

const router = express.Router();

// ─── PUBLIC ────────────────────────────────────────────────────────────────────

/**
 * GET /api/inventory/availability
 * Returns { productId: maxOrderableQty } for all active products.
 * Used by customer menu to show availability.
 */
router.get('/availability', async (req, res) => {
  try {
    const products = await Product.find({ available: true }).select('_id').lean();
    const productIds = products.map(p => p._id);
    const availability = await checkAvailability(productIds);

    // Convert Infinity to null for JSON (means "unlimited / no inventory constraint")
    const result = {};
    for (const [id, qty] of Object.entries(availability)) {
      result[id] = qty === Infinity ? null : qty;
    }

    return res.json({ availability: result });
  } catch (error) {
    console.error('Availability check error:', error);
    return res.status(500).json({ error: 'Failed to check inventory availability.' });
  }
});

// ─── ADMIN MIDDLEWARE ───────────────────────────────────────────────────────────
// All routes below require authentication
router.use(protect, staffOrAdmin);

// ─── DASHBOARD ──────────────────────────────────────────────────────────────────

/**
 * GET /api/inventory/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await getInventoryStats();

    // Recent low/out-of-stock items
    const alerts = await InventoryItem.find({
      active: true,
      $expr: { $lte: ['$currentQuantity', '$minimumStock'] },
    })
      .populate('category', 'name icon')
      .sort({ currentQuantity: 1 })
      .limit(10)
      .lean();

    // Today's consumption summary
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const consumption = await InventoryTransaction.aggregate([
      { $match: { type: 'order_consumption', createdAt: { $gte: today } } },
      {
        $group: {
          _id: '$inventoryItem',
          totalConsumed: { $sum: { $abs: '$quantity' } },
        },
      },
      {
        $lookup: {
          from: 'inventoryitems',
          localField: '_id',
          foreignField: '_id',
          as: 'item',
        },
      },
      { $unwind: '$item' },
      { $sort: { totalConsumed: -1 } },
      { $limit: 10 },
    ]);

    return res.json({ stats, alerts, todayConsumption: consumption });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

// ─── CATEGORIES ─────────────────────────────────────────────────────────────────

router.get('/categories', async (req, res) => {
  try {
    let categories = await InventoryCategory.find().sort({ sortOrder: 1, name: 1 }).lean();
    if (categories.length === 0) {
      const defaults = [
        { name: 'Beverage', icon: '🥤', sortOrder: 1 },
        { name: 'Disposable', icon: '📦', sortOrder: 2 },
        { name: 'Packaging', icon: '🥡', sortOrder: 3 },
        { name: 'Cutlery', icon: '🍴', sortOrder: 4 },
        { name: 'Takeaway', icon: '🛍️', sortOrder: 5 },
        { name: 'Condiments', icon: '🧂', sortOrder: 6 },
      ];
      try {
        await InventoryCategory.insertMany(defaults, { ordered: false });
      } catch (_) {}
      categories = await InventoryCategory.find().sort({ sortOrder: 1, name: 1 }).lean();
    }
    return res.json({ categories });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/categories', adminOnly, async (req, res) => {
  try {
    const { name, description, icon, sortOrder } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Category name is required.' });
    const category = await InventoryCategory.create({ name: name.trim(), description, icon, sortOrder });
    return res.status(201).json({ category });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Category name already exists.' });
    return res.status(400).json({ error: error.message });
  }
});

router.put('/categories/:id', adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID.' });
    const { name, description, icon, sortOrder, active } = req.body;
    const category = await InventoryCategory.findByIdAndUpdate(
      req.params.id,
      { $set: { name, description, icon, sortOrder, active } },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ error: 'Category not found.' });
    return res.json({ category });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// ─── ITEMS ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/inventory/items
 * Query: ?category=&status=in_stock|low_stock|out_of_stock&search=&page=1&limit=50
 */
router.get('/items', async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 100 } = req.query;
    const query = { active: true };

    if (category && mongoose.isValidObjectId(category)) query.category = category;

    if (status === 'out_of_stock') query.currentQuantity = { $lte: 0 };
    else if (status === 'low_stock') query.$expr = {
      $and: [
        { $gt: ['$currentQuantity', 0] },
        { $gt: ['$minimumStock', 0] },
        { $lte: ['$currentQuantity', '$minimumStock'] },
      ],
    };
    else if (status === 'in_stock') query.$expr = {
      $or: [
        { $gt: ['$currentQuantity', '$minimumStock'] },
        { $eq: ['$minimumStock', 0] },
      ],
    };

    if (search) {
      query.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      InventoryItem.find(query)
        .populate('category', 'name icon')
        .sort({ currentQuantity: 1, name: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean({ virtuals: true }),
      InventoryItem.countDocuments(query),
    ]);

    return res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/inventory/items — Create inventory item
 */
router.post('/items', adminOnly, async (req, res) => {
  try {
    const {
      name, sku, category, unit, currentQuantity,
      minimumStock, maximumStock, reorderLevel,
      costPerUnit, supplier, description,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Item name is required.' });

    // Flexible category resolution: can be an existing category ID or a category name (e.g. "Beverage", "Disposable", "Packaging")
    let categoryId = null;
    if (category && mongoose.isValidObjectId(category)) {
      categoryId = category;
    } else if (typeof category === 'string' && category.trim()) {
      const catName = category.trim();
      let cat = await InventoryCategory.findOne({ name: new RegExp(`^${catName}$`, 'i') });
      if (!cat) {
        cat = await InventoryCategory.create({ name: catName, icon: '📦' });
      }
      categoryId = cat._id;
    } else {
      let cat = await InventoryCategory.findOne({ name: /disposable/i });
      if (!cat) {
        cat = await InventoryCategory.create({ name: 'Disposable', icon: '📦' });
      }
      categoryId = cat._id;
    }

    const cleanUnit = (unit && String(unit).trim()) ? String(unit).trim() : 'Piece';
    const qty = Number(currentQuantity) || 0;
    const item = await InventoryItem.create({
      name: name.trim(),
      sku: sku ? String(sku).trim() : '',
      category: categoryId,
      unit: cleanUnit,
      currentQuantity: qty,
      minimumStock: Number(minimumStock) || 0,
      maximumStock: maximumStock != null && !isNaN(Number(maximumStock)) ? Number(maximumStock) : null,
      reorderLevel: Number(reorderLevel) || 0,
      costPerUnit: Number(costPerUnit) || 0,
      supplier: supplier ? String(supplier).trim() : '',
      description: description ? String(description).trim() : '',
    });

    // Create initial stock transaction if opening qty > 0
    if (qty > 0) {
      await InventoryTransaction.create({
        inventoryItem: item._id,
        type: 'stock_added',
        quantity: qty,
        balanceBefore: 0,
        balanceAfter: qty,
        reference: 'Opening Stock',
        reason: 'Opening physical stock on creation',
        performedBy: req.user._id,
      });
    }

    await item.populate('category', 'name icon');
    return res.status(201).json({ item: item.toJSON() });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/inventory/items/:id — Item detail with recent transactions
 */
router.get('/items/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID.' });

    const item = await InventoryItem.findById(req.params.id)
      .populate('category', 'name icon')
      .lean({ virtuals: true });
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const [consumptionStats, transactions] = await Promise.all([
      InventoryTransaction.aggregate([
        { $match: { inventoryItem: item._id, type: 'order_consumption' } },
        {
          $group: {
            _id: null,
            today: { $sum: { $cond: [{ $gte: ['$createdAt', startOfDay] }, { $abs: '$quantity' }, 0] } },
            thisWeek: { $sum: { $cond: [{ $gte: ['$createdAt', startOfWeek] }, { $abs: '$quantity' }, 0] } },
            thisMonth: { $sum: { $cond: [{ $gte: ['$createdAt', startOfMonth] }, { $abs: '$quantity' }, 0] } },
          },
        },
      ]),
      InventoryTransaction.find({ inventoryItem: item._id })
        .populate('performedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    return res.json({
      item,
      consumption: consumptionStats[0] || { today: 0, thisWeek: 0, thisMonth: 0 },
      transactions,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/inventory/items/:id — Update item metadata (not stock quantity)
 */
router.put('/items/:id', adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID.' });
    const allowed = ['name', 'sku', 'category', 'unit', 'minimumStock', 'maximumStock', 'reorderLevel', 'costPerUnit', 'supplier', 'description', 'active'];
    const update = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }
    const item = await InventoryItem.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
      .populate('category', 'name icon')
      .lean({ virtuals: true });
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    return res.json({ item });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/inventory/items/:id — Soft-delete (deactivate)
 */
router.delete('/items/:id', adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID.' });
    const item = await InventoryItem.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    return res.json({ message: 'Item deactivated.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── STOCK OPERATIONS ──────────────────────────────────────────────────────────

/**
 * POST /api/inventory/stock/add — Add physical stock
 */
router.post('/stock/add', async (req, res) => {
  try {
    const { itemId, quantity, costPerUnit, supplier, reason, notes } = req.body;
    if (!mongoose.isValidObjectId(itemId)) return res.status(400).json({ error: 'Valid item ID required.' });

    const qty = Number(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantity must be positive.' });

    const item = await InventoryItem.findOneAndUpdate(
      { _id: itemId, active: true },
      { $inc: { currentQuantity: qty } },
      { new: true }
    ).lean({ virtuals: true });
    if (!item) return res.status(404).json({ error: 'Inventory item not found.' });

    const balanceBefore = Number((item.currentQuantity - qty).toFixed(6));

    if (costPerUnit != null && !isNaN(Number(costPerUnit))) {
      await InventoryItem.findByIdAndUpdate(itemId, { costPerUnit: Number(costPerUnit) });
    }
    if (supplier?.trim()) {
      await InventoryItem.findByIdAndUpdate(itemId, { supplier: supplier.trim() });
    }

    const txn = await InventoryTransaction.create({
      inventoryItem: itemId,
      type: 'stock_added',
      quantity: qty,
      balanceBefore,
      balanceAfter: item.currentQuantity,
      reference: 'Stock Added',
      reason: reason?.trim() || 'Manual stock addition',
      notes: notes?.trim() || '',
      performedBy: req.user._id,
    });

    // Recheck product availability (automatically marks product available again)
    const mappings = await MenuInventoryMapping.find({ inventoryItem: itemId }).distinct('product');
    await syncProductAvailability(mappings);

    return res.json({ item, transaction: txn });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/inventory/stock/remove — Remove physical stock (damaged, lost, expired, manual correction)
 */
router.post('/stock/remove', async (req, res) => {
  try {
    const { itemId, quantity, reason, notes } = req.body;
    if (!mongoose.isValidObjectId(itemId)) return res.status(400).json({ error: 'Valid item ID required.' });

    const qty = Number(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantity must be a positive number.' });
    if (!reason?.trim()) return res.status(400).json({ error: 'Reason is required (e.g. Damaged, Lost, Expired, Manual correction).' });

    const currentItem = await InventoryItem.findById(itemId);
    if (!currentItem || !currentItem.active) return res.status(404).json({ error: 'Inventory item not found.' });

    const balanceBefore = currentItem.currentQuantity;
    if (balanceBefore < qty) {
      return res.status(400).json({ error: `Cannot remove ${qty}. Current stock is only ${balanceBefore}.` });
    }

    const newQty = Math.max(0, balanceBefore - qty);
    const updated = await InventoryItem.findByIdAndUpdate(
      itemId,
      { currentQuantity: newQty },
      { new: true }
    ).populate('category', 'name icon').lean({ virtuals: true });

    const cleanReason = reason.trim().toLowerCase();
    let txnType = 'manual_removal';
    if (cleanReason.includes('damage')) txnType = 'damaged';
    else if (cleanReason.includes('lost')) txnType = 'lost';
    else if (cleanReason.includes('expire')) txnType = 'expired';
    else if (cleanReason.includes('waste')) txnType = 'waste';

    const txn = await InventoryTransaction.create({
      inventoryItem: itemId,
      type: txnType,
      quantity: -qty,
      balanceBefore,
      balanceAfter: newQty,
      reference: 'Manual Removal',
      reason: reason.trim(),
      notes: notes?.trim() || '',
      performedBy: req.user._id,
    });

    // Recheck product availability (if stock hit 0, product becomes out of stock automatically)
    const mappings = await MenuInventoryMapping.find({ inventoryItem: itemId }).distinct('product');
    await syncProductAvailability(mappings);

    return res.json({ item: updated, transaction: txn });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/inventory/stock/adjust — Manual adjustment
 */
router.post('/stock/adjust', async (req, res) => {
  try {
    const { itemId, adjustment, reason, notes } = req.body;
    if (!mongoose.isValidObjectId(itemId)) return res.status(400).json({ error: 'Valid item ID required.' });

    const adj = Number(adjustment);
    if (adj === 0 || isNaN(adj)) return res.status(400).json({ error: 'Adjustment must be a non-zero number.' });
    if (adj < 0 && !reason?.trim()) return res.status(400).json({ error: 'Reason is required for negative adjustments.' });

    const item = await InventoryItem.findById(itemId);
    if (!item || !item.active) return res.status(404).json({ error: 'Item not found.' });

    const balanceBefore = item.currentQuantity;
    const newQty = Math.max(0, balanceBefore + adj);

    await InventoryItem.findByIdAndUpdate(itemId, { currentQuantity: newQty });

    const txn = await InventoryTransaction.create({
      inventoryItem: itemId,
      type: 'adjustment',
      quantity: adj,
      balanceBefore,
      balanceAfter: newQty,
      reason: reason || 'Manual adjustment',
      notes,
      performedBy: req.user._id,
    });

    const mappings = await MenuInventoryMapping.find({ inventoryItem: itemId }).distinct('product');
    await syncProductAvailability(mappings);

    const updatedItem = await InventoryItem.findById(itemId).populate('category', 'name icon').lean({ virtuals: true });
    return res.json({ item: updatedItem, transaction: txn });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/inventory/stock/waste — Record waste/damage
 */
router.post('/stock/waste', async (req, res) => {
  try {
    const { itemId, quantity, type = 'waste', reason, notes } = req.body;
    if (!mongoose.isValidObjectId(itemId)) return res.status(400).json({ error: 'Valid item ID required.' });

    const qty = Number(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantity must be positive.' });
    if (!['waste', 'damaged'].includes(type)) return res.status(400).json({ error: 'Type must be waste or damaged.' });
    if (!reason?.trim()) return res.status(400).json({ error: 'Reason is required for waste recording.' });

    const item = await InventoryItem.findById(itemId);
    if (!item || !item.active) return res.status(404).json({ error: 'Item not found.' });

    const balanceBefore = item.currentQuantity;
    const newQty = Math.max(0, balanceBefore - qty);
    await InventoryItem.findByIdAndUpdate(itemId, { currentQuantity: newQty });

    const txn = await InventoryTransaction.create({
      inventoryItem: itemId,
      type,
      quantity: -qty,
      balanceBefore,
      balanceAfter: newQty,
      reason,
      notes,
      performedBy: req.user._id,
    });

    const mappings = await MenuInventoryMapping.find({ inventoryItem: itemId }).distinct('product');
    await syncProductAvailability(mappings);

    return res.json({ transaction: txn, newQuantity: newQty });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// ─── MAPPINGS (RECIPES) ─────────────────────────────────────────────────────────

/**
 * GET /api/inventory/mappings — All mappings
 */
router.get('/mappings', async (req, res) => {
  try {
    const mappings = await MenuInventoryMapping.find()
      .populate('product', 'name image')
      .populate('inventoryItem', 'name unit currentQuantity')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ mappings });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/inventory/mappings/:productId — Mappings for a specific menu item
 */
router.get('/mappings/:productId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.productId)) return res.status(400).json({ error: 'Invalid product ID.' });
    const mappings = await MenuInventoryMapping.find({ product: req.params.productId })
      .populate('inventoryItem', 'name unit currentQuantity minimumStock')
      .lean();
    return res.json({ mappings });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/inventory/mappings — Create a mapping
 */
router.post('/mappings', adminOnly, async (req, res) => {
  try {
    const { productId, inventoryItemId, quantityRequired, notes } = req.body;
    if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ error: 'Valid product ID required.' });
    if (!mongoose.isValidObjectId(inventoryItemId)) return res.status(400).json({ error: 'Valid inventory item ID required.' });
    const qty = Number(quantityRequired);
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantity must be positive.' });

    const [product, invItem] = await Promise.all([
      Product.findById(productId),
      InventoryItem.findById(inventoryItemId),
    ]);
    if (!product) return res.status(404).json({ error: 'Menu item not found.' });
    if (!invItem) return res.status(404).json({ error: 'Inventory item not found.' });

    const mapping = await MenuInventoryMapping.create({
      product: productId,
      inventoryItem: inventoryItemId,
      quantityRequired: qty,
      notes,
    });
    await mapping.populate([
      { path: 'product', select: 'name image' },
      { path: 'inventoryItem', select: 'name unit currentQuantity' },
    ]);
    return res.status(201).json({ mapping });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'This inventory item is already mapped to this menu item.' });
    return res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/inventory/mappings/:id — Update mapping
 */
router.put('/mappings/:id', adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID.' });
    const { quantityRequired, active, notes } = req.body;
    const update = {};
    if (quantityRequired != null) {
      const qty = Number(quantityRequired);
      if (qty <= 0) return res.status(400).json({ error: 'Quantity must be positive.' });
      update.quantityRequired = qty;
    }
    if (active !== undefined) update.active = Boolean(active);
    if (notes !== undefined) update.notes = notes;

    const mapping = await MenuInventoryMapping.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
      .populate([
        { path: 'product', select: 'name image' },
        { path: 'inventoryItem', select: 'name unit currentQuantity' },
      ]);
    if (!mapping) return res.status(404).json({ error: 'Mapping not found.' });
    return res.json({ mapping });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/inventory/mappings/:id — Delete mapping
 */
router.delete('/mappings/:id', adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID.' });
    const mapping = await MenuInventoryMapping.findByIdAndDelete(req.params.id);
    if (!mapping) return res.status(404).json({ error: 'Mapping not found.' });
    return res.json({ message: 'Mapping deleted.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── TRANSACTIONS ───────────────────────────────────────────────────────────────

/**
 * GET /api/inventory/transactions
 * Query: ?itemId=&type=&page=1&limit=50&from=&to=
 */
router.get('/transactions', async (req, res) => {
  try {
    const { itemId, type, page = 1, limit = 50, from, to } = req.query;
    const query = {};

    if (itemId && mongoose.isValidObjectId(itemId)) query.inventoryItem = itemId;
    if (type && TRANSACTION_TYPES.includes(type)) query.type = type;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); query.createdAt.$lte = end; }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [transactions, total] = await Promise.all([
      InventoryTransaction.find(query)
        .populate('inventoryItem', 'name unit')
        .populate('performedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      InventoryTransaction.countDocuments(query),
    ]);

    return res.json({ transactions, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── REPORTS ────────────────────────────────────────────────────────────────────

/**
 * GET /api/inventory/reports/consumption
 * Query: ?period=today|yesterday|week|month  or  ?from=&to=
 */
router.get('/reports/consumption', async (req, res) => {
  try {
    const { period, from, to } = req.query;
    const now = new Date();
    let startDate, endDate = new Date();

    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case 'yesterday': {
          startDate = new Date(now); startDate.setDate(now.getDate() - 1); startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate); endDate.setHours(23, 59, 59, 999);
          break;
        }
        case 'week': {
          startDate = new Date(now); startDate.setDate(now.getDate() - 7); startDate.setHours(0, 0, 0, 0);
          break;
        }
        case 'month': {
          startDate = new Date(now); startDate.setDate(1); startDate.setHours(0, 0, 0, 0);
          break;
        }
        default: { // today
          startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
        }
      }
    }

    const consumption = await InventoryTransaction.aggregate([
      { $match: { type: 'order_consumption', createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$inventoryItem', totalConsumed: { $sum: { $abs: '$quantity' } }, txnCount: { $sum: 1 } } },
      { $lookup: { from: 'inventoryitems', localField: '_id', foreignField: '_id', as: 'item' } },
      { $unwind: '$item' },
      { $lookup: { from: 'inventorycategories', localField: 'item.category', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: '$item.name', unit: '$item.unit', costPerUnit: { $ifNull: ['$item.costPerUnit', 0] },
          category: '$category.name', totalConsumed: 1, txnCount: 1,
          estimatedCost: { $multiply: ['$totalConsumed', { $ifNull: ['$item.costPerUnit', 0] }] },
        },
      },
      { $sort: { totalConsumed: -1 } },
    ]);

    return res.json({ consumption, period: period || 'today', from: startDate, to: endDate });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
