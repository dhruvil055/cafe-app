import mongoose from 'mongoose';

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
  isVeg: { type: Boolean, default: true },
  available: { type: Boolean, default: true },
  popular: { type: Boolean, default: false },
  variants: [variantSchema],
  addons: [addonSchema],
  rating: { type: Number, default: 4.5, min: 0, max: 5 },
  prepTime: { type: Number, default: 10 }, // in minutes
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);
