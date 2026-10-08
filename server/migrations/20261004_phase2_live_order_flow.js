import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.collection('tableservicerequests');
  await collection.createIndexes([
    { key: { status: 1, createdAt: -1 }, name: 'status_1_createdAt_-1' },
    { key: { diningSessionId: 1, type: 1, status: 1 }, name: 'diningSessionId_1_type_1_status_1' },
  ]);
  console.log('Phase 2 migration complete. Table service request indexes are ready.');
};

run()
  .catch((error) => {
    console.error(`Phase 2 migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
