import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const inventoryCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '📦' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

inventoryCategorySchema.plugin(tenantIsolationPlugin);
inventoryCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
export default mongoose.model('InventoryCategory', inventoryCategorySchema);
