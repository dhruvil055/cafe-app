import Coupon from '../models/Coupon.js';

export const normalizeCouponCode = (value) => String(value || '').trim().toUpperCase();

export const findAvailableCoupon = async (code, now = new Date()) => {
  const normalizedCode = normalizeCouponCode(code);
  if (!/^[A-Z0-9_-]{3,32}$/.test(normalizedCode)) return null;
  return Coupon.findOne({
    code: normalizedCode,
    active: true,
    startsAt: { $lte: now },
    $and: [
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
      { $or: [{ maxUses: null }, { $expr: { $lt: ['$usageCount', '$maxUses'] } }] },
    ],
  });
};

export const calculateCouponDiscount = (coupon, subtotal) => {
  if (subtotal < coupon.minimumSubtotal) return 0;
  const raw = coupon.discountType === 'percent' ? subtotal * coupon.value / 100 : coupon.value;
  const capped = coupon.maximumDiscount == null ? raw : Math.min(raw, coupon.maximumDiscount);
  return Math.min(subtotal, Number(capped.toFixed(2)));
};

export const claimCoupon = async (coupon, session) => {
  const now = new Date();
  const query = {
    _id: coupon._id,
    active: true,
    startsAt: { $lte: now },
    $and: [
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
      { $or: [{ maxUses: null }, { $expr: { $lt: ['$usageCount', '$maxUses'] } }] },
    ],
  };
  return Coupon.findOneAndUpdate(query, { $inc: { usageCount: 1 } }, { new: true, session });
};
