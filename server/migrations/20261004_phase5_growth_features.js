import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Coupon from '../models/Coupon.js';

dotenv.config();

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  await Coupon.createCollection().catch((error) => {
    if (error.codeName !== 'NamespaceExists') throw error;
  });
  await Coupon.collection.createIndexes([
    { key: { code: 1 }, unique: true, name: 'code_1' },
    { key: { active: 1, startsAt: 1, endsAt: 1 }, name: 'active_1_startsAt_1_endsAt_1' },
  ]);
  await mongoose.connection.collection('customers').createIndex({ loyaltyPoints: -1 }, { name: 'loyaltyPoints_-1' });
  await mongoose.connection.collection('orders').createIndex({ customerId: 1, createdAt: -1 }, { name: 'customerId_1_createdAt_-1' });
  console.log('Phase 5 migration complete. Coupon and customer history indexes are ready.');
};

run()
  .catch((error) => {
    console.error(`Phase 5 migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
