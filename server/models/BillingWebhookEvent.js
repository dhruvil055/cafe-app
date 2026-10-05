import mongoose from 'mongoose';

const billingWebhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  processedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['processed', 'failed', 'ignored'], default: 'processed' },
}, { timestamps: true });

billingWebhookEventSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.model('BillingWebhookEvent', billingWebhookEventSchema);
