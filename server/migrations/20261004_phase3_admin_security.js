import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  const audit = mongoose.connection.collection('auditevents');
  await audit.createIndexes([
    { key: { createdAt: -1 }, name: 'createdAt_-1' },
    { key: { actorId: 1, createdAt: -1 }, name: 'actorId_1_createdAt_-1' },
    { key: { targetType: 1, targetId: 1, createdAt: -1 }, name: 'targetType_1_targetId_1_createdAt_-1' },
  ]);
  await mongoose.connection.collection('products').createIndex({ availableFrom: 1, availableUntil: 1 }, { name: 'availableFrom_1_availableUntil_1' });
  console.log('Phase 3 migration complete. Audit and scheduled availability indexes are ready.');
};

run()
  .catch((error) => {
    console.error(`Phase 3 migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
