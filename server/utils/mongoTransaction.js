import mongoose from 'mongoose';

const transactionsUnsupported = (error) => (
  error?.code === 20 || error?.codeName === 'IllegalOperation' ||
  /transaction numbers are only allowed/i.test(error?.message || '')
);

/**
 * Run work in a MongoDB transaction. Local non-production standalone MongoDB
 * instances lack transaction support; callers may provide a compensating
 * fallback for that development/test environment. Production never falls back.
 */
export const withMongoTransaction = async (work, fallback) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production' && fallback && transactionsUnsupported(error)) {
      console.warn('MongoDB transactions are unavailable; using the route’s non-production compensating fallback.');
      return fallback();
    }
    throw error;
  } finally {
    await session.endSession();
  }
};
