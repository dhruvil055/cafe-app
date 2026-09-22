import mongoose from 'mongoose';

const notificationCampaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  image: {
    type: String,
    trim: true,
    default: '',
  },
  actionUrl: {
    type: String,
    trim: true,
    default: '/menu',
  },
  offerCode: {
    type: String,
    trim: true,
    default: '',
  },
  channel: {
    type: String,
    enum: ['web', 'web_push', 'sms', 'whatsapp'],
    default: 'web_push',
  },
  audienceType: {
    type: String,
    enum: [
      'all',
      'selected',
      'all_enabled',
      'single_customer',
      'new_customers',
      'returning_customers',
      'inactive_30d',
      'frequent_5plus',
      'high_value',
      'custom',
    ],
    required: true,
    default: 'all_enabled',
  },
  audienceFilter: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  scheduledAt: {
    type: Date,
    default: null,
    index: true,
  },
  status: {
    type: String,
    enum: ['draft', 'processing', 'completed', 'partial', 'scheduled', 'sending', 'sent', 'partially_failed', 'failed', 'cancelled'],
    default: 'draft',
    index: true,
  },
  totalRecipients: {
    type: Number,
    default: 0,
  },
  totalSent: {
    type: Number,
    default: 0,
  },
  totalFailed: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

notificationCampaignSchema.index({ createdAt: -1 });
notificationCampaignSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.model('NotificationCampaign', notificationCampaignSchema);
