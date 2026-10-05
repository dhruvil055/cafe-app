import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  image: { type: String, default: '' },
  icon: { type: String, default: '☕' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

categorySchema.plugin(tenantIsolationPlugin);
categorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
export default mongoose.model('Category', categorySchema);
