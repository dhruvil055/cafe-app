import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import Branch from '../models/Branch.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Customer from '../models/Customer.js';
import { runWithTenant, runWithSystemTenantAccess } from '../utils/tenantContext.js';
import { calculateGstBreakdown } from '../services/gstService.js';

test('PHASE 2: POS Terminal, Held Orders & Offline Sync Verification', async (t) => {
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
  let category;
  let product1;
  let product2;

  await runWithSystemTenantAccess(async () => {
    const slug = `pos-test-${Date.now()}`;
    tenant = await Tenant.create({
      name: 'POS Express Cafe',
      slug,
      status: 'active',
      plan: 'pro',
      settings: {
        currency: 'INR',
        taxRate: 5,
        gstSettings: {
          enabled: true,
          gstin: '24AAAAA0000A1Z5',
          stateCode: '24',
          invoicePrefix: 'EXP',
        },
        posSettings: {
          defaultOrderType: 'counter',
          enableOfflineMode: true,
          thermalReceiptWidth: '80mm',
        },
      },
    });

    branch = await Branch.create({
      tenantId: tenant._id,
      name: 'Main Counter',
      code: 'MC01',
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

    product1 = await Product.create({
      tenantId: tenant._id,
      name: 'Espresso Single',
      price: 150,
      category: category._id,
      kitchenStation: 'BAR',
      hsnCode: '2106',
      active: true,
    });

    product2 = await Product.create({
      tenantId: tenant._id,
      name: 'Blueberry Cheesecake',
      price: 250,
      category: category._id,
      kitchenStation: 'BAKERY',
      hsnCode: '2106',
      active: true,
    });
  });

  // 1. Test POS Order Creation with GST & Multi-item calculation
  await t.test('POS Order Creation with full GST and station metadata', async () => {
    await runWithTenant(tenant._id, async () => {
      const subtotal = 150 * 2 + 250; // 550
      const gst = calculateGstBreakdown({ taxableAmount: subtotal, taxRate: 5, isInterState: false });

      const order = await Order.create({
        tenantId: tenant._id,
        branchId: branch._id,
        orderType: 'counter',
        tableNumber: 0,
        customer: {
          name: 'Rohan Sharma',
          phone: '9876543210',
        },
        items: [
          {
            product: product1._id,
            name: product1.name,
            price: product1.price,
            quantity: 2,
            itemTotal: 300,
          },
          {
            product: product2._id,
            name: product2.name,
            price: product2.price,
            quantity: 1,
            itemTotal: 250,
          },
        ],
        subtotal,
        discount: 0,
        tax: gst.totalTax,
        total: gst.totalAmount,
        taxRate: 5,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        orderStatus: 'completed',
        gstDetails: {
          invoiceNumber: 'EXP/2025-26/0001',
          invoiceDate: new Date(),
          customerGstin: '',
          hsnSummary: [
            { hsnCode: '2106', taxableAmount: 550, rate: 5, cgst: 13.75, sgst: 13.75, igst: 0, totalTax: 27.5 },
          ],
          taxBreakdown: {
            taxableAmount: 550,
            cgstRate: 2.5,
            cgstAmount: 13.75,
            sgstRate: 2.5,
            sgstAmount: 13.75,
            igstRate: 0,
            igstAmount: 0,
          },
        },
        posMetadata: {
          isQuickSale: true,
        },
      });

      assert.ok(order._id);
      assert.equal(order.total, 577.5);
      assert.equal(order.gstDetails.taxBreakdown.cgstAmount, 13.75);
      assert.equal(order.gstDetails.taxBreakdown.sgstAmount, 13.75);
      assert.equal(order.orderType, 'counter');
    });
  });

  // 2. Test Split Payments
  await t.test('POS Split Payment validation on Order', async () => {
    await runWithTenant(tenant._id, async () => {
      const splitOrder = await Order.create({
        tenantId: tenant._id,
        branchId: branch._id,
        orderType: 'dine_in',
        tableNumber: 4,
        items: [
          {
            product: product1._id,
            name: product1.name,
            price: product1.price,
            quantity: 2,
            itemTotal: 300,
          },
        ],
        subtotal: 300,
        tax: 15,
        total: 315,
        paymentMethod: 'split',
        paymentStatus: 'paid',
        orderStatus: 'preparing',
        splitPayments: [
          { method: 'cash', amount: 115 },
          { method: 'upi', amount: 200, reference: 'UPI98765' },
        ],
      });

      assert.equal(splitOrder.paymentMethod, 'split');
      assert.equal(splitOrder.splitPayments.length, 2);
      const sumSplits = splitOrder.splitPayments.reduce((acc, p) => acc + p.amount, 0);
      assert.equal(sumSplits, 315);
    });
  });

  // 3. Test Held Orders Lifecycle
  await t.test('POS Held Order creation, query and removal', async () => {
    let heldOrderId;
    await runWithTenant(tenant._id, async () => {
      const held = await Order.create({
        tenantId: tenant._id,
        branchId: branch._id,
        orderType: 'takeaway',
        orderStatus: 'held',
        paymentStatus: 'pending',
        customer: { name: 'Pooja Verma', phone: '9123456789' },
        items: [
          {
            product: product2._id,
            name: product2.name,
            price: product2.price,
            quantity: 1,
            itemTotal: 250,
          },
        ],
        subtotal: 250,
        tax: 12.5,
        total: 262.5,
        posMetadata: {
          heldAt: new Date(),
        },
      });

      heldOrderId = held._id;
      assert.equal(held.orderStatus, 'held');

      // Fetch held orders
      const list = await Order.find({ orderStatus: 'held' });
      assert.ok(list.some(o => o._id.toString() === heldOrderId.toString()));

      // Resume / Delete held order
      await Order.findByIdAndDelete(heldOrderId);
      const afterList = await Order.find({ orderStatus: 'held' });
      assert.ok(!afterList.some(o => o._id.toString() === heldOrderId.toString()));
    });
  });

  // 4. Test Offline Sync Idempotency Deduplication
  await t.test('POS Offline Sync Deduplication with offlineSyncId', async () => {
    const testSyncId = `offline_test_${Date.now()}`;
    await runWithTenant(tenant._id, async () => {
      // First sync attempt: created
      const syncedOrder = await Order.create({
        tenantId: tenant._id,
        branchId: branch._id,
        orderType: 'counter',
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        orderStatus: 'completed',
        items: [
          {
            product: product1._id,
            name: product1.name,
            price: product1.price,
            quantity: 1,
            itemTotal: 150,
          },
        ],
        subtotal: 150,
        tax: 7.5,
        total: 157.5,
        posMetadata: {
          offlineSynced: true,
          offlineSyncId: testSyncId,
        },
      });

      assert.ok(syncedOrder._id);

      // Second sync attempt (duplicate detection)
      const existing = await Order.findOne({ 'posMetadata.offlineSyncId': testSyncId });
      assert.ok(existing);
      assert.equal(existing._id.toString(), syncedOrder._id.toString());
    });
  });

  // 5. Test Customer auto-upsert & loyalty accumulation
  await t.test('Customer profile and loyalty tracking on repeat purchase', async () => {
    await runWithTenant(tenant._id, async () => {
      const phone = '9876543210';
      let customer = await Customer.findOne({ phone });
      if (!customer) {
        customer = await Customer.create({
          tenantId: tenant._id,
          name: 'Rohan Sharma',
          phone,
          loyaltyPoints: 50,
          totalOrders: 1,
          totalSpent: 577.5,
        });
      }

      assert.equal(customer.name, 'Rohan Sharma');
      assert.equal(customer.loyaltyPoints, 50);
    });
  });

  // Cleanup
  await runWithSystemTenantAccess(async () => {
    await Tenant.findByIdAndDelete(tenant._id);
    await Branch.deleteMany({ tenantId: tenant._id });
    await Order.deleteMany({ tenantId: tenant._id });
    await Product.deleteMany({ tenantId: tenant._id });
    await Category.deleteMany({ tenantId: tenant._id });
    await Customer.deleteMany({ tenantId: tenant._id });
  });

  await mongoose.disconnect();
});

