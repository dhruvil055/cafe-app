import mongoose from 'mongoose';

export const TRANSACTION_TYPES = [
  'purchase',           // stock bought/received
  'manual_addition',    // admin manually adds stock
  'stock_added',        // stock added via Add Stock action
  'order_consumption',  // automatic deduction from confirmed order
  'order_restoration',  // order cancellation (if any)
  'manual_removal',     // admin manually removes stock
  'waste',              // spoilage/waste recorded
  'damaged',            // physical damage recorded
  'lost',               // missing/lost items
  'expired',            // expired consumables
  'adjustment',         // general stock correction
  'return',             // supplier return
  'correction',         // correction of a previous error
];

const inventoryTransactionSchema = new mongoose.Schema({
  inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  type: { type: String, enum: TRANSACTION_TYPES, required: true },

  // Positive = stock added, Negative = stock deducted
  quantity: { type: Number, required: true },
  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },

  // Order linkage (for order_consumption and order_restoration)
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  orderItemId: { type: mongoose.Schema.Types.ObjectId, default: null },

  // Human-readable reference (order number, PO number, etc.)
  reference: { type: String, default: '' },

  reason: { type: String, default: '' },
  notes: { type: String, default: '' },

  // Null for automated system transactions
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Prevent duplicate order consumption for the same order
// sparse:true allows multiple docs with orderId=null
inventoryTransactionSchema.index(
  { orderId: 1, inventoryItem: 1, type: 1 },
  { unique: true, sparse: true, partialFilterExpression: { orderId: { $ne: null }, type: 'order_consumption' } }
);

inventoryTransactionSchema.index({ inventoryItem: 1, createdAt: -1 });
inventoryTransactionSchema.index({ orderId: 1 });
inventoryTransactionSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model('InventoryTransaction', inventoryTransactionSchema);
