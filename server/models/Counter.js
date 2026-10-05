import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, min: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
}, { versionKey: false });

counterSchema.plugin(tenantIsolationPlugin);
counterSchema.index({ tenantId: 1, _id: 1 }, { unique: true });

export default mongoose.model('Counter', counterSchema);
