import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import Branch from '../models/Branch.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import InventoryItem from '../models/InventoryItem.js';
import InventoryCategory from '../models/InventoryCategory.js';
import Expense from '../models/Expense.js';
import Review from '../models/Review.js';
import { runWithTenant, runWithSystemTenantAccess } from '../utils/tenantContext.js';

test('PHASE 5: AI Operations Advisor & Multi-Branch Business Intelligence', async (t) => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/cafe-app-test';
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(uri);
    } catch {
      console.log('Skipping live DB tests: local MongoDB not reachable.');
      return;
    }
  }

  let tenantA;
  let tenantB;
  let branchA1;
  let branchA2;
  let categoryA;
  let productA;
  let invCatA;
  let invItemA;

  await runWithSystemTenantAccess(async () => {
    tenantA = await Tenant.create({
      name: 'AI Smart Cafe A',
      slug: `ai-cafe-a-${Date.now()}`,
      status: 'active',
      plan: 'pro',
    });

    tenantB = await Tenant.create({
      name: 'AI Smart Cafe B',
      slug: `ai-cafe-b-${Date.now()}`,
      status: 'active',
      plan: 'free',
    });

    branchA1 = await Branch.create({
      tenantId: tenantA._id,
      name: 'Main Flagship',
      code: 'MF01',
      isMain: true,
      active: true,
    });

    branchA2 = await Branch.create({
      tenantId: tenantA._id,
      name: 'Metro Kiosk',
      code: 'MK02',
      isMain: false,
      active: true,
    });
  });

  await runWithTenant(tenantA._id, async () => {
    categoryA = await Category.create({
      tenantId: tenantA._id,
      name: 'Specialty Brews',
      slug: `spec-${Date.now()}`,
    });

    productA = await Product.create({
      tenantId: tenantA._id,
      name: 'Hazelnut Latte',
      price: 220,
      category: categoryA._id,
      kitchenStation: 'BAR',
      active: true,
    });

    invCatA = await InventoryCategory.create({
      tenantId: tenantA._id,
      name: 'Syrups',
    });

    invItemA = await InventoryItem.create({
      tenantId: tenantA._id,
      branchId: branchA1._id,
      name: 'Hazelnut Syrup Bottle',
      category: invCatA._id,
      unit: 'bottle',
      currentQuantity: 1, // Below minimum 3!
      minimumStock: 3,
    });

    // Completed order for Tenant A
    await Order.create({
      tenantId: tenantA._id,
      branchId: branchA1._id,
      orderType: 'dine_in',
      tableNumber: 1,
      items: [
        {
          product: productA._id,
          name: productA.name,
          price: productA.price,
          quantity: 3,
          itemTotal: 660,
        },
      ],
      subtotal: 660,
      tax: 33,
      total: 693,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      orderStatus: 'completed',
    });

    // Operating expense for Tenant A
    await Expense.create({
      tenantId: tenantA._id,
      branchId: branchA1._id,
      category: 'electricity',
      amount: 1500,
    });
  });

  // Completed order for Tenant B (to test isolation)
  await runWithTenant(tenantB._id, async () => {
    await Order.create({
      tenantId: tenantB._id,
      orderType: 'counter',
      tableNumber: 0,
      items: [{ name: 'B Tea', price: 50, quantity: 1, itemTotal: 50 }],
      subtotal: 50,
      tax: 2.5,
      total: 52.5,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      orderStatus: 'completed',
    });
  });

  // 1. Verify Multi-Branch setup and filtering
  await t.test('Multi-Branch listing for Tenant A', async () => {
    await runWithTenant(tenantA._id, async () => {
      const branches = await Branch.find().sort({ code: 1 });
      assert.equal(branches.length, 2);
      assert.equal(branches[0].code, 'MF01');
      assert.equal(branches[1].code, 'MK02');
    });
  });

  // 2. Verify AI Aggregations Scoped Strictly to Tenant A
  await t.test('Tenant-isolated sales and inventory telemetry', async () => {
    await runWithTenant(tenantA._id, async () => {
      const sales = await Order.aggregate([
        { $match: { orderStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]);
      assert.equal(sales[0].total, 693); // Does NOT include Tenant B's 52.5!

      const lowStock = await InventoryItem.find({
        $expr: { $lte: ['$currentQuantity', '$minimumStock'] },
      });
      assert.equal(lowStock.length, 1);
      assert.equal(lowStock[0].name, 'Hazelnut Syrup Bottle');
    });
  });

  // Cleanup
  await runWithSystemTenantAccess(async () => {
    await Tenant.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } });
    await Branch.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Order.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Product.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Category.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await InventoryItem.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await InventoryCategory.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
    await Expense.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
  });

  await mongoose.disconnect();
});

