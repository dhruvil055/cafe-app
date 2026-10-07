import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

export const dropObsoleteTenantIndexes = async (db) => {
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
        console.log(`Dropping obsolete unique index '${item.indexName}' on '${item.collection}'...`);
        await coll.dropIndex(item.indexName);
        console.log(`Successfully dropped '${item.indexName}' on '${item.collection}'.`);
      }
    } catch (err) {
      console.warn(`Could not drop '${item.indexName}' on '${item.collection}':`, err.message);
    }
  }
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('DB connected.');

  const db = mongoose.connection.db;
  await dropObsoleteTenantIndexes(db);

  await mongoose.disconnect();
}

if (process.argv[1]?.includes('drop-legacy-indexes')) {
  run().catch(console.error);
}
