import mongoose from 'mongoose';

/**
 * MenuInventoryMapping — links a menu Product to one or more InventoryItems
 * with the quantity consumed per order unit.
 *
 * Example: Ice Cream (product) → Ice Cream Serving (1), Cup (1), Spoon (1)
 */
const menuInventoryMappingSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  quantityRequired: { type: Number, required: true, min: 0.001 },
  active: { type: Boolean, default: true },
  notes: { type: String, default: '' },
}, { timestamps: true });

// Prevent duplicate mappings for the same product-inventoryItem pair
menuInventoryMappingSchema.index({ product: 1, inventoryItem: 1 }, { unique: true });
menuInventoryMappingSchema.index({ product: 1, active: 1 });
menuInventoryMappingSchema.index({ inventoryItem: 1 });

export default mongoose.model('MenuInventoryMapping', menuInventoryMappingSchema);
