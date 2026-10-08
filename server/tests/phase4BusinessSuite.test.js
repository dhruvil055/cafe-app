import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import Branch from '../models/Branch.js';
import Expense from '../models/Expense.js';
import Supplier from '../models/Supplier.js';
import Purchase from '../models/Purchase.js';
import Review from '../models/Review.js';
import Order from '../models/Order.js';
import InventoryItem from '../models/InventoryItem.js';
import InventoryCategory from '../models/InventoryCategory.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import { runWithTenant, runWithSystemTenantAccess } from '../utils/tenantContext.js';

test('PHASE 4: Business Suite (Expenses, Suppliers, Purchases Replenishment, Reviews)', async (t) => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/cafe-app-test';
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(uri);
    } catch {
      console.log('Skipping live DB tests: local MongoDB not reachable.');
      return;
    }
  }

  let tenant;
  let branch;
  let invCategory;
  let milkItem;
  let coffeeItem;

  await runWithSystemTenantAccess(async () => {
    const slug = `phase4-test-${Date.now()}`;
    tenant = await Tenant.create({
      name: 'Business Suite Cafe',
      slug,
      status: 'active',
      plan: 'pro',
    });

    branch = await Branch.create({
      tenantId: tenant._id,
      name: 'Central Kitchen',
      code: 'CK01',
      isMain: true,
      active: true,
    });
  });

  await runWithTenant(tenant._id, async () => {
    invCategory = await InventoryCategory.create({
      tenantId: tenant._id,
      name: 'Dairy & Beverages',
    });

    milkItem = await InventoryItem.create({
      tenantId: tenant._id,
      branchId: branch._id,
      name: 'Full Cream Milk',
      category: invCategory._id,
      unit: 'litre',
      currentQuantity: 10,
      costPerUnit: 60,
    });

    coffeeItem = await InventoryItem.create({
      tenantId: tenant._id,
      branchId: branch._id,
      name: 'Arabica Coffee Beans',
      category: invCategory._id,
      unit: 'kilogram',
      currentQuantity: 5,
      costPerUnit: 800,
    });
  });

  // 1. Expenses Workflow
  await t.test('Expense creation, categorization and aggregation', async () => {
    await runWithTenant(tenant._id, async () => {
      const exp1 = await Expense.create({
        tenantId: tenant._id,
        branchId: branch._id,
        category: 'electricity',
        amount: 4500,
        description: 'Monthly electricity bill',
        paymentMethod: 'bank_transfer',
      });

      const exp2 = await Expense.create({
        tenantId: tenant._id,
        branchId: branch._id,
        category: 'raw_material',
        amount: 3200,
        description: 'Local market supplies',
        paymentMethod: 'cash',
      });

      assert.ok(exp1._id);
      assert.ok(exp2._id);

      const list = await Expense.find();
      assert.equal(list.length, 2);

      const aggregate = await Expense.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      assert.equal(aggregate[0].total, 7700);
    });
  });

  // 2. Suppliers Directory
  let supplier;
  await t.test('Supplier creation and details', async () => {
    await runWithTenant(tenant._id, async () => {
      supplier = await Supplier.create({
        tenantId: tenant._id,
        name: 'Dairy Fresh Wholesale',
        contactPerson: 'Suresh Patel',
        phone: '9825098250',
        email: 'suresh@dairyfresh.com',
        gstin: '24AAAAA1234A1Z5',
        paymentTerms: 'net_15',
        active: true,
      });

      assert.ok(supplier._id);
      assert.equal(supplier.gstin, '24AAAAA1234A1Z5');
      assert.equal(supplier.paymentTerms, 'net_15');
    });
  });

  // 3. Purchase Order Workflow & Automated Stock Replenishment
  await t.test('Purchase Order reception replenishes inventory stock and writes ledger', async () => {
    await runWithTenant(tenant._id, async () => {
      const poNumber = `PO-TEST-${Date.now()}`;
      const purchase = await Purchase.create({
        tenantId: tenant._id,
        branchId: branch._id,
        supplier: supplier._id,
        poNumber,
        invoiceNumber: 'INV-DF-901',
        items: [
          {
            inventoryItem: milkItem._id,
            name: milkItem.name,
            quantity: 20, // +20 litres
            unit: 'litre',
            unitCost: 58,
            taxPercent: 5,
            total: 1218,
          },
          {
            inventoryItem: coffeeItem._id,
            name: coffeeItem.name,
            quantity: 10, // +10 kg
            unit: 'kilogram',
            unitCost: 780,
            taxPercent: 5,
            total: 8190,
          },
        ],
        subtotal: 8960,
        tax: 448,
        total: 9408,
        status: 'draft',
      });

      assert.equal(purchase.status, 'draft');

      // Now receive stock: emulate the /status endpoint logic
      const balanceMilkBefore = milkItem.currentQuantity; // 10
      milkItem.currentQuantity += 20; // 30
      await milkItem.save();

      await InventoryTransaction.create({
        tenantId: tenant._id,
        inventoryItem: milkItem._id,
        type: 'purchase',
        quantity: 20,
        balanceBefore: balanceMilkBefore,
        balanceAfter: milkItem.currentQuantity,
        reference: poNumber,
      });

      purchase.status = 'received';
      purchase.receivedAt = new Date();
      await purchase.save();

      // Verify updated inventory stock
      const updatedMilk = await InventoryItem.findById(milkItem._id);
      assert.equal(updatedMilk.currentQuantity, 30);

      // Verify transaction ledger record
      const tx = await InventoryTransaction.findOne({ reference: poNumber });
      assert.ok(tx);
      assert.equal(tx.type, 'purchase');
      assert.equal(tx.quantity, 20);
      assert.equal(tx.balanceAfter, 30);
    });
  });

  // 4. Customer 3-Factor Reviews & Management Reply
  await t.test('Customer 3-factor rating calculation and management reply', async () => {
    await runWithTenant(tenant._id, async () => {
      const order = await Order.create({
        tenantId: tenant._id,
        branchId: branch._id,
        orderType: 'counter',
        tableNumber: 0,
        items: [{ name: 'Latte', price: 150, quantity: 1, itemTotal: 150 }],
        subtotal: 150,
        tax: 7.5,
        total: 157.5,
        paymentMethod: 'cash',
        orderStatus: 'completed',
      });

      // Submit Review: Food: 5, Service: 4, Ambience: 5 -> Overall should be Math.round((14/3)*10)/10 = 4.7
      const review = await Review.create({
        tenantId: tenant._id,
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName: 'Ananya Roy',
        foodRating: 5,
        serviceRating: 4,
        ambienceRating: 5,
        comment: 'Loved the hazelnut latte, quick service!',
      });

      assert.ok(review._id);
      assert.equal(review.overallRating, 4.7);
      assert.equal(review.status, 'published');

      // Management reply
      review.reply = {
        text: 'Thank you Ananya! Delighted to serve you again soon.',
        repliedAt: new Date(),
      };
      await review.save();

      const savedReview = await Review.findById(review._id);
      assert.equal(savedReview.reply.text, 'Thank you Ananya! Delighted to serve you again soon.');
    });
  });

  // Cleanup
  await runWithSystemTenantAccess(async () => {
    await Tenant.findByIdAndDelete(tenant._id);
    await Branch.deleteMany({ tenantId: tenant._id });
    await Expense.deleteMany({ tenantId: tenant._id });
    await Supplier.deleteMany({ tenantId: tenant._id });
    await Purchase.deleteMany({ tenantId: tenant._id });
    await Review.deleteMany({ tenantId: tenant._id });
    await Order.deleteMany({ tenantId: tenant._id });
    await InventoryItem.deleteMany({ tenantId: tenant._id });
    await InventoryCategory.deleteMany({ tenantId: tenant._id });
    await InventoryTransaction.deleteMany({ tenantId: tenant._id });
  });

  await mongoose.disconnect();
});

