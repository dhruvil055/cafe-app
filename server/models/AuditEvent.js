import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

const auditEventSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorEmail: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

auditEventSchema.index({ createdAt: -1 });
auditEventSchema.index({ actorId: 1, createdAt: -1 });
auditEventSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

auditEventSchema.plugin(tenantIsolationPlugin);
export default mongoose.model('AuditEvent', auditEventSchema);
