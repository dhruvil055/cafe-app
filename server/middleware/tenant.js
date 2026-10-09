import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import { runWithTenant } from '../utils/tenantContext.js';
import { verifyTableQrToken } from '../utils/tableQr.js';

const cleanHost = (value) => String(value || '').split(',')[0].trim().split(':')[0].toLowerCase();

const getSlugFromHost = (host) => {
  const baseDomain = String(process.env.TENANT_BASE_DOMAIN || '').toLowerCase().replace(/^\.+|\.+$/g, '');
  if (baseDomain && host.endsWith(`.${baseDomain}`)) {
    const prefix = host.slice(0, -(baseDomain.length + 1));
    if (prefix && !prefix.includes('.') && prefix !== 'admin' && prefix !== 'www' && prefix !== 'cafe') return prefix;
  }
  if (host.endsWith('.localhost')) {
    const prefix = host.slice(0, -'.localhost'.length);
    if (prefix && !prefix.includes('.') && prefix !== 'admin' && prefix !== 'www' && prefix !== 'cafe') return prefix;
  }
  return null;
};

const isCustomerTenantHost = (host) => {
  if (host.endsWith('.localhost')) {
    const prefix = host.slice(0, -'.localhost'.length);
    return Boolean(prefix) && !prefix.includes('.') && prefix !== 'admin' && prefix !== 'www' && prefix !== 'cafe';
  }
  const baseDomain = String(process.env.TENANT_BASE_DOMAIN || '').toLowerCase().replace(/^\.+|\.+$/g, '');
  return Boolean(baseDomain && host.endsWith(`.${baseDomain}`) && !host.slice(0, -(baseDomain.length + 1)).startsWith('admin.'));
};

const isAllowedTenantHost = (host) => {
  if (!host) return false;
  const clean = cleanHost(host);
  if (!clean) return false;
  if (['development', 'test'].includes(process.env.NODE_ENV) || !process.env.NODE_ENV) {
    if (clean === 'localhost' || clean.endsWith('.localhost') || clean === '127.0.0.1') return true;
  }
  const baseDomain = String(process.env.TENANT_BASE_DOMAIN || '').toLowerCase().replace(/^\.+|\.+$/g, '');
  if (baseDomain && (clean === baseDomain || clean.endsWith(`.${baseDomain}`))) return true;

  // Explicit allowed frontend hosts
  for (const urlStr of [
    process.env.CLIENT_URL,
    process.env.CUSTOMER_APP_URL,
    process.env.ADMIN_CLIENT_URL,
    process.env.ADMIN_APP_URL,
    process.env.CLIENT_URLS,
    process.env.ADMIN_CLIENT_URLS,
  ]) {
    if (!urlStr) continue;
    for (const item of String(urlStr).split(',')) {
      try {
        const parsed = new URL(item.trim());
        if (cleanHost(parsed.hostname) === clean) return true;
      } catch {}
    }
  }
  return false;
};

const cleanTenantError = (res, status, message) => res.status(status).json({ error: message, code: status === 423 ? 'TENANT_SUSPENDED' : 'TENANT_NOT_FOUND' });

export const tenantResolver = async (req, res, next) => {
  if (
    req.path === '/health' ||
    req.path === '/api/health' ||
    req.path === '/ready' ||
    req.path === '/api/ready' ||
    req.path === '/api/debug/ip' ||
    req.path === '/api/tenant/public' ||
    req.path.startsWith('/api/platform') ||
    req.path === '/api/billing/webhook' ||
    req.path === '/api/auth/me' ||
    req.path === '/api/auth/refresh' ||
    req.path === '/api/auth/login' ||
    req.path === '/api/auth/logout' ||
    req.path === '/api/auth/forgot-password' ||
    req.path === '/api/auth/reset-password'
  ) {
    return next();
  }
  try {
    let tenant = null;
    let tenantId = null;

    // 1. Prioritize cryptographically signed tableToken (from query, header, or body)
    const queryTableToken = req.query?.tableToken || req.headers['x-table-token'] || req.headers['x-qr-token'] || req.body?.tableToken || req.body?.qrToken;
    if (queryTableToken) {
      const claims = verifyTableQrToken(queryTableToken);
      if (claims?.tenantId && mongoose.isValidObjectId(claims.tenantId)) {
        tenant = await Tenant.findById(claims.tenantId).lean();
        if (tenant) tenantId = tenant._id;
      }
    }

    // 2. Direct cafe / tenant query parameters or headers
    if (!tenant) {
      const headerTenantId = req.headers['x-tenant-id'] || req.headers['x-cafe-id'];
      const headerTenantSlug = req.headers['x-tenant-slug'];
      const queryCafe = req.query?.cafe || req.query?.cafeId || req.query?.tenant || req.query?.slug || req.body?.cafeId || req.body?.tenantId;

      if (queryCafe) {
        const idOrSlug = String(queryCafe).trim();
        if (mongoose.isValidObjectId(idOrSlug)) {
          tenant = await Tenant.findById(idOrSlug).lean();
        }
        if (!tenant) {
          tenant = await Tenant.findOne({ slug: idOrSlug.toLowerCase() }).lean();
        }
        if (tenant) tenantId = tenant._id;
      } else if (headerTenantId && mongoose.isValidObjectId(headerTenantId)) {
        tenant = await Tenant.findById(headerTenantId).lean();
        if (tenant) tenantId = tenant._id;
      } else if (headerTenantSlug) {
        const rawSlug = String(headerTenantSlug).trim();
        if (mongoose.isValidObjectId(rawSlug)) {
          tenant = await Tenant.findById(rawSlug).lean();
        }
        if (!tenant) {
          tenant = await Tenant.findOne({ slug: rawSlug.toLowerCase() }).lean();
        }
        if (tenant) tenantId = tenant._id;
      }
    }

    // 3. Payment webhook lookup
    if (!tenant && req.path === '/api/payment/webhook') {
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

    // 4. Authenticated staff/owner token
    const token = (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : req.cookies?.brewhaus_access_token) || '';
    if (!tenant && token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
        if (decoded.tokenUse === 'access' && decoded.tenantId) {
          tenant = await Tenant.findById(decoded.tenantId).lean();
          if (tenant) tenantId = tenant._id;
        }
      } catch { /* Handled later by auth middleware */ }
    }

    // 5. Hostname / Origin / Referer subdomain resolution (strictly allow-listed domains only)
    if (!tenant) {
      const rawRequestHost = cleanHost(req.get('x-forwarded-host') || req.get('host'));
      const requestHost = isAllowedTenantHost(rawRequestHost) ? rawRequestHost : '';
      let rawOriginHost = '';
      try { rawOriginHost = cleanHost(new URL(req.get('origin')).hostname); } catch { rawOriginHost = ''; }
      const originHost = isAllowedTenantHost(rawOriginHost) ? rawOriginHost : '';
      let rawRefererHost = '';
      try { rawRefererHost = cleanHost(new URL(req.get('referer')).hostname); } catch { rawRefererHost = ''; }
      const refererHost = isAllowedTenantHost(rawRefererHost) ? rawRefererHost : '';

      const explicitTenantSubdomain = (h) => {
        if (!h) return null;
        if (h.endsWith('.localhost')) {
          const prefix = h.slice(0, -'.localhost'.length);
          return Boolean(prefix) && !prefix.includes('.') && prefix !== 'admin' ? prefix : null;
        }
        const baseDomain = String(process.env.TENANT_BASE_DOMAIN || '').toLowerCase().replace(/^\.+|\.+$/g, '');
        if (!baseDomain || !h.endsWith(`.${baseDomain}`)) return null;
        const prefix = h.slice(0, -(baseDomain.length + 1));
        return Boolean(prefix) && !prefix.includes('.') && prefix !== 'admin' ? prefix : null;
      };

      const extractedSubdomain = explicitTenantSubdomain(requestHost) ||
        explicitTenantSubdomain(originHost) ||
        explicitTenantSubdomain(refererHost);

      if (extractedSubdomain) {
        tenant = await Tenant.findOne({ slug: extractedSubdomain }).lean();
        if (tenant) tenantId = tenant._id;
      }

      if (!tenant) {
        const host = explicitTenantSubdomain(requestHost) ? requestHost
          : (isCustomerTenantHost(originHost) ? originHost : requestHost);
        const slug = getSlugFromHost(host);
        if (slug) {
          tenant = await Tenant.findOne({ slug }).lean();
          if (tenant) tenantId = tenant._id;
        }
      }
    }

    if (!tenant) {
      if (
        req.path.startsWith('/api/public') ||
        req.path === '/api/cafes' ||
        req.path.startsWith('/api/admin')
      ) {
        return next();
      }
      return cleanTenantError(res, 404, 'Café not found. Please scan a table QR code or specify a valid café.');
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
