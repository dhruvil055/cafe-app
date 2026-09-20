import mongoose from 'mongoose';

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
    unique: true,
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
  deviceInfo: {
    type: String,
    default: '',
  },
  active: {
    type: Boolean,
    default: true,
    index: true,
  },
}, { timestamps: true });

export default mongoose.model('PushSubscription', pushSubscriptionSchema);
