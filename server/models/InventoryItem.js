import mongoose from 'mongoose';

export const INVENTORY_UNITS = [
  'piece', 'cup', 'glass', 'bottle',
  'gram', 'kilogram', 'millilitre', 'litre',
  'pack', 'box', 'unit',
];

const inventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, default: '', trim: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryCategory', required: true },
  unit: { type: String, required: true, default: 'Piece', trim: true },
  currentQuantity: { type: Number, required: true, default: 0, min: 0 },
  minimumStock: { type: Number, default: 0, min: 0 },
  maximumStock: { type: Number, default: null },
  reorderLevel: { type: Number, default: 0, min: 0 },
  costPerUnit: { type: Number, default: 0, min: 0 },
  supplier: { type: String, default: '', trim: true },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

inventoryItemSchema.virtual('status').get(function () {
  if (this.currentQuantity <= 0) return 'out_of_stock';
  if (this.minimumStock > 0 && this.currentQuantity <= this.minimumStock) return 'low_stock';
  return 'in_stock';
});

inventoryItemSchema.virtual('stockValue').get(function () {
  return Number((this.currentQuantity * this.costPerUnit).toFixed(2));
});

inventoryItemSchema.index({ active: 1, currentQuantity: 1 });
inventoryItemSchema.index({ name: 'text' });

export default mongoose.model('InventoryItem', inventoryItemSchema);
