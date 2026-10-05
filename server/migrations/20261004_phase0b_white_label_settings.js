import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const slug = String(process.env.TENANT_DEFAULT_SLUG || 'brewhaus').trim().toLowerCase();
const tenants = () => mongoose.connection.collection('tenants');
const backup = () => mongoose.connection.collection('phase0b_migration_backup');

export const migratePhase0B = async () => {
  const tenant = await tenants().findOne({ slug });
  if (!tenant) throw new Error(`Tenant ${slug} was not found. Run the Phase 0A migration first.`);
  await backup().updateOne({ _id: tenant._id }, { $setOnInsert: { name: tenant.name, settings: tenant.settings, paymentCredentialsEncrypted: tenant.paymentCredentialsEncrypted } }, { upsert: true });
  await tenants().updateOne({ _id: tenant._id }, {
    $set: {
      'settings.cafeName': tenant.settings?.cafeName || tenant.name,
      'settings.logoUrl': tenant.settings?.logoUrl || '',
      'settings.primaryColor': tenant.settings?.primaryColor || '#c96b18',
      'settings.accentColor': tenant.settings?.accentColor || '#1a0f08',
      'settings.currency': tenant.settings?.currency || 'INR',
      'settings.timezone': tenant.settings?.timezone || 'Asia/Kolkata',
      'settings.gstNumber': tenant.settings?.gstNumber || process.env.GSTIN || '',
      'settings.taxRate': Number.isFinite(Number(tenant.settings?.taxRate)) ? Number(tenant.settings.taxRate) : 5,
      'settings.address': tenant.settings?.address || '',
      'settings.contactEmail': tenant.settings?.contactEmail || '',
      'settings.contactPhone': tenant.settings?.contactPhone || '',
      'settings.openingHours': tenant.settings?.openingHours || {},
      paymentCredentialsEncrypted: tenant.paymentCredentialsEncrypted || '',
    },
  });
  const currency = tenant.settings?.currency || 'INR';
  const orders = mongoose.connection.collection('orders');
  for await (const order of orders.find({ tenantId: tenant._id, currency: { $exists: false } }, { projection: { _id: 1 } })) {
    await backup().updateOne({ _id: `order-currency:${order._id}` }, { $setOnInsert: { kind: 'order-currency', orderId: order._id } }, { upsert: true });
    await orders.updateOne({ _id: order._id, tenantId: tenant._id, currency: { $exists: false } }, { $set: { currency } });
  }
  return tenant;
};

export const rollbackPhase0B = async () => {
  for await (const saved of backup().find({ kind: 'order-currency' })) {
    await mongoose.connection.collection('orders').updateOne({ _id: saved.orderId }, { $unset: { currency: '' } });
  }
  for await (const saved of backup().find({})) {
    if (saved.kind === 'order-currency') continue;
    await tenants().updateOne({ _id: saved._id }, {
      $set: { name: saved.name },
      $unset: { settings: '', paymentCredentialsEncrypted: '' },
    });
  }
  await backup().drop().catch((error) => { if (error.codeName !== 'NamespaceNotFound') throw error; });
};

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  if (process.argv.includes('--rollback')) {
    await rollbackPhase0B();
    console.log('Phase 0B rollback complete.');
  } else {
    const tenant = await migratePhase0B();
    console.log(`Phase 0B settings migration complete for ${tenant.name} (${tenant.slug}).`);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => { console.error(`Phase 0B migration failed: ${error.message}`); process.exitCode = 1; }).finally(async () => mongoose.disconnect());
}
