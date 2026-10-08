import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const loyaltyTransactionSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  points: { type: Number, required: true }, // positive for earned, negative for redeemed
  type: {
    type: String,
    enum: ['earned', 'redeemed', 'expired', 'bonus', 'adjustment', 'reversed'],
    required: true,
  },
  balanceAfter: { type: Number, required: true, min: 0 },
  reason: { type: String, default: '', trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

loyaltyTransactionSchema.index({ tenantId: 1, customer: 1, createdAt: -1 });

loyaltyTransactionSchema.plugin(tenantIsolationPlugin);
export default mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);
