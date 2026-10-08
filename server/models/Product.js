import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const addonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
});

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  image: { type: String, default: '' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  available: { type: Boolean, default: true },
  availableFrom: { type: Date, default: null },
  availableUntil: { type: Date, default: null },
  popular: { type: Boolean, default: false },
  variants: [variantSchema],
  addons: [addonSchema],
  rating: { type: Number, default: 4.5, min: 0, max: 5 },
  prepTime: { type: Number, default: 10 }, // in minutes
  hsnCode: { type: String, default: '2106', trim: true },
  kitchenStation: {
    type: String,
    enum: ['BAR', 'KITCHEN', 'BAKERY', 'DESSERT'],
    default: 'KITCHEN',
    index: true,
  },
  isVeg: { type: Boolean, default: true },
  sku: { type: String, default: '', trim: true },
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ tenantId: 1, category: 1, available: 1 });
productSchema.index({ category: 1, available: 1 });
productSchema.index({ popular: 1 });
productSchema.index({ availableFrom: 1, availableUntil: 1 });

productSchema.pre('validate', function (next) {
  if (this.availableFrom && this.availableUntil && this.availableFrom >= this.availableUntil) {
    this.invalidate('availableUntil', 'Scheduled availability end must be after its start.');
  }
  next();
});

productSchema.plugin(tenantIsolationPlugin);
export default mongoose.model('Product', productSchema);
