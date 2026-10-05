import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const tableServiceRequestSchema = new mongoose.Schema({
  diningSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningSession', required: true },
  tableNumber: { type: Number, required: true },
  type: { type: String, enum: ['waiter', 'bill'], required: true },
  status: { type: String, enum: ['open', 'served'], default: 'open' },
  servedAt: { type: Date, default: null },
  servedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

tableServiceRequestSchema.index({ status: 1, createdAt: -1 });
tableServiceRequestSchema.index({ diningSessionId: 1, type: 1, status: 1 });

tableServiceRequestSchema.plugin(tenantIsolationPlugin);
export default mongoose.model('TableServiceRequest', tableServiceRequestSchema);
