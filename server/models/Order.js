import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';
import Counter from './Counter.js';

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  image: { type: String, default: '' },
  addons: [{
    name: String,
    price: Number,
  }],
  variant: {
    name: String,
    price: Number,
  },
  specialInstructions: { type: String, default: '' },
  itemTotal: { type: Number, required: true },
});

const orderSchema = new mongoose.Schema({
  // Payment verification must be idempotent: track verification state
  paymentVerifiedAt: { type: Date, default: null },
  orderNumber: { type: String, required: true },
  tableNumber: { type: Number, required: true },
  diningSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningSession', required: false, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: false, index: true },
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    marketingConsent: { type: Boolean, default: false },
  },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0, min: 0 },
  couponCode: { type: String, default: '', trim: true, maxlength: 32 },
  tax: { type: Number, required: true },
  total: { type: Number, required: true },
  taxRate: { type: Number, default: 5 }, // 5% GST
  currency: { type: String, uppercase: true, default: 'INR' },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cash'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'payment_created', 'payment_processing', 'paid', 'refund_pending', 'failed', 'cancelled', 'refunded'],
    default: 'pending',
  },
  cashVerificationStatus: {
    type: String,
    enum: ['not_required', 'pending', 'confirmed', 'rejected'],
    default: 'not_required',
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'pending',
  },
  statusHistory: [{
    status: { type: String, required: true },
    previousStatus: { type: String, default: null },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: '' },
  }],
  inventoryProcessed: { type: Boolean, default: false },
  inventoryProcessedAt: { type: Date, default: null },
  inventoryRestored: { type: Boolean, default: false },
  inventoryRestoredAt: { type: Date, default: null },
  idempotencyKey: { type: String, sparse: true },
  razorpayOrderId: { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  razorpaySignature: { type: String, default: '' },
  notes: { type: String, default: '' },
  loyaltyPointsAwarded: { type: Boolean, default: false },
  loyaltyPointsEarned: { type: Number, default: 0, min: 0 },
  loyaltyPointsReversed: { type: Boolean, default: false },
  rating: {
    score: { type: Number, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 500 },
    submittedAt: { type: Date },
  },
  accessTokenHash: { type: String, required: true },
}, { timestamps: true });

// Generate order number before required-field validation runs.
orderSchema.pre('validate', async function (next) {
  if (this.orderNumber) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'orderNumber', tenantId: this.tenantId },
      { $inc: { seq: 1 }, $setOnInsert: { seq: 1000 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    this.orderNumber = `CAF${String(counter.seq).padStart(4, '0')}`;
    return next();
  } catch (error) {
    next(error);
  }
});

orderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
orderSchema.index({ tenantId: 1, accessTokenHash: 1 }, { unique: true });
orderSchema.index({ diningSessionId: 1, createdAt: -1 });
orderSchema.index({ tableNumber: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ razorpayOrderId: 1 }, { sparse: true });

export const initializeOrderNumberCounter = async (tenantId) => {
  if (!tenantId) return;
  await Counter.findOneAndUpdate(
    { _id: 'orderNumber', tenantId },
    { $max: { seq: 1000 } },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

orderSchema.plugin(tenantIsolationPlugin);
export default mongoose.model('Order', orderSchema);
