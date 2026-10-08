import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tenant from '../models/Tenant.js';
import Branch from '../models/Branch.js';
import Table from '../models/Table.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { runWithSystemTenantAccess } from '../utils/tenantContext.js';

dotenv.config();

export const runPhase1Migration = async () => {
  console.log('[Migration Phase 1] Starting schema & multi-branch backward-compatibility migration...');

  return runWithSystemTenantAccess(async () => {
    const tenants = await Tenant.find();
    console.log(`[Migration Phase 1] Found ${tenants.length} tenants to inspect.`);

    let branchesCreated = 0;
    let tablesUpdated = 0;
    let productsUpdated = 0;
    let ordersUpdated = 0;

    for (const tenant of tenants) {
      // 1. Ensure GST & POS settings defaults
      let tenantModified = false;
      if (!tenant.settings?.gstSettings?.invoicePrefix) {
        tenant.settings = tenant.settings || {};
        tenant.settings.gstSettings = {
          gstin: tenant.settings.gstNumber || '',
          legalName: tenant.name || '',
          tradeName: tenant.settings.cafeName || tenant.name || '',
          stateCode: '24',
          compositionScheme: false,
          invoicePrefix: 'INV',
          nextInvoiceNumber: 1001,
          ...(tenant.settings.gstSettings || {}),
        };
        tenantModified = true;
      }
      if (!tenant.settings?.posSettings?.defaultStation) {
        tenant.settings.posSettings = {
          autoAcceptOrders: false,
          printReceiptOnOrder: true,
          defaultStation: 'KITCHEN',
          ...(tenant.settings.posSettings || {}),
        };
        tenantModified = true;
      }
      if (tenantModified) {
        tenant.markModified('settings');
        await tenant.save();
      }

      // 2. Ensure Main Branch exists
      let mainBranch = await Branch.findOne({ tenantId: tenant._id, isMain: true });
      if (!mainBranch) {
        mainBranch = await Branch.findOne({ tenantId: tenant._id });
      }
      if (!mainBranch) {
        mainBranch = await Branch.create({
          tenantId: tenant._id,
          name: `${tenant.name} (Main Branch)`,
          code: 'MAIN-01',
          isMain: true,
          active: true,
          address: tenant.settings?.address || '',
          phone: tenant.settings?.contactPhone || '',
          email: tenant.settings?.contactEmail || '',
          gstin: tenant.settings?.gstNumber || '',
        });
        branchesCreated++;
      }

      // 3. Link existing tables without a branchId
      const tableResult = await Table.updateMany(
        { tenantId: tenant._id, $or: [{ branchId: null }, { branchId: { $exists: false } }] },
        { $set: { branchId: mainBranch._id, status: 'AVAILABLE', active: true } }
      );
      tablesUpdated += tableResult.modifiedCount || 0;

      // 4. Link existing products with defaults
      const prodResult = await Product.updateMany(
        { tenantId: tenant._id, $or: [{ kitchenStation: { $exists: false } }, { hsnCode: { $exists: false } }] },
        { $set: { kitchenStation: 'KITCHEN', hsnCode: '2106', isVeg: true } }
      );
      productsUpdated += prodResult.modifiedCount || 0;

      // 5. Update existing orders with defaults
      const orderResult = await Order.updateMany(
        { tenantId: tenant._id, $or: [{ orderType: { $exists: false } }, { branchId: null }] },
        { $set: { orderType: 'dine_in', branchId: mainBranch._id } }
      );
      ordersUpdated += orderResult.modifiedCount || 0;
    }

    console.log('[Migration Phase 1] Migration finished successfully:');
    console.log(` - Main Branches Created: ${branchesCreated}`);
    console.log(` - Tables Updated: ${tablesUpdated}`);
    console.log(` - Products Updated: ${productsUpdated}`);
    console.log(` - Orders Updated: ${ordersUpdated}`);

    return {
      success: true,
      branchesCreated,
      tablesUpdated,
      productsUpdated,
      ordersUpdated,
    };
  });
};

// Execute directly if run via CLI
if (process.argv[1]?.endsWith('migrate-phase1-schemas.js')) {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/cafe-app';
  mongoose.connect(uri)
    .then(async () => {
      await runPhase1Migration();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration Phase 1 Error]:', err);
      process.exit(1);
    });
}
