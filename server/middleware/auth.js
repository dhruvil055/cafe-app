import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { tenantFromAuthenticatedUser } from './tenant.js';
import { runWithSystemTenantAccess } from '../utils/tenantContext.js';
import { getRedisClient } from '../config/redis.js';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT secret is not configured or is too short.');
  }
  return secret;
};

// Per-IP login attempt tracker & lockout:
// Uses Redis TTL keys in production; falls back to in-memory tracking when REDIS_URL is unset or Redis is down.
const loginAttemptsByIp = new Map();
const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_WINDOW_SECONDS = 15 * 60; // 15 mins
const LOCKOUT_DURATION_SECONDS = 30 * 60; // 30 mins

export const checkIpLockout = async (ip) => {
  if (!ip || ip === 'unknown') return false;

  const redis = getRedisClient();
  if (redis) {
    try {
      const isLocked = await redis.get(`auth:lockout:${ip}`);
      if (isLocked) return true;
      return false;
    } catch (err) {
      console.warn('[Auth Lockout] Redis check failed, falling back to in-memory:', err.message);
    }
  }

  // In-memory fallback
  const now = Date.now();
  const record = loginAttemptsByIp.get(ip);
  if (!record) return false;
  if (now - record.firstAttempt > LOCKOUT_WINDOW_SECONDS * 1000) {
    loginAttemptsByIp.delete(ip);
    return false;
  }
  if (record.count >= LOCKOUT_THRESHOLD && now - record.lockedUntil < LOCKOUT_DURATION_SECONDS * 1000) {
    return true;
  }
  if (record.count >= LOCKOUT_THRESHOLD && now - record.lockedUntil >= LOCKOUT_DURATION_SECONDS * 1000) {
    loginAttemptsByIp.delete(ip);
    return false;
  }
  return false;
};

export const recordLoginAttempt = async (ip, success) => {
  if (!ip || ip === 'unknown') return;

  const redis = getRedisClient();
  if (redis) {
    try {
      if (success) {
        await redis.del(`auth:attempts:${ip}`, `auth:lockout:${ip}`);
        loginAttemptsByIp.delete(ip);
        return;
      }
      const attemptsKey = `auth:attempts:${ip}`;
      const count = await redis.incr(attemptsKey);
      if (count === 1) {
        await redis.expire(attemptsKey, LOCKOUT_WINDOW_SECONDS);
      }
      if (count >= LOCKOUT_THRESHOLD) {
        await redis.set(`auth:lockout:${ip}`, '1', 'EX', LOCKOUT_DURATION_SECONDS);
      }
    } catch (err) {
      console.warn('[Auth Lockout] Redis record failed, falling back to in-memory:', err.message);
    }
  }

  // In-memory fallback tracking
  const now = Date.now();
  if (success) {
    loginAttemptsByIp.delete(ip);
    return;
  }
  const record = loginAttemptsByIp.get(ip) || { count: 0, firstAttempt: now, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= LOCKOUT_THRESHOLD) {
    record.lockedUntil = now + (LOCKOUT_DURATION_SECONDS * 1000);
  }
  loginAttemptsByIp.set(ip, record);
};

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  if (req.cookies && req.cookies.brewhaus_access_token) return req.cookies.brewhaus_access_token;

  return null;
};

export const protect = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication is required.',
        },
        message: 'Authentication is required.',
      });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.tokenUse !== 'access') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Authentication token is invalid or expired.',
        },
        message: 'Authentication token is invalid or expired.',
      });
    }
    if (!req.tenantId && decoded.tenantId) {
      req.tenantId = decoded.tenantId;
    }
    if (decoded.tenantId && req.tenantId && String(decoded.tenantId) !== String(req.tenantId)) {
      return res.status(404).json({ error: 'Café not found.', code: 'TENANT_NOT_FOUND' });
    }

    const user = await runWithSystemTenantAccess(async () => {
      return User.findById(decoded.id).select('-password');
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'User not found.',
        },
        message: 'User not found.',
      });
    }

    if (user.tenantId && req.tenantId && String(user.tenantId) !== String(req.tenantId)) {
      return res.status(404).json({ error: 'Café not found.', code: 'TENANT_NOT_FOUND' });
    }
    req.user = user;
    if (decoded.impersonatedBy) {
      req.impersonatedBy = decoded.impersonatedBy;
      req.user.impersonatedBy = decoded.impersonatedBy;
    }
    return tenantFromAuthenticatedUser(req, res, next);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Authentication token is invalid or expired.',
        },
        message: 'Token expired. Please login again.',
      });
    }
    if (error.message.includes('JWT secret')) {
      return res.status(500).json({ error: 'Server authentication is misconfigured.' });
    }
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired.',
      },
      message: 'Invalid token.',
    });
  }
};

export const adminOnly = (req, res, next) => {
  return authorizeRoles('owner')(req, res, next);
};

export const staffOrAdmin = (req, res, next) => {
  return authorizeRoles('owner', 'manager', 'cashier', 'kitchen')(req, res, next);
};

export const effectiveRole = (user) => ({ admin: 'owner', staff: 'manager' }[user?.role] || user?.role);

export const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  const role = effectiveRole(req.user);
  if (!role || !allowedRoles.includes(role)) return res.status(403).json({ error: 'Your role is not allowed to perform this action.' });
  next();
};

export const ownerOrManager = authorizeRoles('owner', 'manager');
export const orderReaders = authorizeRoles('owner', 'manager', 'cashier', 'kitchen');
export const kitchenStaff = authorizeRoles('owner', 'manager', 'kitchen');
export const cashiers = authorizeRoles('owner', 'manager', 'cashier');
export const tableServiceStaff = authorizeRoles('owner', 'manager', 'cashier', 'kitchen');

export const checkIpLockoutForLogin = checkIpLockout;
export const recordLoginAttemptForIp = recordLoginAttempt;
