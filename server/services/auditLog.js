import AuditEvent from '../models/AuditEvent.js';

export const writeAuditLog = async ({ actor, action, targetType, targetId, details = {} }) => {
  if (!action || !targetType) throw new Error('Audit action and target type are required.');
  return AuditEvent.create({
    actorId: actor?._id || null,
    actorEmail: String(actor?.email || '').slice(0, 254),
    actorRole: String(actor?.role || '').slice(0, 30),
    action: String(action).slice(0, 80),
    targetType: String(targetType).slice(0, 80),
    targetId: String(targetId || '').slice(0, 100),
    details,
  });
};
