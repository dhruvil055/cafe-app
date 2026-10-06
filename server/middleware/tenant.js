import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import { runWithTenant } from '../utils/tenantContext.js';

const cleanHost = (value) => String(value || '').split(',')[0].trim().split(':')[0].toLowerCase();

const getSlugFromHost = (host) => {
  const defaultSlug = String(process.env.TENANT_DEFAULT_SLUG || 'brewhaus').toLowerCase();
  const baseDomain = String(process.env.TENANT_BASE_DOMAIN || '').toLowerCase().replace(/^\.+|\.+$/g, '');
  if (baseDomain && host.endsWith(`.${baseDomain}`)) {
    const prefix = host.slice(0, -(baseDomain.length + 1));
    if (prefix && !prefix.includes('.')) return prefix;
  }
  // Backward-compatible mapping for existing customer/admin domains and cloud deployment hosts.
  if (
    ['cafe.infinigrowsoftech.com', 'admin-cafe.infinigrowsoftech.com', 'localhost', '127.0.0.1'].includes(host) ||
    host.includes('onrender.com') ||
    host.includes('vercel.app')
  ) {
    return defaultSlug;
  }
  if (host.endsWith('.localhost')) return host.split('.')[0];
  return defaultSlug;
};

const isCustomerTenantHost = (host) => {
  if (host === 'cafe.infinigrowsoftech.com') return true;
  if (host.endsWith('.localhost')) {
    const prefix = host.slice(0, -'.localhost'.length);
    return Boolean(prefix) && !prefix.includes('.') && prefix !== 'admin';
  }
  const baseDomain = String(process.env.TENANT_BASE_DOMAIN || '').toLowerCase().replace(/^\.+|\.+$/g, '');
  return Boolean(baseDomain && host.endsWith(`.${baseDomain}`) && !host.slice(0, -(baseDomain.length + 1)).startsWith('admin.'));
};

const cleanTenantError = (res, status, message) => res.status(status).json({ error: message, code: status === 423 ? 'TENANT_SUSPENDED' : 'TENANT_NOT_FOUND' });

export const tenantResolver = async (req, res, next) => {
  if (
    req.path === '/api/health' ||
    req.path.startsWith('/api/platform') ||
    req.path === '/api/billing/webhook' ||
    req.path === '/api/tenant/public' ||
    req.path === '/api/auth/me' ||
    req.path === '/api/auth/refresh'
  ) {
    return next();
  }
  try {
    const requestHost = cleanHost(req.get('x-forwarded-host') || req.get('host'));
    let originHost = '';
    try { originHost = cleanHost(new URL(req.get('origin')).hostname); } catch { originHost = ''; }
    const explicitTenantSubdomain = (host) => {
      if (host.endsWith('.localhost')) {
        const prefix = host.slice(0, -'.localhost'.length);
        return Boolean(prefix) && !prefix.includes('.') && prefix !== 'admin';
      }
      const baseDomain = String(process.env.TENANT_BASE_DOMAIN || '').toLowerCase().replace(/^\.+|\.+$/g, '');
      if (!baseDomain || !host.endsWith(`.${baseDomain}`)) return false;
      const prefix = host.slice(0, -(baseDomain.length + 1));
      return Boolean(prefix) && !prefix.includes('.') && prefix !== 'admin';
    };
    // The API is hosted separately from the customer app; browser Origin carries its café subdomain.
    const host = explicitTenantSubdomain(requestHost) ? requestHost
      : (isCustomerTenantHost(originHost) ? originHost : requestHost);
    let tenantId = null;
    let tenant = null;
    if (req.path === '/api/payment/webhook') {
      const payment = req.body?.payload?.payment?.entity;
      const refund = req.body?.payload?.refund?.entity;
      const collection = mongoose.connection.collection('payments');
      let record = payment?.order_id ? await collection.findOne({ razorpayOrderId: String(payment.order_id) }, { projection: { tenantId: 1 } }) : null;
      if (!record && refund?.payment_id) record = await collection.findOne({ razorpayPaymentId: String(refund.payment_id) }, { projection: { tenantId: 1 } });
      if (!record?.tenantId) return cleanTenantError(res, 404, 'Payment tenant not found.');
      tenant = await Tenant.findById(record.tenantId).lean();
      if (!tenant) return cleanTenantError(res, 404, 'Payment tenant not found.');
      tenantId = tenant._id;
    }
    const token = (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : req.cookies?.brewhaus_access_token) || '';
    const customerHost = isCustomerTenantHost(host);
    if (token && !customerHost) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
        if (decoded.tokenUse === 'access' && decoded.tenantId) {
          tenant = await Tenant.findById(decoded.tenantId).lean();
          if (tenant) tenantId = tenant._id;
        }
      } catch { /* The auth middleware returns the usual invalid-token response. */ }
    }
    if (!tenant) {
      const slug = getSlugFromHost(host);
      if (!slug) return cleanTenantError(res, 404, 'Café not found.');
      tenant = await Tenant.findOne({ slug }).lean();
      if (!tenant) return cleanTenantError(res, 404, 'Café not found.');
      tenantId = tenant._id;
    }
    if (tenant.status !== 'active') return cleanTenantError(res, 423, 'This café account is suspended.');
    req.tenant = tenant;
    req.tenantId = tenantId;
    return runWithTenant(tenantId, next);
  } catch (error) { return next(error); }
};

export const tenantFromAuthenticatedUser = (req, res, next) => {
  if (!req.user?.tenantId || String(req.user.tenantId) !== String(req.tenantId)) return cleanTenantError(res, 404, 'Café not found.');
  return next();
};
