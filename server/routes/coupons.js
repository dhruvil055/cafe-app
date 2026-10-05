import express from 'express';
import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import Product from '../models/Product.js';
import { ownerOrManager, protect } from '../middleware/auth.js';
import { calculateCouponDiscount, findAvailableCoupon, normalizeCouponCode } from '../services/couponService.js';
import { calculateServerTotals, validateAndFetchProductPrices } from '../utils/orderSecurity.js';

const router = express.Router();
const dateOrNull = (value) => value ? new Date(value) : null;

router.post('/validate', async (req, res) => {
  try {
    if (!Array.isArray(req.body.items) || req.body.items.length === 0) return res.status(400).json({ error: 'Cart items are required.' });
    const items = await validateAndFetchProductPrices(req.body.items, Product);
    const taxRate = Number(req.tenant.settings?.taxRate ?? 5);
    const { subtotal } = calculateServerTotals(items, taxRate);
    const coupon = await findAvailableCoupon(req.body.code);
    if (!coupon) return res.status(404).json({ error: 'Coupon is invalid, expired, or fully redeemed.' });
    if (subtotal < coupon.minimumSubtotal) return res.status(400).json({ error: `Minimum cart subtotal is ₹${coupon.minimumSubtotal}.` });
    const discount = calculateCouponDiscount(coupon, subtotal);
    const taxableSubtotal = Number((subtotal - discount).toFixed(2));
    const tax = Number((taxableSubtotal * taxRate / 100).toFixed(2));
    return res.json({ code: coupon.code, description: coupon.description, discount, subtotal, tax, total: Number((taxableSubtotal + tax).toFixed(2)) });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unable to validate coupon.' });
  }
});

router.get('/', protect, ownerOrManager, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.json({ coupons });
  } catch {
    res.status(500).json({ error: 'Unable to load coupons.' });
  }
});

router.post('/', protect, ownerOrManager, async (req, res) => {
  try {
    const { code, description = '', discountType, value, minimumSubtotal = 0, maximumDiscount, startsAt, endsAt, maxUses } = req.body;
    const normalized = normalizeCouponCode(code);
    if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) return res.status(400).json({ error: 'Code must be 3–32 letters, numbers, hyphens, or underscores.' });
    if (!['percent', 'fixed'].includes(discountType) || !Number.isFinite(Number(value)) || Number(value) <= 0 || (discountType === 'percent' && Number(value) > 100)) {
      return res.status(400).json({ error: 'Enter a valid discount type and value.' });
    }
    const start = dateOrNull(startsAt) || new Date();
    const end = dateOrNull(endsAt);
    if (Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end <= start))) return res.status(400).json({ error: 'End date must be after the start date.' });
    const coupon = await Coupon.create({ code: normalized, description: String(description).slice(0, 200), discountType, value: Number(value), minimumSubtotal: Number(minimumSubtotal) || 0, maximumDiscount: maximumDiscount === '' || maximumDiscount == null ? null : Number(maximumDiscount), startsAt: start, endsAt: end, maxUses: maxUses === '' || maxUses == null ? null : Number(maxUses) });
    res.status(201).json({ coupon });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ error: error.code === 11000 ? 'Coupon code already exists.' : error.message });
  }
});

router.put('/:id', protect, ownerOrManager, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid coupon ID.' });
    const allowed = ['description', 'discountType', 'value', 'minimumSubtotal', 'maximumDiscount', 'startsAt', 'endsAt', 'maxUses', 'active'];
    const update = {};
    for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!coupon) return res.status(404).json({ error: 'Coupon not found.' });
    res.json({ coupon });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', protect, ownerOrManager, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid coupon ID.' });
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found.' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Unable to delete coupon.' });
  }
});

export default router;
