import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { tenantFromAuthenticatedUser } from './tenant.js';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT secret is not configured or is too short.');
  }
  return secret;
};

// Per-IP login attempt tracker (in-memory with TTL; replace with Redis in prod)
const loginAttemptsByIp = new Map();
const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

const checkIpLockout = (ip) => {
  const now = Date.now();
  const record = loginAttemptsByIp.get(ip);
  if (!record) return false;
  if (now - record.firstAttempt > LOCKOUT_WINDOW_MS) {
    loginAttemptsByIp.delete(ip);
    return false;
  }
  if (record.count >= LOCKOUT_THRESHOLD && now - record.lockedUntil < LOCKOUT_DURATION_MS) {
    return true;
  }
  if (record.count >= LOCKOUT_THRESHOLD && now - record.lockedUntil >= LOCKOUT_DURATION_MS) {
    loginAttemptsByIp.delete(ip);
    return false;
  }
  return false;
};

const recordLoginAttempt = (ip, success) => {
  const now = Date.now();
  if (success) {
    loginAttemptsByIp.delete(ip);
    return;
  }
  const record = loginAttemptsByIp.get(ip) || { count: 0, firstAttempt: now, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= LOCKOUT_THRESHOLD) record.lockedUntil = now + LOCKOUT_DURATION_MS;
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
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.tokenUse !== 'access') return res.status(401).json({ error: 'Invalid access token.' });
    if (!decoded.tenantId || String(decoded.tenantId) !== String(req.tenantId)) return res.status(404).json({ error: 'Café not found.', code: 'TENANT_NOT_FOUND' });

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    if (String(user.tenantId) !== String(req.tenantId)) return res.status(404).json({ error: 'Café not found.', code: 'TENANT_NOT_FOUND' });
    req.user = user;
    if (decoded.impersonatedBy) {
      req.impersonatedBy = decoded.impersonatedBy;
      req.user.impersonatedBy = decoded.impersonatedBy;
    }
    return tenantFromAuthenticatedUser(req, res, next);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    if (error.message.includes('JWT secret')) {
      return res.status(500).json({ error: 'Server authentication is misconfigured.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
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
