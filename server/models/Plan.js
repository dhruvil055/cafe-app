import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  planId: {
    type: String,
    required: true,
    unique: true,
    enum: ['starter', 'pro', 'enterprise'],
    lowercase: true,
    trim: true,
  },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  priceMonthly: { type: Number, required: true, min: 0 },
  priceYearly: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR', uppercase: true },
  limits: {
    branches: { type: Number, default: 1 },
    tables: { type: Number, default: 5 },
    menuItems: { type: Number, default: 20 },
    staffUsers: { type: Number, default: 2 },
    monthlyOrders: { type: Number, default: 250 },
  },
  features: {
    basicAnalytics: { type: Boolean, default: true },
    advancedAnalytics: { type: Boolean, default: false },
    inventory: { type: Boolean, default: false },
    marketingCampaigns: { type: Boolean, default: false },
    multiBranch: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    customBranding: { type: Boolean, default: true },
    customDomain: { type: Boolean, default: false },
  },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Plan', planSchema);
