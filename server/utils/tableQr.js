import crypto from 'crypto';
import mongoose from 'mongoose';
import { getTenantContext } from './tenantContext.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365 * 2;

const signingSecret = () => {
  const secret = process.env.TABLE_QR_SECRET || process.env.JWT_SECRET;
  if (!secret || String(secret).length < 32) {
    throw new Error('TABLE_QR_SECRET (at least 32 characters) must be configured.');
  }
  return secret;
};

const sign = (payload) => crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');

export const createTableQrToken = (tableId, tenantIdOrNow, suppliedNow = Date.now()) => {
  if (!mongoose.isValidObjectId(tableId)) throw new Error('A valid table ID is required.');
  const legacyNow = typeof tenantIdOrNow === 'number' ? tenantIdOrNow : null;
  const tenantId = legacyNow === null ? (tenantIdOrNow || getTenantContext()?.tenantId) : getTenantContext()?.tenantId;
  if (!mongoose.isValidObjectId(tenantId)) throw new Error('A tenant ID is required to sign a table QR code.');
  const now = legacyNow ?? suppliedNow;
  const payload = Buffer.from(JSON.stringify({
    tableId: String(tableId),
    tenantId: String(tenantId),
    exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

export const verifyTableQrToken = (token, now = Date.now()) => {
  if (typeof token !== 'string') return null;
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra !== undefined) return null;
  let expected;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const supplied = Buffer.from(suppliedSignature);
  const expectedBytes = Buffer.from(expected);
  if (supplied.length !== expectedBytes.length || !crypto.timingSafeEqual(supplied, expectedBytes)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!mongoose.isValidObjectId(claims.tableId) || !mongoose.isValidObjectId(claims.tenantId) || !Number.isInteger(claims.exp) || claims.exp <= Math.floor(now / 1000)) return null;
    return { tableId: claims.tableId, tenantId: claims.tenantId, expiresAt: new Date(claims.exp * 1000) };
  } catch {
    return null;
  }
};

export const verifyTableQrTokenDetailed = (token, now = Date.now()) => {
  if (typeof token !== 'string') return { valid: false, reason: 'INVALID' };
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra !== undefined) return { valid: false, reason: 'INVALID' };
  let expected;
  try {
    expected = sign(payload);
  } catch {
    return { valid: false, reason: 'INVALID' };
  }
  const supplied = Buffer.from(suppliedSignature);
  const expectedBytes = Buffer.from(expected);
  if (supplied.length !== expectedBytes.length || !crypto.timingSafeEqual(supplied, expectedBytes)) return { valid: false, reason: 'INVALID' };
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!mongoose.isValidObjectId(claims.tableId) || !mongoose.isValidObjectId(claims.tenantId) || !Number.isInteger(claims.exp)) return { valid: false, reason: 'INVALID' };
    if (claims.exp <= Math.floor(now / 1000)) {
      return { valid: false, reason: 'EXPIRED', tableId: claims.tableId, tenantId: claims.tenantId, expiresAt: new Date(claims.exp * 1000) };
    }
    return { valid: true, tableId: claims.tableId, tenantId: claims.tenantId, expiresAt: new Date(claims.exp * 1000) };
  } catch {
    return { valid: false, reason: 'INVALID' };
  }
};

export const TABLE_QR_TTL_SECONDS = TOKEN_TTL_SECONDS;
