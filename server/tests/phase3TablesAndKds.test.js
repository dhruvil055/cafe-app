import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import Branch from '../models/Branch.js';
import Table from '../models/Table.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { runWithTenant, runWithSystemTenantAccess } from '../utils/tenantContext.js';

test('PHASE 3: Floor Plan, Table Statuses, Transfer & Merge Operations', async (t) => {
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
  let table1;
  let table2;
  let table3;
  let category;
  let product;

  await runWithSystemTenantAccess(async () => {
    const slug = `phase3-test-${Date.now()}`;
    tenant = await Tenant.create({
      name: 'Floor Plan Cafe',
      slug,
      status: 'active',
      plan: 'pro',
    });

    branch = await Branch.create({
      tenantId: tenant._id,
      name: 'Main Lounge',
      code: 'ML01',
      isMain: true,
      active: true,
    });
  });

  await runWithTenant(tenant._id, async () => {
    category = await Category.create({
      tenantId: tenant._id,
      name: 'Beverages',
      slug: `bev-${Date.now()}`,
    });

    table1 = await Table.create({
      tenantId: tenant._id,
      branchId: branch._id,
      tableNumber: 10,
      seats: 4,
      floor: 'Ground Floor',
      shape: 'square',
      status: 'AVAILABLE',
      active: true,
    });

    table2 = await Table.create({
      tenantId: tenant._id,
      branchId: branch._id,
      tableNumber: 11,
      seats: 6,
      floor: 'Ground Floor',
      shape: 'round',
      status: 'AVAILABLE',
      active: true,
    });

    table3 = await Table.create({
      tenantId: tenant._id,
      branchId: branch._id,
      tableNumber: 20,
      seats: 8,
      floor: 'Rooftop',
      shape: 'rectangle',
      status: 'RESERVED',
      active: true,
    });

    product = await Product.create({
      tenantId: tenant._id,
      name: 'Cappuccino Special',
      price: 180,
      category: category._id,
      kitchenStation: 'BAR',
      active: true,
    });
  });

  // 1. Test Status Transitions
  await t.test('Table status transitions and persistence', async () => {
    await runWithTenant(tenant._id, async () => {
      table1.status = 'CLEANING';
      await table1.save();

      const found = await Table.findById(table1._id);
      assert.equal(found.status, 'CLEANING');

      found.status = 'AVAILABLE';
      await found.save();
      const updated = await Table.findById(table1._id);
      assert.equal(updated.status, 'AVAILABLE');
    });
  });

  // 2. Test Active Orders mapping to Table and Bill Calculation
  let order1;
  await t.test('Order creation links to table and occupies it', async () => {
    await runWithTenant(tenant._id, async () => {
      order1 = await Order.create({
        tenantId: tenant._id,
        branchId: branch._id,
        orderType: 'dine_in',
        tableNumber: 10,
        items: [
          {
            product: product._id,
            name: product.name,
            price: product.price,
            quantity: 2,
            itemTotal: 360,
          },
        ],
        subtotal: 360,
        tax: 18,
        total: 378,
        paymentMethod: 'cash',
        orderStatus: 'preparing',
      });

      assert.ok(order1._id);
      assert.equal(order1.tableNumber, 10);

      // Verify active orders for table 10
      const active = await Order.find({
        tableNumber: 10,
        orderStatus: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'served'] },
      });
      assert.equal(active.length, 1);
      assert.equal(active[0].total, 378);
    });
  });

  // 3. Test Table Transfer (from Table 10 to Table 11)
  await t.test('Transfer active orders from Table 10 to Table 11', async () => {
    await runWithTenant(tenant._id, async () => {
      const updateRes = await Order.updateMany(
        {
          tableNumber: 10,
          orderStatus: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'served'] },
        },
        {
          $set: { tableNumber: 11 },
        }
      );

      assert.equal(updateRes.modifiedCount, 1);

      // Verify Table 10 now has 0 active orders
      const ordersOn10 = await Order.find({
        tableNumber: 10,
        orderStatus: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'served'] },
      });
      assert.equal(ordersOn10.length, 0);

      // Verify Table 11 now has the transferred order
      const ordersOn11 = await Order.find({
        tableNumber: 11,
        orderStatus: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'served'] },
      });
      assert.equal(ordersOn11.length, 1);
      assert.equal(ordersOn11[0]._id.toString(), order1._id.toString());
    });
  });

  // 4. Test Table Merge (add a new order on Table 10, then merge into Table 11)
  await t.test('Merge active orders into target table', async () => {
    await runWithTenant(tenant._id, async () => {
      const order2 = await Order.create({
        tenantId: tenant._id,
        branchId: branch._id,
        orderType: 'dine_in',
        tableNumber: 10,
        items: [
          {
            product: product._id,
            name: product.name,
            price: product.price,
            quantity: 1,
            itemTotal: 180,
          },
        ],
        subtotal: 180,
        tax: 9,
        total: 189,
        paymentMethod: 'cash',
        orderStatus: 'confirmed',
      });

      assert.ok(order2._id);

      // Merge Table 10 into Table 11
      const mergeRes = await Order.updateMany(
        {
          tableNumber: 10,
          orderStatus: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'served'] },
        },
        {
          $set: { tableNumber: 11 },
        }
      );

      assert.equal(mergeRes.modifiedCount, 1);

      const combinedOrders = await Order.find({
        tableNumber: 11,
        orderStatus: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'served'] },
      });
      assert.equal(combinedOrders.length, 2);
      const totalBill = combinedOrders.reduce((sum, o) => sum + o.total, 0);
      assert.equal(totalBill, 378 + 189);
    });
  });

  // Cleanup
  await runWithSystemTenantAccess(async () => {
    await Tenant.findByIdAndDelete(tenant._id);
    await Branch.deleteMany({ tenantId: tenant._id });
    await Table.deleteMany({ tenantId: tenant._id });
    await Order.deleteMany({ tenantId: tenant._id });
    await Product.deleteMany({ tenantId: tenant._id });
  });

  await mongoose.disconnect();
});

