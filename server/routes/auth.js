import express from 'express';
import QRCode from 'qrcode';
import User from '../models/User.js';
import AuditEvent from '../models/AuditEvent.js';
import { effectiveRole, protect, authorizeRoles, checkIpLockoutForLogin, recordLoginAttemptForIp } from '../middleware/auth.js';
import {
  createAccessToken,
  createRefreshToken,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
  generateTotpSecret,
  verifyTotpCode,
} from '../utils/authTokens.js';

const router = express.Router();

export const setSessionCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
  res.cookie('brewhaus_access_token', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('brewhaus_refresh_token', refreshToken, { ...cookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });
  res.clearCookie('brewhaus_admin_token', cookieOptions);
};

const clearAuthCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = { path: '/', httpOnly: true, secure: isProduction, sameSite: isProduction ? 'none' : 'lax' };
  for (const name of ['brewhaus_access_token', 'brewhaus_refresh_token', 'brewhaus_admin_token']) res.clearCookie(name, options);
};

const issueSession = async (user, res) => {
  const accessToken = createAccessToken(user._id, user.tenantId);
  const refreshToken = createRefreshToken();
  user.refreshTokenHash = hashRefreshToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await user.save();
  setSessionCookies(res, accessToken, refreshToken);
  return accessToken;
};

const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId });

const recordLoginFailure = async (user) => {
  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  if (user.failedLoginAttempts >= 5) user.loginLockUntil = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

    if (checkIpLockoutForLogin(clientIp)) {
      return res.status(429).json({ error: 'Too many failed login attempts from this IP. Try again later.', code: 'IP_LOCKED' });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password +failedLoginAttempts +loginLockUntil +twoFactorSecretEncrypted');
    if (!user) {
      recordLoginAttemptForIp(clientIp, false);
      await AuditEvent.create({
        actorId: null,
        actorEmail: normalizedEmail,
        actorRole: 'unknown',
        action: 'auth.login_failed',
        targetType: 'User',
        targetId: '',
        details: { ip: clientIp, reason: 'user_not_found' },
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.loginLockUntil && user.loginLockUntil > new Date()) {
      return res.status(423).json({ error: 'Login is temporarily locked. Try again later.', code: 'LOGIN_LOCKED' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await recordLoginFailure(user);
      recordLoginAttemptForIp(clientIp, false);
      await AuditEvent.create({
        actorId: user._id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'auth.login_failed',
        targetType: 'User',
        targetId: user._id,
        details: { ip: clientIp, reason: 'invalid_password' },
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.twoFactorEnabled && effectiveRole(user) === 'owner') {
      const secret = decryptTwoFactorSecret(user.twoFactorSecretEncrypted);
      if (!verifyTotpCode(secret, req.body?.twoFactorCode)) {
        await recordLoginFailure(user);
        recordLoginAttemptForIp(clientIp, false);
        await AuditEvent.create({
          actorId: user._id,
          actorEmail: user.email,
          actorRole: user.role,
          action: 'auth.login_failed',
          targetType: 'User',
          targetId: user._id,
          details: { ip: clientIp, reason: 'invalid_2fa' },
        });
        return res.status(401).json({ error: 'A valid authenticator code is required.', code: 'TWO_FACTOR_REQUIRED' });
      }
    }

    user.failedLoginAttempts = 0;
    user.loginLockUntil = null;
    recordLoginAttemptForIp(clientIp, true);
    await AuditEvent.create({
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'auth.login_success',
      targetType: 'User',
      targetId: user._id,
      details: { ip: clientIp },
    });
    const token = await issueSession(user, res);

    res.json({
      token,
      user: {
        ...publicUser(user),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error.message.includes('JWT secret')) {
      return res.status(500).json({ error: 'Authentication is not configured on the server.' });
    }
    res.status(500).json({ error: 'Server error during login.' });
  }
});

router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies?.brewhaus_refresh_token;
  if (refreshToken) {
    await User.updateOne({ refreshTokenHash: hashRefreshToken(refreshToken) }, { $set: { refreshTokenHash: '', refreshTokenExpiresAt: null } }).catch(() => {});
  }
  clearAuthCookie(res);
  res.json({ success: true });
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.brewhaus_refresh_token;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh session is missing.' });
  const providedHash = hashRefreshToken(refreshToken);
  const user = await User.findOne({ refreshTokenHash: providedHash, refreshTokenExpiresAt: { $gt: new Date() } }).select('+refreshTokenHash +refreshTokenExpiresAt');
  if (!user) {
    clearAuthCookie(res);
    return res.status(401).json({ error: 'Refresh session has expired. Please sign in again.' });
  }
  try {
    // Token reuse detection: if the hash in DB doesn't match the provided hash, token was reused
    if (user.refreshTokenHash !== providedHash) {
      // Token reuse detected — revoke all sessions for this user
      await User.updateOne({ _id: user._id }, { $set: { refreshTokenHash: '', refreshTokenExpiresAt: null } });
      clearAuthCookie(res);
      await AuditEvent.create({
        actorId: user._id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'auth.token_reuse_detected',
        targetType: 'User',
        targetId: user._id,
        details: { ip: req.ip },
      });
      return res.status(401).json({ error: 'Session invalidated due to token reuse. Please log in again.' });
    }

    // Rotate: generate new refresh token, invalidate old
    const newRefreshToken = createRefreshToken();
    user.refreshTokenHash = hashRefreshToken(newRefreshToken);
    user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await user.save();

    const token = await issueSession(user, res);
    return res.json({ token, user: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to refresh the admin session.' });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({
    user: {
      ...publicUser(req.user),
      impersonatedBy: req.impersonatedBy || null,
    },
  });
});

// PUT /api/auth/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user._id } });
    if (existing) {
      return res.status(400).json({ error: 'Email is already in use by another account.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: String(name).trim(), email: normalizedEmail },
      { new: true, runValidators: true }
    );

    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// PUT /api/auth/password
router.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

router.post('/2fa/setup', protect, authorizeRoles('owner'), async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecretEncrypted');
  if (user.twoFactorEnabled) return res.status(409).json({ error: 'Disable two-factor authentication before replacing its authenticator.' });
  const secret = generateTotpSecret();
  user.twoFactorSecretEncrypted = encryptTwoFactorSecret(secret);
  await user.save();
  const label = encodeURIComponent(`${user.email} (${req.tenant.name})`);
  const issuer = encodeURIComponent(req.tenant.name);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  const qrCode = await QRCode.toDataURL(otpauthUrl, { width: 260, margin: 1 });
  return res.json({ secret, otpauthUrl, qrCode, enabled: Boolean(user.twoFactorEnabled) });
});

router.post('/2fa/enable', protect, authorizeRoles('owner'), async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecretEncrypted');
  if (!user.twoFactorSecretEncrypted) return res.status(409).json({ error: 'Set up an authenticator before enabling two-factor authentication.' });
  if (!verifyTotpCode(decryptTwoFactorSecret(user.twoFactorSecretEncrypted), req.body?.code)) return res.status(400).json({ error: 'Authenticator code is invalid.' });
  user.twoFactorEnabled = true;
  await user.save();
  return res.json({ enabled: true });
});

router.post('/2fa/disable', protect, authorizeRoles('owner'), async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecretEncrypted');
  if (!user.twoFactorEnabled || !verifyTotpCode(decryptTwoFactorSecret(user.twoFactorSecretEncrypted), req.body?.code)) return res.status(400).json({ error: 'Authenticator code is invalid.' });
  user.twoFactorEnabled = false;
  user.twoFactorSecretEncrypted = '';
  await user.save();
  return res.json({ enabled: false });
});

// POST /api/auth/setup (first-time admin setup)
// SECURITY: Requires ADMIN_SETUP_SECRET to prevent unauthorized admin creation
router.post('/setup', async (req, res) => {
  try {
    const setupSecret = process.env.ADMIN_SETUP_SECRET;

    // Setup endpoint disabled if secret is not configured
    if (!setupSecret || setupSecret === 'your_setup_secret_here') {
      return res.status(403).json({ error: 'Admin setup is not available.' });
    }

    const { name, email, password, setupToken } = req.body;

    // Verify setup token
    if (!setupToken || setupToken !== setupSecret) {
      return res.status(401).json({ error: 'Invalid or missing setup token.' });
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: { $in: ['owner', 'admin'] } });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin already exists. Setup cannot be repeated.' });
    }

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (String(password).length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters.' });
    }
      // Password complexity: min 12 chars, upper, lower, number, symbol
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{12,}$/.test(password)) {
        return res.status(400).json({ error: 'Password must be at least 12 characters with uppercase, lowercase, number, and symbol.' });
      }

    const user = await User.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password,
      role: 'owner',
    });

    const token = await issueSession(user, res);

    res.status(201).json({
      token,
      user: {
        ...publicUser(user),
      },
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
