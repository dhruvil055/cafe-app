import mongoose from 'mongoose';

const diningSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  tableNumber: { type: Number, required: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'IDLE', 'PAYMENT_PENDING', 'CLOSED', 'EXPIRED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true,
  },
  verificationMethod: { type: String, enum: ['geofence'], required: true },
  startedAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true, index: true },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

diningSessionSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model('DiningSession', diningSessionSchema);