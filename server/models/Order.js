import mongoose from 'mongoose';
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
  tax: { type: Number, required: true },
  total: { type: Number, required: true },
  taxRate: { type: Number, default: 5 }, // 5% GST
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cash'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'payment_created', 'payment_processing', 'paid', 'failed', 'cancelled', 'refunded'],
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
  idempotencyKey: { type: String, sparse: true, index: true },
  razorpayOrderId: { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  razorpaySignature: { type: String, default: '' },
  notes: { type: String, default: '' },
  accessTokenHash: { type: String, required: true, unique: true },
}, { timestamps: true });

// Generate order number before required-field validation runs.
orderSchema.pre('validate', async function (next) {
  if (this.orderNumber) return next();

  try {
    // The counter is the source of truth for new order numbers. The upsert
    // makes the first allocation safe even when the counter has not existed
    // in an older database yet.
    const latest = await mongoose.model('Order')
      .findOne({ orderNumber: /^CAF\d+$/ })
      .sort({ orderNumber: -1 })
      .select('orderNumber')
      .lean();
    const latestNumber = latest ? Number(String(latest.orderNumber).slice(3)) : 1000;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await Counter.updateOne(
          { _id: 'orderNumber' },
          { $setOnInsert: { seq: Math.max(1000, latestNumber) } },
          { upsert: true }
        );
        const counter = await Counter.findOneAndUpdate(
          { _id: 'orderNumber' },
          { $inc: { seq: 1 } },
          { new: true }
        );
        this.orderNumber = `CAF${String(counter.seq).padStart(4, '0')}`;
        return next();
      } catch (error) {
        // Two first-ever orders can race while creating the counter. The
        // unique counter key makes one retry against the now-existing row.
        if (error?.code !== 11000 || attempt === 2) throw error;
      }
    }
  } catch (error) {
    next(error);
  }
});

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ diningSessionId: 1, createdAt: -1 });
orderSchema.index({ tableNumber: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ razorpayOrderId: 1 }, { sparse: true });

export const initializeOrderNumberCounter = async () => {
  const latest = await mongoose.model('Order')
    .findOne({ orderNumber: /^CAF\d+$/ })
    .sort({ orderNumber: -1 })
    .select('orderNumber')
    .lean();
  const latestNumber = latest ? Number(String(latest.orderNumber).slice(3)) : 1000;
  await Counter.findOneAndUpdate(
    { _id: 'orderNumber' },
    { $max: { seq: Math.max(1000, latestNumber) } },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

export default mongoose.model('Order', orderSchema);
