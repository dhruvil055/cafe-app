import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const purchaseItemSchema = new mongoose.Schema({
  inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.001 },
  unit: { type: String, required: true },
  unitCost: { type: Number, required: true, min: 0 },
  taxPercent: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
});

const purchaseSchema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  poNumber: { type: String, required: true, trim: true },
  invoiceNumber: { type: String, default: '', trim: true },
  invoiceDate: { type: Date, default: null },
  items: [purchaseItemSchema],
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['draft', 'ordered', 'received', 'cancelled'],
    default: 'draft',
    index: true,
  },
  paidStatus: {
    type: String,
    enum: ['unpaid', 'partially_paid', 'paid'],
    default: 'unpaid',
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'upi', 'cheque', 'other'],
    default: 'bank_transfer',
  },
  receivedAt: { type: Date, default: null },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: '' },
}, { timestamps: true });

purchaseSchema.index({ tenantId: 1, poNumber: 1 }, { unique: true });
purchaseSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
purchaseSchema.index({ tenantId: 1, supplier: 1 });

purchaseSchema.plugin(tenantIsolationPlugin);
export default mongoose.model('Purchase', purchaseSchema);
