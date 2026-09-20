import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
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
  channel: {
    type: String,
    enum: ['sms', 'whatsapp', 'push', 'all'],
    required: true,
  },
  audienceType: {
    type: String,
    enum: ['all_opted_in', 'new_customers', 'returning_customers', 'inactive_customers', 'high_value', 'frequent', 'custom'],
    required: true,
    default: 'all_opted_in',
  },
  audienceFilter: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  offerCode: {
    type: String,
    trim: true,
    default: '',
  },
  startDate: {
    type: Date,
    default: null,
  },
  endDate: {
    type: Date,
    default: null,
  },
  scheduledAt: {
    type: Date,
    default: null,
    index: true,
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'partially_failed', 'failed', 'cancelled'],
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
  totalDelivered: {
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

campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.model('Campaign', campaignSchema);
