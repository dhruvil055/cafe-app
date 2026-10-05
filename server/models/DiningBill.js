import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const diningBillSchema = new mongoose.Schema({
  diningSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningSession', required: true, index: true },
  receiptNumber: { type: String, sparse: true, index: true },
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

diningBillSchema.plugin(tenantIsolationPlugin);
diningBillSchema.index({ tenantId: 1, diningSessionId: 1 }, { unique: true });
diningBillSchema.index({ tenantId: 1, receiptNumber: 1 }, { unique: true, partialFilterExpression: { receiptNumber: { $type: 'string' } } });
export default mongoose.model('DiningBill', diningBillSchema);
