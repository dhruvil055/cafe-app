import AuditEvent from '../models/AuditEvent.js';

export const writeAuditLog = async ({ actor, action, targetType, targetId, details = {}, req = null, ip = '', userAgent = '' }) => {
  if (!action || !targetType) throw new Error('Audit action and target type are required.');
  const resolvedIp = ip || req?.ip || req?.headers?.['x-forwarded-for'] || '';
  const resolvedUserAgent = userAgent || req?.headers?.['user-agent'] || '';
  const isImpersonated = Boolean(actor?.isImpersonated || req?.user?.isImpersonated);
  const impersonatedBy = actor?.impersonatedBy || req?.user?.impersonatedBy || '';

  return AuditEvent.create({
    actorId: actor?._id || req?.user?._id || null,
    actorEmail: String(actor?.email || req?.user?.email || '').slice(0, 254),
    actorRole: String(actor?.role || req?.user?.role || '').slice(0, 30),
    action: String(action).slice(0, 80),
    targetType: String(targetType).slice(0, 80),
    targetId: String(targetId || '').slice(0, 100),
    details,
    ip: String(resolvedIp).slice(0, 50),
    userAgent: String(resolvedUserAgent).slice(0, 200),
    impersonation: {
      isImpersonated,
      impersonatedBy,
      originalSuperAdminId: String(req?.user?.originalSuperAdminId || ''),
    },
  });
};
