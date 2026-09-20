import mongoose from 'mongoose';

const campaignDeliverySchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true,
  },
  channel: {
    type: String,
    enum: ['sms', 'whatsapp', 'push'],
    required: true,
  },
  recipientPhone: {
    type: String,
    default: '',
  },
  recipientEmail: {
    type: String,
    default: '',
  },
  pushEndpoint: {
    type: String,
    default: '',
  },
  providerMessageId: {
    type: String,
    default: '',
    index: true,
  },
  status: {
    type: String,
    enum: ['queued', 'sending', 'sent', 'delivered', 'failed', 'cancelled'],
    default: 'queued',
    index: true,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  sentAt: {
    type: Date,
    default: null,
  },
  deliveredAt: {
    type: Date,
    default: null,
  },
  failedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

campaignDeliverySchema.index({ campaignId: 1, status: 1 });
campaignDeliverySchema.index({ customerId: 1, createdAt: -1 });
campaignDeliverySchema.index({ createdAt: -1 });

export default mongoose.model('CampaignDelivery', campaignDeliverySchema);
