import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migration Script: Add accessTokenHash and paymentVerifiedAt to existing orders
 * 
 * This script updates all existing orders to include the new security fields:
 * - accessTokenHash: Random unique token hash for customer order access
 * - paymentVerifiedAt: Timestamp of when payment was verified (for idempotency)
 * 
 * Run with: node utils/migrateOrders.js
 */

async function migrateOrders() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB');

    const db = mongoose.connection.db;
    const ordersCollection = db.collection('orders');

    // Check how many orders need migration
    const ordersNeedingMigration = await ordersCollection.countDocuments({
      accessTokenHash: { $exists: false }
    });

    if (ordersNeedingMigration === 0) {
      console.log('✓ All orders already migrated');
      await mongoose.connection.close();
      return;
    }

    console.log(`\n📋 Migrating ${ordersNeedingMigration} orders...\n`);

    // Update in batches to avoid memory issues
    const batchSize = 1000;
    let processed = 0;

    while (processed < ordersNeedingMigration) {
      const ordersToUpdate = await ordersCollection
        .find({ accessTokenHash: { $exists: false } })
        .limit(batchSize)
        .toArray();

      if (ordersToUpdate.length === 0) break;

      // Prepare bulk operations
      const bulkOps = ordersToUpdate.map((order) => {
        // Generate hash of random token
        const token = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(token).digest('hex');

        return {
          updateOne: {
            filter: { _id: order._id },
            update: {
              $set: {
                accessTokenHash: hash,
                paymentVerifiedAt: order.paymentStatus === 'paid' ? new Date(order.updatedAt) : null
              }
            }
          }
        };
      });

      // Execute bulk operation
      const result = await ordersCollection.bulkWrite(bulkOps);
      processed += result.modifiedCount;

      console.log(`  ✓ Processed ${processed}/${ordersNeedingMigration} orders`);
    }

    console.log(`\n✅ Migration complete! Updated ${processed} orders`);

    // Verify migration
    const stillNeedsMigration = await ordersCollection.countDocuments({
      accessTokenHash: { $exists: false }
    });

    if (stillNeedsMigration > 0) {
      console.warn(`⚠️  Warning: ${stillNeedsMigration} orders still need migration`);
    } else {
      console.log('✅ All orders successfully migrated');
    }

    // Create unique index on accessTokenHash
    await ordersCollection.createIndex({ accessTokenHash: 1 }, { unique: true });
    console.log('✓ Created unique index on accessTokenHash');

    await mongoose.connection.close();
    console.log('✓ Connection closed');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
migrateOrders();
