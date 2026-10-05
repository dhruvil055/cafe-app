import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const paymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  diningBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningBill' },
  idempotencyKey: { type: String, required: true },
  provider: { type: String, enum: ['razorpay', 'cash'], required: true },
  amount: { type: Number, required: true, min: 0 }, // Stored in the tenant's configured currency, from the server-calculated total
  currency: { type: String, default: 'INR', required: true },
  status: { type: String, enum: ['pending', 'created', 'captured', 'refunding', 'refunded', 'failed', 'cancelled'], default: 'pending' },
  razorpayOrderId: { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  refundId: { type: String, default: '' },
  webhookEventId: { type: String, default: '' },
  capturedAt: { type: Date, default: null },
}, { timestamps: true });

paymentSchema.index({ razorpayOrderId: 1 }, { sparse: true });

paymentSchema.pre('validate', function (next) {
  if (Boolean(this.orderId) === Boolean(this.diningBillId)) return next(new Error('A payment must belong to exactly one order or dining bill.'));
  next();
});

paymentSchema.plugin(tenantIsolationPlugin);
paymentSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
paymentSchema.index({ tenantId: 1, orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $type: 'objectId' } } });
paymentSchema.index({ tenantId: 1, diningBillId: 1 }, { unique: true, partialFilterExpression: { diningBillId: { $type: 'objectId' } } });
export default mongoose.model('Payment', paymentSchema);
