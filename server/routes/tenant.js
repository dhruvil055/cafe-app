import express from 'express';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import { protect, authorizeRoles } from '../middleware/auth.js';
import { decryptTenantCredentials, encryptTenantCredentials, publicTenantSettings } from '../utils/tenantSecrets.js';
import { verifyTableQrToken } from '../utils/tableQr.js';

const router = express.Router();

router.get('/public', async (req, res, next) => {
  try {
    let tenant = null;

    // 1. Check tableToken first if provided in query or header
    const tableToken = req.query?.tableToken || req.headers['x-table-token'];
    if (tableToken) {
      const claims = verifyTableQrToken(tableToken);
      if (claims?.tenantId && mongoose.isValidObjectId(claims.tenantId)) {
        tenant = await Tenant.findById(claims.tenantId).lean();
      }
    }

    // 2. Check cafe / cafeId / tenant / slug query or headers
    if (!tenant) {
      const identifier = String(
        req.query?.cafe ||
        req.query?.cafeId ||
        req.query?.slug ||
        req.query?.tenant ||
        req.headers['x-tenant-id'] ||
        req.headers['x-tenant-slug'] ||
        ''
      ).trim();

      if (identifier) {
        if (mongoose.isValidObjectId(identifier)) {
          tenant = await Tenant.findById(identifier).lean();
        }
        if (!tenant) {
          tenant = await Tenant.findOne({ slug: identifier.toLowerCase() }).lean();
        }
      }
    }

    // 3. Fall back to req.tenant (resolved from subdomain / host by tenantResolver)
    if (!tenant && req.tenant) {
      tenant = req.tenant;
    }

    // NEVER fall back to another cafe or first active tenant!
    if (!tenant) {
      return res.status(404).json({
        error: 'Café not found. Please scan a valid table QR code or check the URL.',
        code: 'TENANT_NOT_FOUND',
      });
    }

    if (tenant.status !== 'active') {
      return res.status(423).json({
        error: 'This café account is suspended.',
        code: 'TENANT_SUSPENDED',
      });
    }

    return res.set('Cache-Control', 'private, no-cache').json({
      tenant: publicTenantSettings(tenant),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', protect, authorizeRoles('owner'), async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).select('+paymentCredentialsEncrypted').lean();
    const credentials = decryptTenantCredentials(tenant.paymentCredentialsEncrypted);
    res.json({
      tenant: publicTenantSettings(tenant),
      payment: { keyId: credentials.keyId, configured: Boolean(credentials.keyId && credentials.keySecret && credentials.webhookSecret) },
    });
  } catch (error) { next(error); }
});

router.put('/settings', protect, authorizeRoles('owner'), async (req, res, next) => {
  try {
    const input = req.body?.settings || {};
    const name = String(input.cafeName || '').trim();
    const currency = String(input.currency || '').trim().toUpperCase();
    const timezone = String(input.timezone || '').trim();
    if (!name || name.length > 100) return res.status(400).json({ error: 'Café name is required and must be 100 characters or fewer.' });
    if (!/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ error: 'Currency must be a three-letter ISO code.' });
    try { new Intl.NumberFormat('en', { style: 'currency', currency }); } catch { return res.status(400).json({ error: 'Currency code is not supported.' }); }
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { return res.status(400).json({ error: 'A valid timezone is required.' }); }
    const taxRate = Number(input.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return res.status(400).json({ error: 'Tax rate must be between 0 and 100.' });
    const primaryColor = String(input.primaryColor || '');
    const accentColor = String(input.accentColor || '');
    if (!/^#[0-9a-f]{6}$/i.test(primaryColor) || !/^#[0-9a-f]{6}$/i.test(accentColor)) return res.status(400).json({ error: 'Brand colors must be six-digit hex colors.' });
    const logoUrl = String(input.logoUrl || '').trim();
    if (logoUrl) { try { if (!['http:', 'https:'].includes(new URL(logoUrl).protocol)) throw new Error('invalid'); } catch { return res.status(400).json({ error: 'Logo URL must use HTTP or HTTPS.' }); } }
    const heroImageUrl = String(input.heroImageUrl || '').trim();
    if (heroImageUrl) { try { if (!['http:', 'https:'].includes(new URL(heroImageUrl).protocol)) throw new Error('invalid'); } catch { return res.status(400).json({ error: 'Hero image URL must use HTTP or HTTPS.' }); } }
    const tagline = String(input.tagline || '').trim().slice(0, 200);
    const contactEmail = String(input.contactEmail || '').trim().toLowerCase();
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return res.status(400).json({ error: 'Contact email is invalid.' });
    const openingHours = input.openingHours && typeof input.openingHours === 'object' && !Array.isArray(input.openingHours) ? input.openingHours : {};
    const patch = {
      name,
      'settings.cafeName': name,
      'settings.logoUrl': logoUrl.slice(0, 2048),
      'settings.heroImageUrl': heroImageUrl.slice(0, 2048),
      'settings.tagline': tagline,
      'settings.primaryColor': primaryColor,
      'settings.accentColor': accentColor,
      'settings.currency': currency,
      'settings.timezone': timezone,
      'settings.gstNumber': String(input.gstNumber || '').trim().slice(0, 32),
      'settings.taxRate': taxRate,
      'settings.address': String(input.address || '').trim().slice(0, 500),
      'settings.contactEmail': contactEmail.slice(0, 254),
      'settings.contactPhone': String(input.contactPhone || '').trim().slice(0, 32),
      'settings.openingHours': openingHours,
    };
    const payment = req.body?.payment;
    if (payment && Object.keys(payment).length) {
      const keyId = String(payment.keyId || '').trim();
      const keySecret = String(payment.keySecret || '').trim();
      const webhookSecret = String(payment.webhookSecret || '').trim();
      const clearing = payment.clear === true && !keyId && !keySecret && !webhookSecret;
      if (!clearing && (!keyId || !keySecret || !webhookSecret)) return res.status(400).json({ error: 'Enter the Razorpay key ID, key secret, and webhook secret together.' });
      if (!clearing) patch.paymentCredentialsEncrypted = encryptTenantCredentials({ keyId, keySecret, webhookSecret });
      else patch.paymentCredentialsEncrypted = '';
    }
    const tenant = await Tenant.findByIdAndUpdate(req.tenantId, { $set: patch }, { new: true, runValidators: true }).select('+paymentCredentialsEncrypted').lean();
    const credentials = decryptTenantCredentials(tenant.paymentCredentialsEncrypted);
    res.json({ tenant: publicTenantSettings(tenant), payment: { keyId: credentials.keyId, configured: Boolean(credentials.keyId && credentials.keySecret && credentials.webhookSecret) } });
  } catch (error) { next(error); }
});

export default router;
