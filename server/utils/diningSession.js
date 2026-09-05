import crypto from 'node:crypto';
import DiningSession from '../models/DiningSession.js';

const SESSION_TOKEN_BYTES = 32;

export const createDiningSessionToken = () => crypto.randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
export const hashDiningSessionToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const getNumberSetting = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const distanceInMeters = (latitude, longitude, cafeLatitude, cafeLongitude) => {
  const earthRadius = 6371000;
  const toRadians = (value) => value * Math.PI / 180;
  const dLat = toRadians(cafeLatitude - latitude);
  const dLon = toRadians(cafeLongitude - longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(latitude)) * Math.cos(toRadians(cafeLatitude)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const verifyCafePresence = ({ latitude, longitude, accuracy }) => {
  const cafeLatitude = Number(process.env.CAFE_LATITUDE);
  const cafeLongitude = Number(process.env.CAFE_LONGITUDE);
  if (!Number.isFinite(cafeLatitude) || !Number.isFinite(cafeLongitude)) {
    const error = new Error('Cafe presence verification is not configured.');
    error.code = 'PRESENCE_NOT_CONFIGURED';
    throw error;
  }

  const coordinates = [latitude, longitude, accuracy].map(Number);
  if (coordinates.some((value) => !Number.isFinite(value)) || accuracy < 0 || accuracy > 1000) {
    const error = new Error('Valid location data is required.');
    error.code = 'PRESENCE_VERIFICATION_FAILED';
    throw error;
  }

  const radius = getNumberSetting('CAFE_ALLOWED_RADIUS_METERS', 50);
  const maxAccuracy = getNumberSetting('CAFE_MAX_LOCATION_ACCURACY_METERS', 100);
  if (accuracy > maxAccuracy || distanceInMeters(latitude, longitude, cafeLatitude, cafeLongitude) > radius + accuracy) {
    const error = new Error('You must be inside the cafe to start ordering.');
    error.code = 'PRESENCE_VERIFICATION_FAILED';
    throw error;
  }
};

export const getSessionDurationMs = () => getNumberSetting('DINING_SESSION_MAX_MINUTES', 240) * 60 * 1000;
export const getSessionIdleMs = () => getNumberSetting('DINING_SESSION_IDLE_MINUTES', 30) * 60 * 1000;

export const requireActiveDiningSession = async (token) => {
  if (!token) {
    const error = new Error('An active cafe dining session is required to order.');
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
  if (session.status !== 'ACTIVE' || session.expiresAt.getTime() <= now) {
    if (session.status === 'ACTIVE' && session.expiresAt.getTime() <= now) {
      await DiningSession.updateOne({ _id: session._id, status: 'ACTIVE' }, { $set: { status: 'EXPIRED' } });
    }
    const error = new Error('Your cafe dining session has expired or ended.');
    error.code = session.status === 'CLOSED' ? 'SESSION_CLOSED' : 'SESSION_EXPIRED';
    throw error;
  }

  if (now - session.lastActivityAt.getTime() > getSessionIdleMs()) {
    await DiningSession.updateOne({ _id: session._id, status: 'ACTIVE' }, { $set: { status: 'IDLE' } });
    const error = new Error('Your cafe dining session has expired or ended.');
    error.code = 'SESSION_EXPIRED';
    throw error;
  }

  await DiningSession.updateOne({ _id: session._id, status: 'ACTIVE' }, { $set: { lastActivityAt: new Date() } });
  return session;
};