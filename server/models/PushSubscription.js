import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const pushSubscriptionSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
    index: true,
  },
  endpoint: {
    type: String,
    required: true,
    index: true,
  },
  keys: {
    p256dh: {
      type: String,
      required: true,
    },
    auth: {
      type: String,
      required: true,
    },
  },
  userAgent: {
    type: String,
    default: '',
  },
  deviceType: {
    type: String,
    enum: ['Desktop', 'Mobile', 'Tablet', 'Other'],
    default: 'Desktop',
  },
  browser: {
    type: String,
    default: 'Chrome',
  },
  deviceInfo: {
    type: String,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  active: {
    type: Boolean,
    default: true,
    index: true,
  },
  lastUsedAt: {
    type: Date,
    default: null,
    index: true,
  },
}, { timestamps: true });

// Keep active and isActive synchronized
pushSubscriptionSchema.pre('save', function (next) {
  if (this.isModified('isActive') && !this.isModified('active')) {
    this.active = this.isActive;
  } else if (this.isModified('active') && !this.isModified('isActive')) {
    this.isActive = this.active;
  }
  next();
});

pushSubscriptionSchema.plugin(tenantIsolationPlugin);
pushSubscriptionSchema.index({ tenantId: 1, endpoint: 1 }, { unique: true });
export default mongoose.model('PushSubscription', pushSubscriptionSchema);
