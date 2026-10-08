import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const usageRecordSchema = new mongoose.Schema({
  metric: {
    type: String,
    required: true,
    enum: ['branches', 'tables', 'menuItems', 'staffUsers', 'monthlyOrders'],
  },
  quantity: { type: Number, required: true, default: 0 },
  period: { type: String, required: true }, // Format: YYYY-MM
  recordedAt: { type: Date, default: Date.now },
}, { timestamps: true });

usageRecordSchema.plugin(tenantIsolationPlugin);
usageRecordSchema.index({ tenantId: 1, metric: 1, period: 1 });

export default mongoose.model('UsageRecord', usageRecordSchema);
