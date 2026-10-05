import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true, minlength: 3, maxlength: 32 },
  description: { type: String, default: '', trim: true, maxlength: 200 },
  discountType: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true, min: 0.01 },
  minimumSubtotal: { type: Number, default: 0, min: 0 },
  maximumDiscount: { type: Number, default: null, min: 0 },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date, default: null },
  maxUses: { type: Number, default: null, min: 1 },
  usageCount: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

couponSchema.index({ active: 1, startsAt: 1, endsAt: 1 });

couponSchema.plugin(tenantIsolationPlugin);
couponSchema.index({ tenantId: 1, code: 1 }, { unique: true });
export default mongoose.model('Coupon', couponSchema);
