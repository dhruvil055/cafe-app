import mongoose from 'mongoose';

const platformAuditEventSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', default: null },
  actorEmail: { type: String, default: '' },
  action: { type: String, required: true },
  targetTenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  targetTenantSlug: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

platformAuditEventSchema.index({ createdAt: -1 });
platformAuditEventSchema.index({ targetTenantId: 1, createdAt: -1 });
platformAuditEventSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model('PlatformAuditEvent', platformAuditEventSchema);
