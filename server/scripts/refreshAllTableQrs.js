import 'dotenv/config';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import Tenant from '../models/Tenant.js';
import Table from '../models/Table.js';
import { createTableQrToken } from '../utils/tableQr.js';
import { runWithSystemTenantAccess } from '../utils/tenantContext.js';

const getClientBaseUrl = () => {
  const configured = String(process.env.CUSTOMER_APP_URL || process.env.CLIENT_URL || 'https://cafe.infinigrowsoftech.com').trim();
  return configured.replace(/\/$/, '');
};

async function migrate() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/cafe-db';
  console.log(`Connecting to MongoDB at ${mongoUri}...`);
  await mongoose.connect(mongoUri);

  const clientUrl = getClientBaseUrl();
  console.log(`Using Customer Base URL: ${clientUrl}`);

  await runWithSystemTenantAccess(async () => {
    const tenants = await Tenant.find({}).lean();
    console.log(`Found ${tenants.length} tenants in database.`);

    for (const tenant of tenants) {
      const cafeIdentifier = tenant.slug || String(tenant._id);
      const tables = await Table.find({ tenantId: tenant._id });
      console.log(`\nTenant: "${tenant.name}" (slug: ${tenant.slug}, id: ${tenant._id}) has ${tables.length} tables.`);

      for (const table of tables) {
        const token = createTableQrToken(table._id, tenant._id);
        const tableNum = table.tableNumber ?? 1;
        const newUrl = `${clientUrl}/menu?cafe=${encodeURIComponent(cafeIdentifier)}&table=${encodeURIComponent(tableNum)}&tableToken=${encodeURIComponent(token)}`;
        const newQrCode = await QRCode.toDataURL(newUrl, {
          width: 400,
          margin: 2,
          color: { dark: '#1a0f08', light: '#FFFFFF' },
          errorCorrectionLevel: 'H',
        });

        table.qrUrl = newUrl;
        table.qrCode = newQrCode;
        await table.save();
        console.log(`  -> Table ${tableNum}: ${newUrl}`);
      }
    }
  });

  console.log('\nAll table QR codes successfully refreshed with multi-tenant parameters!');
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
