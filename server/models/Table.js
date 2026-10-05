import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const tableSchema = new mongoose.Schema({
  tableNumber: { type: Number, required: true },
  label: { type: String, default: '' },
  qrCode: { type: String, default: '' }, // base64 QR image
  qrUrl: { type: String, default: '' },
  active: { type: Boolean, default: true },
  seats: { type: Number, default: 4 },
}, { timestamps: true });

tableSchema.plugin(tenantIsolationPlugin);
tableSchema.index({ tenantId: 1, tableNumber: 1 }, { unique: true });
export default mongoose.model('Table', tableSchema);
