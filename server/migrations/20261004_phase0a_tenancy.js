import mongoose from 'mongoose';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Tenant from '../models/Tenant.js';
import Table from '../models/Table.js';
import { createTableQrToken } from '../utils/tableQr.js';
import { runWithSystemTenantAccess } from '../utils/tenantContext.js';

dotenv.config();

const tenantSlug = String(process.env.TENANT_DEFAULT_SLUG || 'brewhaus').trim().toLowerCase();
const legacyTenant = { name: 'Brewhaus Café', slug: tenantSlug, status: 'active', plan: 'starter' };
const tenantCollections = [
  'categories', 'products', 'tables', 'orders', 'payments', 'customers', 'coupons', 'users', 'auditevents',
  'diningsessions', 'diningbills', 'tableservicerequests', 'inventorycategories', 'inventoryitems',
  'inventorytransactions', 'menuinventorymappings', 'campaigns', 'campaigndeliveries',
  'notificationcampaigns', 'notificationdeliveries', 'pushsubscriptions', 'marketingsettings',
  'galleryitems', 'contactmessages',
  'counters',
];

const collection = (name) => mongoose.connection.collection(name);
const indexName = (key) => Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join('_');

const migrateUniqueIndexes = async () => {
  for (const name of tenantCollections) {
    const coll = collection(name);
    const indexes = await coll.indexes().catch((error) => error.codeName === 'NamespaceNotFound' ? [] : Promise.reject(error));
    for (const index of indexes) {
      if (!index.unique || index.name === '_id_' || index.key?.tenantId === 1) continue;
      const originalKeys = Object.entries(index.key || {});
      if (originalKeys.some(([key]) => key === '$**')) continue;
      const restoreOptions = Object.fromEntries(Object.entries(index).filter(([key]) => [
        'unique', 'sparse', 'partialFilterExpression', 'expireAfterSeconds', 'collation', 'hidden', 'wildcardProjection',
      ].includes(key)));
      const tenantIndexName = indexName({ tenantId: 1, ...index.key });
      await collection('tenant_migration_backups').updateOne(
        { _id: `index:${name}:${tenantIndexName}:${index.name}` },
        { $setOnInsert: { kind: 'index', collection: name, tenantIndexName, key: index.key, options: restoreOptions } },
        { upsert: true },
      );
      await coll.dropIndex(index.name);
      const key = { tenantId: 1, ...index.key };
      const options = { unique: true, name: indexName(key) };
      if (index.expireAfterSeconds !== undefined) options.expireAfterSeconds = index.expireAfterSeconds;
      if (index.partialFilterExpression) options.partialFilterExpression = index.partialFilterExpression;
      else if (index.sparse) {
        const indexedField = originalKeys[0]?.[0];
        if (indexedField) options.partialFilterExpression = { [indexedField]: { $type: 'string' } };
      }
      await coll.createIndex(key, options);
    }
  }
};

const regenerateQrCodes = async (tenantId) => {
  const baseUrl = String(process.env.CUSTOMER_APP_URL || process.env.CLIENT_URL || 'https://cafe.infinigrowsoftech.com').replace(/\/$/, '');
  const backup = collection('tenant_migration_backups');
  for await (const table of Table.find({}).cursor()) {
    await backup.updateOne(
      { _id: table._id },
      { $setOnInsert: { collection: 'tables', qrCode: table.qrCode, qrUrl: table.qrUrl } },
      { upsert: true },
    );
    const qrUrl = `${baseUrl}/menu?tableToken=${encodeURIComponent(createTableQrToken(table._id, tenantId))}`;
    const qrCode = await QRCode.toDataURL(qrUrl, { width: 400, margin: 2, color: { dark: '#1a0f08', light: '#FFFFFF' }, errorCorrectionLevel: 'H' });
    await Table.updateOne({ _id: table._id }, { $set: { qrUrl, qrCode } });
  }
};

export const migratePhase0A = async () => runWithSystemTenantAccess(async () => {
  const tenant = await Tenant.findOneAndUpdate(
    { slug: tenantSlug },
    { $setOnInsert: legacyTenant },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const tenantId = tenant._id;
  for (const name of tenantCollections) {
    await collection(name).updateMany({ tenantId: { $exists: false } }, { $set: { tenantId } });
  }
  // Backfill tenantId for counters collection (order numbers, receipt numbers)
  await collection('counters').updateMany({ tenantId: { $exists: false } }, { $set: { tenantId } });
  await migrateUniqueIndexes();
  await regenerateQrCodes(tenantId);
  return tenant;
});

export const rollbackPhase0A = async () => runWithSystemTenantAccess(async () => {
  const tenant = await Tenant.findOne({ slug: tenantSlug });
  if (!tenant) return;
  const backup = collection('tenant_migration_backups');
  const others = await Tenant.countDocuments({ _id: { $ne: tenant._id } });
  if (others) throw new Error('Rollback refused: other tenants exist. Export or migrate their data before rolling back.');
  for (const name of tenantCollections) {
    const foreign = await collection(name).countDocuments({ tenantId: { $exists: true, $ne: tenant._id } });
    if (foreign) throw new Error(`Rollback refused: ${name} contains records owned by another tenant.`);
  }
  // Rollback counters collection
  const countersForeign = await collection('counters').countDocuments({ tenantId: { $exists: true, $ne: tenant._id } });
  if (countersForeign) throw new Error(`Rollback refused: counters contains records owned by another tenant.`);
  for (const name of tenantCollections) {
    const coll = collection(name);
    const indexes = await coll.indexes().catch((error) => error.codeName === 'NamespaceNotFound' ? [] : Promise.reject(error));
    for (const index of indexes) {
      if (index.unique && index.key?.tenantId === 1 && Object.keys(index.key).length > 1) {
        await coll.dropIndex(index.name);
        const original = Object.fromEntries(Object.entries(index.key).filter(([key]) => key !== 'tenantId'));
        const saved = await backup.findOne({ kind: 'index', collection: name, tenantIndexName: index.name });
        const options = saved?.options || { unique: true, name: indexName(original) };
        if (saved?.options?.name) delete options.name;
        const equivalent = indexes.find((candidate) => JSON.stringify(candidate.key) === JSON.stringify(original));
        if (equivalent && !equivalent.unique && equivalent.name !== '_id_') await coll.dropIndex(equivalent.name);
        const isOnlyId = Object.keys(original).length === 1 && original._id !== undefined;
        if (!isOnlyId) {
          if (saved) await coll.createIndex(saved.key, options);
          else if (Object.keys(original).length) await coll.createIndex(original, options);
        }
      }
    }
  }
  for await (const oldTable of backup.find({ collection: 'tables' })) {
    await collection('tables').updateOne({ _id: oldTable._id }, { $set: { qrCode: oldTable.qrCode, qrUrl: oldTable.qrUrl } });
  }
  await backup.drop().catch((error) => { if (error.codeName !== 'NamespaceNotFound') throw error; });
  for (const name of tenantCollections) await collection(name).updateMany({}, { $unset: { tenantId: '' } });
  await collection('counters').updateMany({}, { $unset: { tenantId: '' } });
  await Tenant.deleteOne({ _id: tenant._id });
});

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  if (process.argv.includes('--rollback')) {
    await rollbackPhase0A();
    console.log('Phase 0A rollback complete.');
  } else {
    const tenant = await migratePhase0A();
    console.log(`Phase 0A migration complete. Existing café data is assigned to ${tenant.name} (${tenant.slug}).`);
  }
};

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  run().catch((error) => {
    console.error(`Phase 0A migration failed: ${error.message}`);
    process.exitCode = 1;
  }).finally(async () => mongoose.disconnect());
}
