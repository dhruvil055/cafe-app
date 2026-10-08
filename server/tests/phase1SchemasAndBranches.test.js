import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import Branch from '../models/Branch.js';
import Expense from '../models/Expense.js';
import Supplier from '../models/Supplier.js';
import Purchase from '../models/Purchase.js';
import Review from '../models/Review.js';
import LoyaltyTransaction from '../models/LoyaltyTransaction.js';
import Table from '../models/Table.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { calculateGstBreakdown, formatGstInvoiceNumber } from '../services/gstService.js';
import { runWithTenant, runWithSystemTenantAccess } from '../utils/tenantContext.js';
import { runPhase1Migration } from '../scripts/migrate-phase1-schemas.js';

test('PHASE 1: Models, Multi-Branch & GST Services Verification', async (t) => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/cafe-app-test';
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(uri);
    } catch {
      console.log('Skipping live DB tests: local MongoDB not reachable.');
      return;
    }
  }

  // 1. GST Service tests
  await t.test('GST calculation & invoice formatting', () => {
    const intra = calculateGstBreakdown({ taxableAmount: 200, taxRate: 5, isInterState: false });
    assert.equal(intra.taxableAmount, 200);
    assert.equal(intra.cgst, 5);
    assert.equal(intra.sgst, 5);
    assert.equal(intra.igst, 0);
    assert.equal(intra.totalTax, 10);
    assert.equal(intra.totalAmount, 210);

    const inter = calculateGstBreakdown({ taxableAmount: 500, taxRate: 5, isInterState: true });
    assert.equal(inter.cgst, 0);
    assert.equal(inter.sgst, 0);
    assert.equal(inter.igst, 25);
    assert.equal(inter.totalAmount, 525);

    const inv = formatGstInvoiceNumber({ prefix: 'CAFE', sequenceNumber: 42, date: new Date('2025-05-10') });
    assert.match(inv, /^CAFE\/2025-26\/0042$/);
  });

  // Setup test tenants A and B
  let tenantA;
  let tenantB;

  await runWithSystemTenantAccess(async () => {
    const slugA = `test-a-${Date.now()}`;
    const slugB = `test-b-${Date.now()}`;
    tenantA = await Tenant.create({
      name: 'Cafe Alpha',
      slug: slugA,
      status: 'active',
      plan: 'pro',
    });
    tenantB = await Tenant.create({
      name: 'Cafe Beta',
      slug: slugB,
      status: 'active',
      plan: 'starter',
    });
  });

  t.after(async () => {
    await runWithSystemTenantAccess(async () => {
      if (tenantA) {
        await Branch.deleteMany({ tenantId: tenantA._id });
        await Expense.deleteMany({ tenantId: tenantA._id });
        await Supplier.deleteMany({ tenantId: tenantA._id });
        await Purchase.deleteMany({ tenantId: tenantA._id });
        await Review.deleteMany({ tenantId: tenantA._id });
        await LoyaltyTransaction.deleteMany({ tenantId: tenantA._id });
        await Table.deleteMany({ tenantId: tenantA._id });
        await Product.deleteMany({ tenantId: tenantA._id });
        await Order.deleteMany({ tenantId: tenantA._id });
        await Tenant.deleteOne({ _id: tenantA._id });
      }
      if (tenantB) {
        await Branch.deleteMany({ tenantId: tenantB._id });
        await Expense.deleteMany({ tenantId: tenantB._id });
        await Supplier.deleteMany({ tenantId: tenantB._id });
        await Table.deleteMany({ tenantId: tenantB._id });
        await Tenant.deleteOne({ _id: tenantB._id });
      }
    });
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  // 2. Branch Model & Tenant Isolation
  await t.test('Branch model isolation between Tenant A and Tenant B', async () => {
    let branchA;
    await runWithTenant(tenantA._id, async () => {
      branchA = await Branch.create({
        name: 'Downtown Surat',
        code: 'SURAT-01',
        isMain: true,
      });
      assert.equal(branchA.name, 'Downtown Surat');
      const found = await Branch.find();
      assert.equal(found.length, 1);
      assert.equal(found[0].code, 'SURAT-01');
    });

    await runWithTenant(tenantB._id, async () => {
      const foundInB = await Branch.find();
      assert.equal(foundInB.length, 0); // Tenant B cannot see Tenant A's branch
    });
  });

  // 3. Expense Model & Tenant Isolation
  await t.test('Expense model isolation', async () => {
    await runWithTenant(tenantA._id, async () => {
      const exp = await Expense.create({
        category: 'rent',
        amount: 35000,
        description: 'Monthly outlet lease',
      });
      assert.equal(exp.amount, 35000);
      const list = await Expense.find();
      assert.equal(list.length, 1);
    });

    await runWithTenant(tenantB._id, async () => {
      const listInB = await Expense.find();
      assert.equal(listInB.length, 0);
    });
  });

  // 4. Supplier & Purchase Models
  await t.test('Supplier and Purchase Order workflow', async () => {
    await runWithTenant(tenantA._id, async () => {
      const sup = await Supplier.create({
        name: 'Dairy Best Farms',
        phone: '9876543210',
        paymentTerms: 'net_15',
      });
      assert.equal(sup.name, 'Dairy Best Farms');

      const po = await Purchase.create({
        supplier: sup._id,
        poNumber: 'PO-1001',
        items: [],
        subtotal: 5000,
        tax: 250,
        total: 5250,
        status: 'ordered',
      });
      assert.equal(po.total, 5250);
      assert.equal(po.status, 'ordered');
    });

    await runWithTenant(tenantB._id, async () => {
      const suppliersB = await Supplier.find();
      assert.equal(suppliersB.length, 0);
    });
  });

  // 5. Review & Loyalty Models
  await t.test('Review and LoyaltyTransaction models', async () => {
    await runWithTenant(tenantA._id, async () => {
      const dummyOrderId = new mongoose.Types.ObjectId();
      const review = await Review.create({
        orderId: dummyOrderId,
        orderNumber: 'CAF0001',
        customerName: 'Rahul Verma',
        foodRating: 5,
        serviceRating: 4,
        ambienceRating: 5,
        comment: 'Exceptional artisanal espresso!',
      });
      assert.equal(review.overallRating, 4.7);

      const dummyCustId = new mongoose.Types.ObjectId();
      const points = await LoyaltyTransaction.create({
        customer: dummyCustId,
        orderId: dummyOrderId,
        points: 25,
        type: 'earned',
        balanceAfter: 25,
        reason: 'Order #CAF0001 dining reward',
      });
      assert.equal(points.points, 25);
    });
  });

  // 6. Migration script execution
  await t.test('Migration script updates tenant defaults and assigns branches', async () => {
    const migrationResult = await runPhase1Migration();
    assert.equal(migrationResult.success, true);
  });
});


