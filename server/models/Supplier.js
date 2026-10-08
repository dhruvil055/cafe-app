import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  contactPerson: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  address: { type: String, default: '', trim: true },
  gstin: { type: String, default: '', trim: true, uppercase: true },
  paymentTerms: { type: String, default: 'net_30', trim: true },
  categories: [{ type: String, trim: true }],
  active: { type: Boolean, default: true },
  notes: { type: String, default: '' },
}, { timestamps: true });

supplierSchema.index({ tenantId: 1, name: 1 });
supplierSchema.index({ tenantId: 1, active: 1 });

supplierSchema.plugin(tenantIsolationPlugin);
export default mongoose.model('Supplier', supplierSchema);
