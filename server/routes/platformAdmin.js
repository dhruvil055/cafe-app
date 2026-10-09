import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import SuperAdmin from '../models/SuperAdmin.js';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Table from '../models/Table.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Category from '../models/Category.js';
import Customer from '../models/Customer.js';
import PlatformAuditEvent from '../models/PlatformAuditEvent.js';
import PlatformSettings from '../models/PlatformSettings.js';
import { runWithSystemTenantAccess } from '../utils/tenantContext.js';
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
  encryptTwoFactorSecret,
  decryptTwoFactorSecret,
  generateTotpSecret,
  verifyTotpCode,
} from '../utils/authTokens.js';
import { setSessionCookies } from './auth.js';

const router = express.Router();

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT secret is not configured or is too short.');
  }
  return secret;
};

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Middleware: Verify platform super admin token
export const superAdminProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.brewhaus_superadmin_token) {
      token = req.cookies.brewhaus_superadmin_token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Super-admin access required.' });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    // PHASE 6: CRITICAL PRIVILEGE ESCALATION PREVENTION
    // Impersonated tokens MUST NEVER access platform super-admin APIs
    if (decoded.isImpersonated) {
      return res.status(403).json({
        error: 'Impersonated session cannot access platform administration endpoints.',
        code: 'FORBIDDEN_IMPERSONATED_ACCESS',
      });
    }

    if (decoded.role !== 'super_admin' || !decoded.id) {
      return res.status(403).json({ error: 'Super-admin privilege required.' });
    }

    const admin = await SuperAdmin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ error: 'Super-admin user not found.' });
    }

    req.superAdmin = admin;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid super-admin token.' });
  }
};

// POST /api/platform/admin/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, twoFactorCode } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!cleanEmail || !rawPassword) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Auto-bootstrap super admin in development or if none exists
    const superAdminCount = await SuperAdmin.countDocuments();
    if (superAdminCount === 0) {
      const defaultEmail = (process.env.SUPER_ADMIN_EMAIL || 'admin@brewhaus.com').toLowerCase();
      const defaultPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
      if (cleanEmail === defaultEmail && rawPassword === defaultPassword) {
        await SuperAdmin.create({
          name: 'Platform Super Admin',
          email: defaultEmail,
          password: defaultPassword,
          role: 'super_admin',
        });
      }
    }

    const admin = await SuperAdmin.findOne({ email: cleanEmail }).select(
      '+password +failedLoginAttempts +loginLockUntil +twoFactorSecretEncrypted +backupCodes'
    );
    if (!admin) {
      return res.status(401).json({ error: 'Invalid platform credentials.' });
    }

    // Check account lockout
    if (admin.loginLockUntil && admin.loginLockUntil > new Date()) {
      const waitMinutes = Math.ceil((admin.loginLockUntil.getTime() - Date.now()) / (60 * 1000));
      return res.status(423).json({
        error: `Account locked due to excessive failed attempts. Please retry in ${waitMinutes} minute(s).`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    const isMatch = await admin.comparePassword(rawPassword);
    if (!isMatch) {
      admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
      if (admin.failedLoginAttempts >= 5) {
        admin.loginLockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lock
        await PlatformAuditEvent.create({
          actorId: admin._id,
          actorEmail: admin.email,
          action: 'auth.account_locked',
          ip: req.ip,
          details: { failedAttempts: admin.failedLoginAttempts },
        });
      }
      await admin.save();
      await PlatformAuditEvent.create({
        actorEmail: cleanEmail,
        action: 'auth.login_failed',
        ip: req.ip,
        details: { reason: 'bad_password', attempts: admin.failedLoginAttempts },
      });
      return res.status(401).json({ error: 'Invalid platform credentials.' });
    }

    // Verify 2FA if enabled
    if (admin.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(200).json({
          require2fa: true,
          message: 'Two-factor authentication code required.',
        });
      }

      let codeValid = false;
      if (admin.twoFactorSecretEncrypted) {
        try {
          const secret = decryptTwoFactorSecret(admin.twoFactorSecretEncrypted);
          codeValid = verifyTotpCode(secret, twoFactorCode);
        } catch (_) {
          // Ignore 2FA verification failure
        }
      }

      // Check backup codes
      if (!codeValid && admin.backupCodes && admin.backupCodes.length > 0) {
        const hashedAttempt = hashToken(twoFactorCode.trim());
        const matchedBackup = admin.backupCodes.find((b) => b.codeHash === hashedAttempt && !b.used);
        if (matchedBackup) {
          matchedBackup.used = true;
          codeValid = true;
        }
      }

      if (!codeValid) {
        admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
        await admin.save();
        await PlatformAuditEvent.create({
          actorEmail: cleanEmail,
          action: 'auth.login_failed_2fa',
          ip: req.ip,
          details: { attempts: admin.failedLoginAttempts },
        });
        return res.status(401).json({ error: 'Invalid two-factor authentication code or backup code.' });
      }
    }

    // Reset login lock & failed attempts on successful login
    admin.failedLoginAttempts = 0;
    admin.loginLockUntil = null;

    // Create short-lived access token (15min) and long-lived refresh token
    const accessToken = jwt.sign(
      { id: admin._id, role: 'super_admin', email: admin.email },
      getJwtSecret(),
      { expiresIn: '15m' }
    );
    const refreshToken = createRefreshToken();
    admin.refreshTokenHash = hashToken(refreshToken);
    admin.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await admin.save();

    await PlatformAuditEvent.create({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'auth.login',
      ip: req.ip,
      details: { userAgent: req.headers['user-agent'] },
    });

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('brewhaus_superadmin_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('brewhaus_superadmin_refresh', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_TTL_MS,
    });

    res.json({
      token: accessToken,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: 'super_admin',
        twoFactorEnabled: Boolean(admin.twoFactorEnabled),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/platform/admin/me
router.get('/me', superAdminProtect, (req, res) => {
  res.json({
    admin: {
      id: req.superAdmin._id,
      name: req.superAdmin.name,
      email: req.superAdmin.email,
      role: 'super_admin',
      twoFactorEnabled: Boolean(req.superAdmin.twoFactorEnabled),
    },
  });
});

// POST /api/platform/admin/logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.brewhaus_superadmin_token) {
      token = req.cookies.brewhaus_superadmin_token;
    }
    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret());
        if (decoded.id) {
          await SuperAdmin.updateOne(
            { _id: decoded.id },
            { $set: { refreshTokenHash: '', refreshTokenExpiresAt: null } }
          );
          await PlatformAuditEvent.create({
            actorId: decoded.id,
            actorEmail: decoded.email || '',
            action: 'auth.logout',
            ip: req.ip,
          });
        }
      } catch (_) {
        // Ignore token decode error on logout audit
      }
    }
  } catch (_) {
    // Ignore outer token decode error on logout
  }

  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('brewhaus_superadmin_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
  res.clearCookie('brewhaus_superadmin_refresh', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
  res.json({ success: true });
});

// POST /api/platform/admin/refresh
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.brewhaus_superadmin_refresh;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh session missing.' });

    const providedHash = hashToken(refreshToken);
    const admin = await SuperAdmin.findOne({
      refreshTokenHash: providedHash,
      refreshTokenExpiresAt: { $gt: new Date() },
    });
    if (!admin) {
      res.clearCookie('brewhaus_superadmin_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      res.clearCookie('brewhaus_superadmin_refresh', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      return res.status(401).json({ error: 'Refresh session expired.' });
    }

    // Token rotation
    const newRefreshToken = createRefreshToken();
    admin.refreshTokenHash = hashToken(newRefreshToken);
    admin.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await admin.save();

    const newAccessToken = jwt.sign(
      { id: admin._id, role: 'super_admin', email: admin.email },
      getJwtSecret(),
      { expiresIn: '15m' }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('brewhaus_superadmin_token', newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('brewhaus_superadmin_refresh', newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_TTL_MS,
    });

    res.json({
      token: newAccessToken,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: 'super_admin',
        twoFactorEnabled: Boolean(admin.twoFactorEnabled),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to refresh super-admin session.' });
  }
});

// 2FA Endpoints for Super Admin
// POST /api/platform/admin/2fa/setup
router.post('/2fa/setup', superAdminProtect, async (req, res, next) => {
  try {
    const admin = await SuperAdmin.findById(req.superAdmin._id).select('+twoFactorSecretEncrypted');
    if (admin.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is already enabled.' });
    }
    const secret = generateTotpSecret();
    admin.twoFactorSecretEncrypted = encryptTwoFactorSecret(secret);
    await admin.save();
    const otpauthUrl = `otpauth://totp/Brewhaus:${encodeURIComponent(admin.email)}?secret=${secret}&issuer=Brewhaus%20SaaS`;
    res.json({ secret, otpauthUrl });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/admin/2fa/verify
router.post('/2fa/verify', superAdminProtect, async (req, res, next) => {
  try {
    const { code } = req.body || {};
    const admin = await SuperAdmin.findById(req.superAdmin._id).select('+twoFactorSecretEncrypted');
    if (!admin.twoFactorSecretEncrypted) {
      return res.status(400).json({ error: '2FA has not been initiated. Please run setup first.' });
    }
    const secret = decryptTwoFactorSecret(admin.twoFactorSecretEncrypted);
    if (!verifyTotpCode(secret, code)) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }
    admin.twoFactorEnabled = true;

    // Generate 8 backup codes
    const plainBackupCodes = [];
    admin.backupCodes = [];
    for (let i = 0; i < 8; i++) {
      const plainCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      plainBackupCodes.push(plainCode);
      admin.backupCodes.push({ codeHash: hashToken(plainCode), used: false });
    }
    await admin.save();

    await PlatformAuditEvent.create({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'auth.2fa_enabled',
      ip: req.ip,
    });

    res.json({ success: true, backupCodes: plainBackupCodes });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/admin/2fa/disable
router.post('/2fa/disable', superAdminProtect, async (req, res, next) => {
  try {
    const { password, code } = req.body || {};
    const admin = await SuperAdmin.findById(req.superAdmin._id).select('+password +twoFactorSecretEncrypted');
    const isMatch = await admin.comparePassword(String(password || ''));
    if (!isMatch) {
      return res.status(401).json({ error: 'Password required to disable 2FA.' });
    }
    if (admin.twoFactorSecretEncrypted && code) {
      const secret = decryptTwoFactorSecret(admin.twoFactorSecretEncrypted);
      if (!verifyTotpCode(secret, code)) {
        return res.status(400).json({ error: 'Invalid 2FA code.' });
      }
    }
    admin.twoFactorEnabled = false;
    admin.twoFactorSecretEncrypted = '';
    admin.backupCodes = [];
    await admin.save();

    await PlatformAuditEvent.create({
      actorId: admin._id,
      actorEmail: admin.email,
      action: 'auth.2fa_disabled',
      ip: req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/admin/metrics — Expanded SaaS Platform Analytics
router.get('/metrics', superAdminProtect, async (req, res, next) => {
  try {
    const { from, to } = req.query || {};
    const dateMatch = {};
    if (from || to) {
      dateMatch.createdAt = {};
      if (from) dateMatch.createdAt.$gte = new Date(from);
      if (to) dateMatch.createdAt.$lte = new Date(`${to}T23:59:59.999`);
    }

    const data = await runWithSystemTenantAccess(async () => {
      const [
        totalTenants,
        activeTenants,
        trialTenants,
        suspendedTenants,
        cancelledTenants,
        planBreakdownRaw,
        activeUsers,
        totalOrders,
        gmvAgg,
        recentOrdersCount,
        paymentFailuresCount,
      ] = await Promise.all([
        Tenant.countDocuments(),
        Tenant.countDocuments({ status: 'active' }),
        Tenant.countDocuments({ $or: [{ 'subscription.status': 'trialing' }, { status: 'trial' }] }),
        Tenant.countDocuments({ status: 'suspended' }),
        Tenant.countDocuments({ 'subscription.status': 'cancelled' }),
        Tenant.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]),
        User.countDocuments({ active: true }),
        Order.countDocuments(dateMatch),
        Order.aggregate([
          { $match: { ...dateMatch, paymentStatus: 'paid' } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ]),
        Order.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        }),
        PlatformAuditEvent.countDocuments({ action: { $regex: 'fail|lock|error', $options: 'i' } }),
      ]);

      const planBreakdown = {};
      for (const item of planBreakdownRaw) {
        planBreakdown[item._id || 'starter'] = item.count;
      }

      // Plan pricing for MRR estimation
      const PLAN_RATES = { starter: 999, pro: 2499, enterprise: 4999 };
      let mrr = 0;
      for (const [planName, count] of Object.entries(planBreakdown)) {
        mrr += (PLAN_RATES[planName.toLowerCase()] || 999) * count;
      }
      const arr = mrr * 12;

      const totalGmv = Math.round((gmvAgg[0]?.total || 0) * 100) / 100;
      const avgOrderValue = totalOrders > 0 ? Math.round(totalGmv / totalOrders) : 0;
      const ordersPerDay = Math.round((recentOrdersCount / 30) * 10) / 10;
      const churnRate = totalTenants > 0 ? Number(((cancelledTenants / totalTenants) * 100).toFixed(1)) : 0;
      const trialConversion = totalTenants > 0 ? Number(((activeTenants / totalTenants) * 100).toFixed(1)) : 0;

      return {
        totalTenants,
        activeTenants,
        trialTenants,
        suspendedTenants,
        cancelledTenants,
        activeUsers,
        planBreakdown,
        mrr,
        arr,
        churnRate,
        trialConversion,
        totalOrders,
        ordersPerDay,
        totalGmv,
        avgOrderValue,
        paymentFailures: paymentFailuresCount,
      };
    });

    res.json({ metrics: data });
  } catch (error) {
    next(error);
  }
});

// GET /api/platform/admin/tenants
router.get('/tenants', superAdminProtect, async (req, res, next) => {
  try {
    const tenants = await runWithSystemTenantAccess(async () => {
      const list = await Tenant.find().sort({ createdAt: -1 }).lean();
      const enriched = await Promise.all(
        list.map(async (t) => {
          const [owner, tableCount, productCount] = await Promise.all([
            User.findOne({ tenantId: t._id, role: { $in: ['owner', 'admin'] } }).select('email name').lean(),
            Table.countDocuments({ tenantId: t._id }),
            Product.countDocuments({ tenantId: t._id }),
          ]);

          return {
            id: t._id,
            name: t.settings?.cafeName || t.name,
            slug: t.slug,
            status: t.status,
            plan: t.plan,
            subscription: t.subscription || { status: 'trial', plan: t.plan },
            ownerEmail: owner?.email || 'N/A',
            ownerName: owner?.name || 'N/A',
            tableCount,
            productCount,
            createdAt: t.createdAt,
            settings: {
              cafeName: t.settings?.cafeName || t.name,
              logoUrl: t.settings?.logoUrl || '',
              tagline: t.settings?.tagline || '',
              primaryColor: t.settings?.primaryColor || '#c96b18',
              accentColor: t.settings?.accentColor || '#1a0f08',
              currency: t.settings?.currency || 'INR',
              taxRate: Number(t.settings?.taxRate ?? 5),
              address: t.settings?.address || '',
              contactEmail: t.settings?.contactEmail || '',
              contactPhone: t.settings?.contactPhone || '',
              openingHours: t.settings?.openingHours || {},
            },
          };
        })
      );
      return enriched;
    });

    res.json({ tenants });
  } catch (error) {
    next(error);
  }
});

// POST /api/platform/admin/tenants
router.post('/tenants', superAdminProtect, async (req, res, next) => {
  try {
    const { name, slug, email, password, plan = 'starter' } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const cleanSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).trim();
    const existing = await Tenant.findOne({ slug: cleanSlug });
    if (existing) {
      return res.status(409).json({ error: 'Tenant with this slug already exists.' });
    }

    const tenant = await Tenant.create({
      name,
      slug: cleanSlug,
      plan,
      status: 'active',
    });

    const user = await User.create({
      name: `${name} Owner`,
      email: email.toLowerCase().trim(),
      password,
      role: 'owner',
      tenantId: tenant._id,
    });

    await PlatformAuditEvent.create({
      actorId: req.superAdmin._id,
      actorEmail: req.superAdmin.email,
      action: 'tenant.create',
      targetTenantId: tenant._id,
      targetTenantSlug: tenant.slug,
      details: { ownerEmail: user.email, plan },
      ip: req.ip,
    });

    res.status(201).json({ success: true, tenant, owner: { id: user._id, email: user.email } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/platform/admin/tenants/:id/status
router.put('/tenants/:id/status', superAdminProtect, async (req, res, next) => {
  try {
    const { status, reason } = req.body || {};
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or suspended.' });
    }

    const tenant = await runWithSystemTenantAccess(async () => {
      const existing = await Tenant.findById(req.params.id);
      if (!existing) return null;

      const previousStatus = existing.status;
      existing.status = status;
      if (status === 'suspended') {
        if (!existing.subscription) existing.subscription = {};
        existing.subscription.status = 'suspended';
      } else if (status === 'active' && existing.subscription?.status === 'suspended') {
        existing.subscription.status = 'active';
      }
      await existing.save();

      const actionName = status === 'active' ? 'tenant.reactivate' : 'tenant.suspend';
      await PlatformAuditEvent.create({
        actorId: req.superAdmin._id,
        actorEmail: req.superAdmin.email,
        action: actionName,
        targetTenantId: existing._id,
        targetTenantSlug: existing.slug,
        details: { previousStatus, newStatus: status, reason: reason || 'Manual super-admin change' },
        ip: req.ip,
      });

      return existing;
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    res.json({ success: true, tenant });
  } catch (error) {
    next(error);
  }
});

// PUT /api/platform/admin/tenants/:id/plan
router.put('/tenants/:id/plan', superAdminProtect, async (req, res, next) => {
  try {
    const { plan } = req.body || {};
    if (!['starter', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan name.' });
    }

    const tenant = await runWithSystemTenantAccess(async () => {
      const existing = await Tenant.findById(req.params.id);
      if (!existing) return null;

      const prevPlan = existing.plan;
      existing.plan = plan;
      if (existing.subscription) {
        existing.subscription.plan = plan;
      }
      await existing.save();

      await PlatformAuditEvent.create({
        actorId: req.superAdmin._id,
        actorEmail: req.superAdmin.email,
        action: 'tenant.plan_change',
        targetTenantId: existing._id,
        targetTenantSlug: existing.slug,
        details: { previousPlan: prevPlan, newPlan: plan },
        ip: req.ip,
      });

      return existing;
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    res.json({ success: true, tenant });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/platform/admin/tenants/:id
router.delete('/tenants/:id', superAdminProtect, async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

    // Safe suspension / archive
    tenant.status = 'suspended';
    await tenant.save();

    await PlatformAuditEvent.create({
      actorId: req.superAdmin._id,
      actorEmail: req.superAdmin.email,
      action: 'tenant.delete',
      targetTenantId: tenant._id,
      targetTenantSlug: tenant.slug,
      details: { actionType: 'archived_suspended' },
      ip: req.ip,
    });

    res.json({ success: true, message: 'Tenant archived and suspended.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/admin/tenants/:id/export
router.get('/tenants/:id/export', superAdminProtect, async (req, res, next) => {
  try {
    const data = await runWithSystemTenantAccess(async () => {
      const tenant = await Tenant.findById(req.params.id).lean();
      if (!tenant) return null;
      const [products, orders, tables, customers, categories] = await Promise.all([
        Product.find({ tenantId: tenant._id }).lean(),
        Order.find({ tenantId: tenant._id }).limit(500).sort({ createdAt: -1 }).lean(),
        Table.find({ tenantId: tenant._id }).lean(),
        Customer.find({ tenantId: tenant._id }).lean(),
        Category.find({ tenantId: tenant._id }).lean(),
      ]);
      return { tenant, products, orders, tables, customers, categories };
    });

    if (!data) return res.status(404).json({ error: 'Tenant not found.' });

    await PlatformAuditEvent.create({
      actorId: req.superAdmin._id,
      actorEmail: req.superAdmin.email,
      action: 'tenant.export_data',
      targetTenantId: req.params.id,
      ip: req.ip,
    });

    res.json({ success: true, export: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/admin/tenants/:id/impersonate
router.post('/tenants/:id/impersonate', superAdminProtect, async (req, res, next) => {
  try {
    const { reason = 'Support and troubleshooting' } = req.body || {};
    const result = await runWithSystemTenantAccess(async () => {
      const tenant = await Tenant.findById(req.params.id);
      if (!tenant) return null;

      // Find owner or admin user for this tenant
      let owner = await User.findOne({ tenantId: tenant._id, role: { $in: ['owner', 'admin'] } });
      if (!owner) {
        owner = await User.findOne({ tenantId: tenant._id });
      }

      if (!owner) {
        owner = await User.create({
          tenantId: tenant._id,
          name: `${tenant.name} Owner`,
          email: `owner@${tenant.slug}.local`,
          password: 'TemporaryImpersonationPassword123!',
          role: 'owner',
        });
      }

      const impersonationSessionId = crypto.randomUUID();
      const accessToken = createAccessToken(owner._id, tenant._id, {
        role: owner.role,
        isImpersonated: true,
        originalSuperAdminId: String(req.superAdmin._id),
        impersonatedBy: req.superAdmin.email,
        impersonationSessionId,
      });

      const refreshToken = createRefreshToken();
      owner.refreshTokenHash = hashRefreshToken(refreshToken);
      owner.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
      await owner.save();

      await PlatformAuditEvent.create({
        actorId: req.superAdmin._id,
        actorEmail: req.superAdmin.email,
        action: 'tenant.impersonate_start',
        targetTenantId: tenant._id,
        targetTenantSlug: tenant.slug,
        details: {
          reason,
          targetUserId: owner._id,
          targetEmail: owner.email,
          impersonationSessionId,
        },
        ip: req.ip,
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: owner._id,
          name: owner.name,
          email: owner.email,
          role: owner.role,
          tenantId: tenant._id,
          isImpersonated: true,
          impersonatedBy: req.superAdmin.email,
        },
        tenant: {
          id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
        },
      };
    });

    if (!result) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    setSessionCookies(res, result.accessToken, result.refreshToken);

    res.json({
      token: result.accessToken,
      user: result.user,
      tenant: result.tenant,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/platform/admin/exit-impersonation
router.post('/exit-impersonation', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.brewhaus_token) {
      token = req.cookies.brewhaus_token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret());
        if (decoded.isImpersonated) {
          await PlatformAuditEvent.create({
            actorEmail: decoded.impersonatedBy || 'SuperAdmin',
            action: 'tenant.impersonate_exit',
            targetTenantId: decoded.tenantId,
            details: {
              impersonationSessionId: decoded.impersonationSessionId,
              targetUserId: decoded.id,
            },
            ip: req.ip,
          });
        }
      } catch (_) {
        // Ignore token decode error on exit impersonation
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('brewhaus_token', { httpOnly: true, secure: isProduction, sameSite: isProduction ? 'none' : 'lax', path: '/' });
    res.clearCookie('brewhaus_refresh_token', { httpOnly: true, secure: isProduction, sameSite: isProduction ? 'none' : 'lax', path: '/' });

    res.json({ success: true, message: 'Impersonation ended.' });
  } catch (err) {
    next(err);
  }
});

// Platform Settings
// GET /api/platform/admin/settings
router.get('/settings', superAdminProtect, async (req, res, next) => {
  try {
    let settings = await PlatformSettings.findOne({ key: 'global' });
    if (!settings) {
      settings = await PlatformSettings.create({ key: 'global' });
    }
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/platform/admin/settings
router.put('/settings', superAdminProtect, async (req, res, next) => {
  try {
    const { platformName, supportEmail, trialDaysDefault, maintenanceMode, registrationOpen, bannerMessage } = req.body || {};
    let settings = await PlatformSettings.findOne({ key: 'global' });
    if (!settings) {
      settings = new PlatformSettings({ key: 'global' });
    }
    const previous = settings.toObject();
    if (platformName !== undefined) settings.platformName = platformName;
    if (supportEmail !== undefined) settings.supportEmail = supportEmail;
    if (trialDaysDefault !== undefined) settings.trialDaysDefault = Number(trialDaysDefault);
    if (maintenanceMode !== undefined) settings.maintenanceMode = Boolean(maintenanceMode);
    if (registrationOpen !== undefined) settings.registrationOpen = Boolean(registrationOpen);
    if (bannerMessage !== undefined) settings.bannerMessage = bannerMessage;
    settings.updatedBy = req.superAdmin._id;
    await settings.save();

    await PlatformAuditEvent.create({
      actorId: req.superAdmin._id,
      actorEmail: req.superAdmin.email,
      action: 'platform.settings_change',
      details: { previous, updated: settings.toObject() },
      ip: req.ip,
    });

    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/admin/audit-logs
router.get('/audit-logs', superAdminProtect, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      PlatformAuditEvent.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PlatformAuditEvent.countDocuments(),
    ]);

    res.json({ logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
});

export default router;
