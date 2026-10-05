import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const jwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT secret is not configured or is too short.');
  return secret;
};

export const createAccessToken = (id, tenantId, extraClaims = {}) => jwt.sign({ id, tenantId: String(tenantId), tokenUse: 'access', ...extraClaims }, jwtSecret(), { expiresIn: '15m' });
export const createRefreshToken = () => crypto.randomBytes(48).toString('base64url');
export const hashRefreshToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const encryptionKey = () => crypto.createHash('sha256').update(jwtSecret()).digest();

export const encryptTwoFactorSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
};

export const decryptTwoFactorSecret = (encrypted) => {
  const [ivValue, tagValue, ciphertextValue] = String(encrypted || '').split('.');
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error('Two-factor secret is unavailable.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const generateTotpSecret = () => {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return output;
};

const decodeBase32 = (secret) => {
  const normalized = String(secret).toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (const char of normalized) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value < 0) throw new Error('Invalid authenticator secret.');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
};

const totpAt = (secret, time) => {
  const counter = Math.floor(time / 30000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(value).padStart(6, '0');
};

export const verifyTotpCode = (secret, code, now = Date.now()) => {
  const supplied = String(code || '').trim();
  if (!/^\d{6}$/.test(supplied) || !secret) return false;
  const suppliedBytes = Buffer.from(supplied);
  for (const step of [-1, 0, 1]) {
    const expected = Buffer.from(totpAt(secret, now + step * 30000));
    if (crypto.timingSafeEqual(expected, suppliedBytes)) return true;
  }
  return false;
};
