import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const subscriptionInvoiceSchema = new mongoose.Schema({
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
  invoiceNumber: { type: String, required: true, trim: true },
  plan: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR', uppercase: true },
  status: {
    type: String,
    enum: ['draft', 'open', 'paid', 'uncollectible', 'void'],
    default: 'paid',
  },
  billingPeriodStart: { type: Date, required: true },
  billingPeriodEnd: { type: Date, required: true },
  paidAt: { type: Date, default: Date.now },
  razorpayPaymentId: { type: String, default: '', trim: true },
  razorpayInvoiceId: { type: String, default: '', trim: true },
  downloadUrl: { type: String, default: '' },
}, { timestamps: true });

subscriptionInvoiceSchema.plugin(tenantIsolationPlugin);
subscriptionInvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

export default mongoose.model('SubscriptionInvoice', subscriptionInvoiceSchema);
