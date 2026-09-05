import crypto from 'node:crypto';
import DiningSession from '../models/DiningSession.js';

const durationMs = () => (Number(process.env.DINING_SESSION_MAX_MINUTES) || 240) * 60 * 1000;
const idleMs = () => (Number(process.env.DINING_SESSION_IDLE_MINUTES) || 30) * 60 * 1000;

export const createDiningSessionToken = () => crypto.randomBytes(32).toString('base64url');
export const hashDiningSessionToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

export const requireActiveDiningSession = async (token) => {
  if (!token) {
    const error = new Error('An active table dining session is required.');
    error.code = 'SESSION_REQUIRED';
    throw error;
  }

  const session = await DiningSession.findOne({ tokenHash: hashDiningSessionToken(token) });
  if (!session) {
    const error = new Error('Dining session is invalid.');
    error.code = 'SESSION_INVALID';
    throw error;
  }

  const now = Date.now();
  if (session.status !== 'ACTIVE' || session.expiresAt.getTime() <= now || now - session.lastActivityAt.getTime() > idleMs()) {
    await DiningSession.updateOne({ _id: session._id, status: 'ACTIVE' }, { $set: { status: 'EXPIRED' } });
    const error = new Error('Your dining session has ended. Please scan the QR code at your table again.');
    error.code = session.status === 'CLOSED' ? 'SESSION_CLOSED' : 'SESSION_EXPIRED';
    throw error;
  }

  await DiningSession.updateOne({ _id: session._id, status: 'ACTIVE' }, { $set: { lastActivityAt: new Date() } });
  return session;
};

export const sessionExpiresAt = () => new Date(Date.now() + durationMs());