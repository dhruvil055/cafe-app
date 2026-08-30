import mongoose from 'mongoose';

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
  orderNumber: { type: String, required: true, unique: true },
  tableNumber: { type: Number, required: true },
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
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
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'pending',
  },
  razorpayOrderId: { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  razorpaySignature: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

// Generate order number
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `CAF${String(count + 1001).padStart(4, '0')}`;
  }
  next();
});

export default mongoose.model('Order', orderSchema);
