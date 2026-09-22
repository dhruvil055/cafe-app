import mongoose from 'mongoose';

const notificationDeliverySchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NotificationCampaign',
    required: true,
    index: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
    index: true,
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PushSubscription',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['queued', 'sending', 'delivered', 'failed'],
    default: 'queued',
    index: true,
  },
  sentAt: {
    type: Date,
    default: null,
  },
  failedAt: {
    type: Date,
    default: null,
  },
  errorMessage: {
    type: String,
    default: '',
  },
}, { timestamps: true });

notificationDeliverySchema.index({ campaignId: 1, status: 1 });
notificationDeliverySchema.index({ customerId: 1, createdAt: -1 });
notificationDeliverySchema.index({ createdAt: -1 });

export default mongoose.model('NotificationDelivery', notificationDeliverySchema);
