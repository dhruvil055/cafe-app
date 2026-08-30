import express from 'express';
import Product from '../models/Product.js';
import { adminOnly, protect, staffOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/menu — public
router.get('/', async (req, res) => {
  try {
    const { category, search, sort, popular } = req.query;
    let query = {};

    if (category && category !== 'all') query.category = category;
    if (popular === 'true') query.popular = true;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') sortObj = { price: 1 };
    if (sort === 'price_desc') sortObj = { price: -1 };
    if (sort === 'popular') sortObj = { popular: -1, rating: -1 };

    const products = await Product.find(query)
      .populate('category', 'name icon')
      .sort(sortObj);

    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/menu/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name icon');
    if (!product) return res.status(404).json({ error: 'Item not found.' });
    res.json({ product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/menu — admin/staff
router.post('/', protect, staffOrAdmin, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    await product.populate('category', 'name icon');
    res.status(201).json({ product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/menu/:id — admin/staff
router.put('/:id', protect, staffOrAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true
    }).populate('category', 'name icon');
    if (!product) return res.status(404).json({ error: 'Item not found.' });
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
    res.json({ message: 'Item deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
