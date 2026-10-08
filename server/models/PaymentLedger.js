import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const paymentLedgerSchema = new mongoose.Schema({
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
  diningBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningBill', default: null, index: true },
  eventType: {
    type: String,
    enum: [
      'payment_created',
      'payment_authorized',
      'payment_captured',
      'payment_failed',
      'refund_requested',
      'refund_processed',
      'refund_failed',
    ],
    required: true,
    index: true,
  },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR', required: true },
  gatewayTransactionId: { type: String, default: '' },
  gatewayOrderId: { type: String, default: '' },
  reason: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  recordedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

paymentLedgerSchema.plugin(tenantIsolationPlugin);
paymentLedgerSchema.index({ tenantId: 1, eventType: 1, recordedAt: -1 });
paymentLedgerSchema.index({ tenantId: 1, paymentId: 1, recordedAt: -1 });

export default mongoose.model('PaymentLedger', paymentLedgerSchema);
