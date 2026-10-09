import mongoose from 'mongoose';

const dropObsoleteTenantIndexes = async (db) => {
  const legacyUniqueIndexes = [
    { collection: 'categories', indexName: 'name_1' },
    { collection: 'tables', indexName: 'tableNumber_1' },
    { collection: 'orders', indexName: 'orderNumber_1' },
    { collection: 'diningbills', indexName: 'receiptNumber_1' },
    { collection: 'diningbills', indexName: 'diningSessionId_1' },
    { collection: 'customers', indexName: 'phone_1' },
    { collection: 'inventorycategories', indexName: 'name_1' },
    { collection: 'marketingsettings', indexName: 'key_1' },
  ];

  for (const item of legacyUniqueIndexes) {
    try {
      const coll = db.collection(item.collection);
      const indexes = await coll.indexes().catch(() => []);
      const exists = indexes.find((idx) => idx.name === item.indexName && idx.unique);
      if (exists) {
        await coll.dropIndex(item.indexName);
        console.log(`🧹 Dropped obsolete unique index '${item.indexName}' on '${item.collection}'`);
      }
    } catch {
      // Index might not exist or already dropped
    }
  }
};

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI is not configured. Add your MongoDB Atlas connection string.');

    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 20,
      minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 2,
      serverSelectionTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 5000,
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45000,
      retryWrites: true,
      w: 'majority',
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host} (pool: ${conn.connection.client?.options?.maxPoolSize || 20})`);
    await dropObsoleteTenantIndexes(conn.connection.db);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};
