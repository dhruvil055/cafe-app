import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    default: '',
  },
  marketingConsent: {
    type: Boolean,
    default: false,
    index: true,
  },
  marketingConsentAt: {
    type: Date,
    default: null,
  },
  marketingOptOutAt: {
    type: Date,
    default: null,
  },
  firstOrderAt: {
    type: Date,
    default: null,
  },
  lastOrderAt: {
    type: Date,
    default: null,
    index: true,
  },
  totalOrders: {
    type: Number,
    default: 0,
    min: 0,
    index: true,
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'blocked', 'unsubscribed'],
    default: 'active',
    index: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  notes: {
    type: String,
    default: '',
  },
}, { timestamps: true });

customerSchema.index({ createdAt: -1 });
customerSchema.index({ marketingConsent: 1, status: 1 });
customerSchema.index({ totalOrders: -1, totalSpent: -1 });

export default mongoose.model('Customer', customerSchema);
