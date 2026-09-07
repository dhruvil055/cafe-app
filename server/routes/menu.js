import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { adminOnly, protect, staffOrAdmin } from '../middleware/auth.js';
import { escapeRegex } from '../utils/orderSecurity.js';
import { checkAvailability } from '../services/inventoryService.js';

const router = express.Router();

// In-memory cache for public menu queries (20s TTL for fast responses and low DB load)
const menuCache = new Map();
const CACHE_TTL_MS = 20 * 1000;

export const clearMenuCache = () => {
  menuCache.clear();
};

// GET /api/menu — public
router.get('/', async (req, res) => {
  try {
    const { category, search, sort, popular } = req.query;

    // Check memory cache for identical query
    const cacheKey = JSON.stringify({ category, search, sort, popular });
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
router.post('/', protect, staffOrAdmin, async (req, res) => {
  try {
    const allowedFields = ['name', 'description', 'price', 'image', 'category', 'available', 'popular', 'variants', 'addons', 'prepTime'];
    const update = {};
    for (const field of allowedFields) {
      if (req.body.hasOwnProperty(field)) {
        update[field] = req.body[field];
      }
    }

    const product = await Product.create(update);
    await product.populate('category', 'name icon');
    clearMenuCache();
    res.status(201).json({ product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/menu/:id — admin/staff
// SECURITY: Mass assignment protection - explicit field allowlist
router.put('/:id', protect, staffOrAdmin, async (req, res) => {
  try {
    const allowedFields = ['name', 'description', 'price', 'image', 'category', 'available', 'popular', 'variants', 'addons', 'prepTime'];
    const update = {};
    for (const field of allowedFields) {
      if (req.body.hasOwnProperty(field)) {
        update[field] = req.body[field];
      }
    }

    const product = await Product.findByIdAndUpdate(req.params.id, update, {
      new: true, runValidators: true
    }).populate('category', 'name icon');
    if (!product) return res.status(404).json({ error: 'Item not found.' });
    clearMenuCache();
    res.json({ product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/menu/:id — admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Item not found.' });
    clearMenuCache();
    res.json({ message: 'Item deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
