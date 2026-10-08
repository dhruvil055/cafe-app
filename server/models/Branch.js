import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  address: { type: String, default: '', trim: true },
  city: { type: String, default: '', trim: true },
  state: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  gstin: { type: String, default: '', trim: true, uppercase: true },
  isMain: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  settings: {
    openingHours: { type: mongoose.Schema.Types.Mixed, default: {} },
    tableCount: { type: Number, default: 0 },
  },
}, { timestamps: true });

branchSchema.index({ tenantId: 1, code: 1 }, { unique: true });
branchSchema.index({ tenantId: 1, active: 1 });

branchSchema.plugin(tenantIsolationPlugin);
export default mongoose.model('Branch', branchSchema);
