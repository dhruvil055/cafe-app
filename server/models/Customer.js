import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
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
  notificationPermission: {
    type: Boolean,
    default: false,
    index: true,
  },
  notificationPreferences: {
    webPush: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
  },
  notificationEnabledAt: {
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
  loyaltyPoints: { type: Number, default: 0, min: 0 },
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
  // OTP login fields
  otpCode: { type: String, select: false, default: '' },
  otpExpiresAt: { type: Date, select: false, default: null },
  otpVerified: { type: Boolean, default: false },
}, { timestamps: true });

customerSchema.index({ createdAt: -1 });
customerSchema.index({ marketingConsent: 1, status: 1 });
customerSchema.index({ tenantId: 1, phone: 1 }, { unique: true });
customerSchema.index({ tenantId: 1, loyaltyPoints: -1 });

customerSchema.plugin(tenantIsolationPlugin);
export default mongoose.model('Customer', customerSchema);
