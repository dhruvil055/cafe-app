import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { adminOnly, ownerOrManager, protect } from '../middleware/auth.js';
import { checkMenuItemLimit } from '../middleware/planLimits.js';
import { escapeRegex } from '../utils/orderSecurity.js';
import { checkAvailability } from '../services/inventoryService.js';
import { openLiveStream, publishLiveUpdate } from '../services/liveUpdates.js';
import { isProductScheduledAvailable } from '../utils/productAvailability.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = express.Router();

// In-memory cache for public menu queries (20s TTL for fast responses and low DB load)
const menuCache = new Map();
const CACHE_TTL_MS = 20 * 1000;

router.get('/events', (req, res) => openLiveStream(req, res, 'menu'));

export const clearMenuCache = () => {
  menuCache.clear();
};

// GET /api/menu — public
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-cache');
    res.set('Vary', 'X-Tenant-Slug, X-Tenant-Id, X-Table-Token, Origin');
    const { category, search, sort, popular } = req.query;

    // Check memory cache for identical query scoped by tenant
    const cacheKey = JSON.stringify({ tenantId: String(req.tenantId || ''), category, search, sort, popular });
    const cached = menuCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return res.json(cached.data);
    }

    let query = {};

    if (category && category !== 'all') query.category = category;
    if (popular === 'true') query.popular = true;
    if (search) {
      // SECURITY: Escape regex special characters and limit search length
      if (String(search).length > 100) {
        return res.status(400).json({ error: 'Search query is too long.' });
      }
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') sortObj = { price: 1 };
    if (sort === 'price_desc') sortObj = { price: -1 };
    if (sort === 'popular') sortObj = { popular: -1, rating: -1 };

    const products = await Product.find(query)
      .populate('category', 'name icon')
      .sort(sortObj)
      .lean();

    // Attach inventory availability to each product
    let availability = {};
    try {
      const productIds = products.map(p => p._id);
      availability = await checkAvailability(productIds);
    } catch (err) {
      // Non-fatal: if inventory check fails, don't break the menu
      console.error('[Inventory] Availability check failed:', err.message);
    }

    const productsWithAvailability = products.map(p => {
      const maxQty = availability[String(p._id)];
      // null = no inventory mapping (unlimited), 0 = out of stock
      return {
        ...p,
        scheduledAvailable: isProductScheduledAvailable(p),
        maxOrderableQty: maxQty === Infinity ? null : (maxQty ?? null),
        inventoryAvailable: maxQty === undefined || maxQty === Infinity || maxQty > 0,
      };
    });

    const responsePayload = { products: productsWithAvailability };
    // Keep cache size bounded
    if (menuCache.size > 100) menuCache.clear();
    menuCache.set(cacheKey, { timestamp: Date.now(), data: responsePayload });

    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET /api/menu/:id
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID.' });
    }
    const product = await Product.findById(req.params.id).populate('category', 'name icon');
    if (!product) return res.status(404).json({ error: 'Item not found.' });
    res.json({ product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/menu — admin/staff
// SECURITY: Mass assignment protection - explicit field allowlist
router.post('/', protect, ownerOrManager, checkMenuItemLimit, async (req, res) => {
  try {
    const allowedFields = ['name', 'description', 'price', 'image', 'category', 'available', 'availableFrom', 'availableUntil', 'popular', 'variants', 'addons', 'prepTime'];
    const update = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        update[field] = req.body[field];
      }
    }

    const product = await Product.create(update);
    await product.populate('category', 'name icon');
    await writeAuditLog({ actor: req.user, action: 'menu.product_created', targetType: 'Product', targetId: product._id, details: { name: product.name, price: product.price } });
    clearMenuCache();
    publishLiveUpdate('menu', 'availability', { productId: String(product._id), available: product.available });
    res.status(201).json({ product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/menu/:id — admin/staff
// SECURITY: Mass assignment protection - explicit field allowlist
router.put('/:id', protect, ownerOrManager, async (req, res) => {
  try {
    const allowedFields = ['name', 'description', 'price', 'image', 'category', 'available', 'availableFrom', 'availableUntil', 'popular', 'variants', 'addons', 'prepTime'];
    const update = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        update[field] = req.body[field];
      }
    }

    const before = await Product.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ error: 'Item not found.' });
    const startsAt = Object.prototype.hasOwnProperty.call(update, 'availableFrom') ? update.availableFrom : before.availableFrom;
    const endsAt = Object.prototype.hasOwnProperty.call(update, 'availableUntil') ? update.availableUntil : before.availableUntil;
    if (startsAt && Number.isNaN(new Date(startsAt).getTime())) return res.status(400).json({ error: 'Availability start time is invalid.' });
    if (endsAt && Number.isNaN(new Date(endsAt).getTime())) return res.status(400).json({ error: 'Availability end time is invalid.' });
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) return res.status(400).json({ error: 'Availability must end after it starts.' });
    const product = await Product.findByIdAndUpdate(req.params.id, update, {
      new: true, runValidators: true
    }).populate('category', 'name icon');
    if (!product) return res.status(404).json({ error: 'Item not found.' });
    if (['price', 'variants', 'addons'].some((field) => Object.prototype.hasOwnProperty.call(update, field))) {
      const beforePrice = { price: before.price, variants: before.variants || [], addons: before.addons || [] };
      const afterPrice = { price: product.price, variants: product.variants || [], addons: product.addons || [] };
      if (JSON.stringify(beforePrice) !== JSON.stringify(afterPrice)) {
        await writeAuditLog({ actor: req.user, action: 'menu.price_changed', targetType: 'Product', targetId: product._id, details: { before: beforePrice, after: afterPrice } });
      }
    }
    clearMenuCache();
    if (Object.prototype.hasOwnProperty.call(update, 'available')) {
      publishLiveUpdate('menu', 'availability', { productId: String(product._id), available: product.available });
    }
    res.json({ product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/menu/:id — admin
router.delete('/:id', protect, ownerOrManager, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Item not found.' });
    await writeAuditLog({ actor: req.user, action: 'menu.product_deleted', targetType: 'Product', targetId: product._id, details: { name: product.name } });
    clearMenuCache();
    publishLiveUpdate('menu', 'removed', { productId: String(product._id) });
    res.json({ message: 'Item deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
