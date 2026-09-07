import mongoose from 'mongoose';

const inventoryCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '📦' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('InventoryCategory', inventoryCategorySchema);
