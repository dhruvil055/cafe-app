import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  const payments = mongoose.connection.collection('payments');
  const paymentIndexes = await payments.indexes().catch((error) => {
    if (error.codeName === 'NamespaceNotFound') return [];
    throw error;
  });
  for (const field of ['orderId', 'diningBillId']) {
    const index = paymentIndexes.find((candidate) => candidate.key?.[field] === 1 && candidate.unique);
    if (index) await payments.dropIndex(index.name);
    await payments.createIndex(
      { [field]: 1 },
      { unique: true, partialFilterExpression: { [field]: { $type: 'objectId' } }, name: `${field}_1` },
    );
  }
  await mongoose.connection.collection('orders').createIndex(
    { paymentStatus: 1, createdAt: -1 },
    { name: 'paymentStatus_1_createdAt_-1' },
  );
  await mongoose.connection.collection('customers').createIndex(
    { status: 1, createdAt: -1 },
    { name: 'status_1_createdAt_-1' },
  );
  console.log('Phase 4 migration complete. Payment, order, and customer query indexes are ready.');
};

run()
  .catch((error) => {
    console.error(`Phase 4 migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
