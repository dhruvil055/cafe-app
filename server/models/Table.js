import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const tableSchema = new mongoose.Schema({
  tableNumber: { type: Number, required: true },
  label: { type: String, default: '' },
  qrCode: { type: String, default: '' }, // base64 QR image
  qrUrl: { type: String, default: '' },
  active: { type: Boolean, default: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  status: {
    type: String,
    enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'WAITING_PAYMENT', 'CLEANING', 'DISABLED'],
    default: 'AVAILABLE',
  },
  seats: { type: Number, default: 4 },
  assignedWaiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  floor: { type: String, default: 'Ground Floor', trim: true },
  shape: { type: String, enum: ['square', 'round', 'rectangle'], default: 'square' },
}, { timestamps: true });

tableSchema.plugin(tenantIsolationPlugin);
tableSchema.index({ tenantId: 1, tableNumber: 1 }, { unique: true });
export default mongoose.model('Table', tableSchema);
