import express from 'express';
import Category from '../models/Category.js';
import { adminOnly, protect, staffOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/categories — public
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ active: true }).sort({ sortOrder: 1, name: 1 });
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all (admin/staff)
router.get('/all', protect, staffOrAdmin, async (req, res) => {
  try {
    const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/categories — admin/staff
router.post('/', protect, staffOrAdmin, async (req, res) => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json({ category });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/categories/:id — admin/staff
router.put('/:id', protect, staffOrAdmin, async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true
    });
    if (!category) return res.status(404).json({ error: 'Category not found.' });
    res.json({ category });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/categories/:id — admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found.' });
    res.json({ message: 'Category deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
