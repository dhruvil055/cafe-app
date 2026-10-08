import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const subscriptionSchema = new mongoose.Schema({
  plan: {
    type: String,
    required: true,
    enum: ['starter', 'pro', 'enterprise'],
    default: 'starter',
  },
  status: {
    type: String,
    required: true,
    enum: ['trialing', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'expired'],
    default: 'trialing',
    index: true,
  },
  trialStartDate: { type: Date, default: Date.now },
  trialEndDate: {
    type: Date,
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day free trial
  },
  currentPeriodStart: { type: Date, default: Date.now },
  currentPeriodEnd: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  gracePeriodEnd: { type: Date, default: null },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: { type: Date, default: null },
  razorpaySubscriptionId: { type: String, default: '', trim: true, index: true },
  razorpayCustomerId: { type: String, default: '', trim: true },
  razorpayPlanId: { type: String, default: '', trim: true },
  price: { type: Number, default: 0 },
  currency: { type: String, default: 'INR', uppercase: true },
  billingInterval: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly',
  },
  usageOverrides: {
    branches: { type: Number, default: null },
    tables: { type: Number, default: null },
    menuItems: { type: Number, default: null },
    staffUsers: { type: Number, default: null },
    monthlyOrders: { type: Number, default: null },
  },
  autoSuspendedAt: { type: Date, default: null },
  reactivatedAt: { type: Date, default: null },
}, { timestamps: true });

subscriptionSchema.plugin(tenantIsolationPlugin);
subscriptionSchema.index({ tenantId: 1, status: 1 });

export default mongoose.model('Subscription', subscriptionSchema);
