import mongoose from 'mongoose';

const tableSchema = new mongoose.Schema({
  tableNumber: { type: Number, required: true, unique: true },
  label: { type: String, default: '' },
  qrCode: { type: String, default: '' }, // base64 QR image
  qrUrl: { type: String, default: '' },
  active: { type: Boolean, default: true },
  seats: { type: Number, default: 4 },
}, { timestamps: true });

export default mongoose.model('Table', tableSchema);
