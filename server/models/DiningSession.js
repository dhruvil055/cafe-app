import mongoose from 'mongoose';

const diningSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  tableNumber: { type: Number, required: true, index: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'IDLE', 'PAYMENT_PENDING', 'READY_TO_CLOSE', 'CLOSED', 'EXPIRED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true,
  },
  startedAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  closedAt: { type: Date, default: null },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

diningSessionSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model('DiningSession', diningSessionSchema);