import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import SuperAdmin from '../models/SuperAdmin.js';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Table from '../models/Table.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import PlatformAuditEvent from '../models/PlatformAuditEvent.js';
import { runWithSystemTenantAccess } from '../utils/tenantContext.js';
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
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

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

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
    const { email, password } = req.body || {};
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

    const admin = await SuperAdmin.findOne({ email: cleanEmail });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid platform credentials.' });
    }

    const isMatch = await admin.comparePassword(rawPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid platform credentials.' });
    }

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

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('brewhaus_superadmin_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
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
    },
  });
});

// POST /api/platform/admin/logout
router.post('/logout', (req, res) => {
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
    const admin = await SuperAdmin.findOne({ refreshTokenHash: providedHash, refreshTokenExpiresAt: { $gt: new Date() } });
    if (!admin) {
      res.clearCookie('brewhaus_superadmin_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      res.clearCookie('brewhaus_superadmin_refresh', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      return res.status(401).json({ error: 'Refresh session expired.' });
    }

    // Token reuse detection
    if (admin.refreshTokenHash !== providedHash) {
      // Token reuse detected — revoke all sessions
      await SuperAdmin.updateOne({ _id: admin._id }, { $set: { refreshTokenHash: '', refreshTokenExpiresAt: null } });
      res.clearCookie('brewhaus_superadmin_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      res.clearCookie('brewhaus_superadmin_refresh', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      await PlatformAuditEvent.create({
        actorId: admin._id,
        actorEmail: admin.email,
        action: 'auth.token_reuse_detected',
        targetType: 'SuperAdmin',
        targetId: admin._id,
        details: { ip: req.ip },
      });
      return res.status(401).json({ error: 'Session invalidated due to token reuse. Please log in again.' });
    }

    // Rotate: generate new refresh token, invalidate old
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
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to refresh super-admin session.' });
  }
});

// GET /api/platform/admin/metrics
router.get('/metrics', superAdminProtect, async (req, res, next) => {
  try {
    const data = await runWithSystemTenantAccess(async () => {
      const [
        totalTenants,
        activeTenants,
        suspendedTenants,
        planBreakdownRaw,
        totalOrders,
        gmvAgg,
      ] = await Promise.all([
        Tenant.countDocuments(),
        Tenant.countDocuments({ status: 'active' }),
        Tenant.countDocuments({ status: 'suspended' }),
        Tenant.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]),
        Order.countDocuments(),
        Order.aggregate([
          { $match: { 'payment.status': 'completed' } },
          { $group: { _id: null, total: { $sum: '$pricing.finalTotal' } } },
        ]),
      ]);

      const planBreakdown = {};
      for (const item of planBreakdownRaw) {
        planBreakdown[item._id || 'starter'] = item.count;
      }

      return {
        totalTenants,
        activeTenants,
        suspendedTenants,
        planBreakdown,
        totalOrders,
        totalGmv: Math.round((gmvAgg[0]?.total || 0) * 100) / 100,
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
            name: t.name,
            slug: t.slug,
            status: t.status,
            plan: t.plan,
            subscription: t.subscription || { status: 'trial', plan: t.plan },
            ownerEmail: owner?.email || 'N/A',
            ownerName: owner?.name || 'N/A',
            tableCount,
            productCount,
            createdAt: t.createdAt,
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
        existing.subscription.status = 'suspended';
      }
      await existing.save();

      await PlatformAuditEvent.create({
        actorId: req.superAdmin._id,
        actorEmail: req.superAdmin.email,
        action: 'tenant.status_change',
        targetTenantId: existing._id,
        targetTenantSlug: existing.slug,
        details: { previousStatus, newStatus: status, reason: reason || 'Manual admin change' },
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

// POST /api/platform/admin/tenants/:id/impersonate
router.post('/tenants/:id/impersonate', superAdminProtect, async (req, res, next) => {
  try {
    const result = await runWithSystemTenantAccess(async () => {
      const tenant = await Tenant.findById(req.params.id);
      if (!tenant) return null;

      // Find owner or admin user for this tenant
      let owner = await User.findOne({ tenantId: tenant._id, role: { $in: ['owner', 'admin'] } });
      if (!owner) {
        owner = await User.findOne({ tenantId: tenant._id });
      }

      if (!owner) {
        // Create an owner placeholder user if none exists
        owner = await User.create({
          tenantId: tenant._id,
          name: `${tenant.name} Owner`,
          email: `owner@${tenant.slug}.local`,
          password: 'TemporaryImpersonationPassword123!',
          role: 'owner',
        });
      }

      const accessToken = createAccessToken(owner._id, tenant._id, {
        impersonatedBy: req.superAdmin.email,
      });
      const refreshToken = createRefreshToken();
      owner.refreshTokenHash = hashRefreshToken(refreshToken);
      owner.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
      await owner.save();

      await PlatformAuditEvent.create({
        actorId: req.superAdmin._id,
        actorEmail: req.superAdmin.email,
        action: 'tenant.impersonate',
        targetTenantId: tenant._id,
        targetTenantSlug: tenant.slug,
        details: { targetUserId: owner._id, targetEmail: owner.email },
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

// GET /api/platform/admin/audit-logs
router.get('/audit-logs', superAdminProtect, async (req, res, next) => {
  try {
    const logs = await PlatformAuditEvent.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

export default router;
