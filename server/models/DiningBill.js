import mongoose from 'mongoose';

const diningBillSchema = new mongoose.Schema({
  diningSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningSession', required: true, unique: true, index: true },
  subtotal: { type: Number, min: 0, default: 0 },
  taxTotal: { type: Number, min: 0, default: 0 },
  grandTotal: { type: Number, min: 0, default: 0 },
  paidAmount: { type: Number, min: 0, default: 0 },
  dueAmount: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['OPEN', 'PAYMENT_PENDING', 'CASH_PENDING', 'PAID'], default: 'OPEN' },
  cashRequestedAt: { type: Date, default: null },
  paidAt: { type: Date, default: null },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  razorpayOrderId: { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  razorpaySignature: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('DiningBill', diningBillSchema);