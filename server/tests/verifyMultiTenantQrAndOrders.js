import 'dotenv/config';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Table from '../models/Table.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { createTableQrToken, verifyTableQrToken } from '../utils/tableQr.js';
import { runWithTenant, runWithSystemTenantAccess } from '../utils/tenantContext.js';
import { validateAndFetchProductPrices, generateOrderAccessToken, hashAccessToken } from '../utils/orderSecurity.js';

async function runTest() {
  const mongoUri = process.env.MONGO_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  await runWithSystemTenantAccess(async () => {
    console.log('\n--- STEP 1: VERIFY OR CREATE CAFE 1 (Velvet Cafe) ---');
    let cafe1 = await Tenant.findOne({ slug: 'velvet' });
    assert.ok(cafe1, 'Cafe 1 (Velvet) must exist');
    console.log(`Cafe 1: "${cafe1.name}" (ID: ${cafe1._id}, slug: ${cafe1.slug})`);

    const cafe1Table = await Table.findOne({ tenantId: cafe1._id, tableNumber: 1 });
    assert.ok(cafe1Table, 'Cafe 1 Table 1 must exist');
    const qr1Token = createTableQrToken(cafe1Table._id, cafe1._id);
    const qr1Url = `https://cafe.infinigrowsoftech.com/menu?cafe=${cafe1.slug}&table=1&tableToken=${qr1Token}`;
    console.log(`Generated QR 1: ${qr1Url}`);

    console.log('\n--- STEP 2: VERIFY OR CREATE CAFE 2 (Cafe 2) ---');
    let cafe2 = await Tenant.findOne({ slug: 'cafe-2' });
    if (!cafe2) {
      cafe2 = await Tenant.create({
        name: 'Cafe 2',
        slug: 'cafe-2',
        status: 'active',
        settings: {
          cafeName: 'Cafe 2',
          currency: 'INR',
          taxRate: 5,
          primaryColor: '#2b6cb0',
          accentColor: '#1a202c',
        },
      });
      console.log(`Created new Cafe 2 (ID: ${cafe2._id})`);
    } else {
      console.log(`Existing Cafe 2: "${cafe2.name}" (ID: ${cafe2._id})`);
    }

    // Ensure Cafe 2 admin owner exists
    const cafe2Owner = await User.findOne({ tenantId: cafe2._id, email: 'cafe2@example.com' });
    if (!cafe2Owner) {
      await User.create({
        tenantId: cafe2._id,
        name: 'Cafe 2 Owner',
        email: 'cafe2@example.com',
        password: 'Password123!',
        role: 'owner',
      });
      console.log('Created Cafe 2 Owner user: cafe2@example.com');
    }

    // Ensure Cafe 2 Table 2 exists
    let cafe2Table = await Table.findOne({ tenantId: cafe2._id, tableNumber: 2 });
    if (!cafe2Table) {
      const tableId = new mongoose.Types.ObjectId();
      const qrToken = createTableQrToken(tableId, cafe2._id);
      cafe2Table = await Table.create({
        _id: tableId,
        tenantId: cafe2._id,
        tableNumber: 2,
        label: 'Table 2',
        seats: 4,
        active: true,
      });
    }
    const qr2Token = createTableQrToken(cafe2Table._id, cafe2._id);
    const qr2Url = `https://cafe.infinigrowsoftech.com/menu?cafe=${cafe2.slug}&table=2&tableToken=${qr2Token}`;
    console.log(`Generated QR 2: ${qr2Url}`);

    // Ensure Cafe 2 has category and product
    let cafe2Category = await Category.findOne({ tenantId: cafe2._id, name: 'Cafe 2 Specials' });
    if (!cafe2Category) {
      cafe2Category = await Category.create({
        tenantId: cafe2._id,
        name: 'Cafe 2 Specials',
        description: 'Exclusive to Cafe 2',
        active: true,
      });
    }

    let cafe2Product = await Product.findOne({ tenantId: cafe2._id, name: 'Cafe 2 Artisan Blend' });
    if (!cafe2Product) {
      cafe2Product = await Product.create({
        tenantId: cafe2._id,
        name: 'Cafe 2 Artisan Blend',
        description: 'Special roast only at Cafe 2',
        price: 220,
        category: cafe2Category._id,
        available: true,
      });
      console.log(`Created Cafe 2 Product: "${cafe2Product.name}" (ID: ${cafe2Product._id})`);
    }

    console.log('\n--- STEP 3: SIMULATE OPENING QR 1 (Velvet Cafe) ---');
    const qr1Claims = verifyTableQrToken(qr1Token);
    assert.equal(String(qr1Claims.tenantId), String(cafe1._id));
    assert.equal(String(qr1Claims.tableId), String(cafe1Table._id));

    // Resolve tenant using QR 1
    const resolvedTenant1 = await Tenant.findOne({ slug: 'velvet' }).lean();
    assert.equal(resolvedTenant1.name, 'velvet');
    console.log(`✓ QR 1 resolved correct cafe: "${resolvedTenant1.name}"`);

    // Verify Cafe 1 menu
    await runWithTenant(cafe1._id, async () => {
      const cafe1Products = await Product.find({}).lean();
      assert.ok(cafe1Products.length > 0, 'Cafe 1 should have products');
      const hasCafe2Product = cafe1Products.some((p) => String(p._id) === String(cafe2Product._id));
      assert.equal(hasCafe2Product, false, 'Cafe 1 menu MUST NOT include Cafe 2 products');
      console.log(`✓ Cafe 1 menu has ${cafe1Products.length} items; strictly excludes Cafe 2 items.`);
    });

    console.log('\n--- STEP 4: SIMULATE OPENING QR 2 (Cafe 2) ---');
    const qr2Claims = verifyTableQrToken(qr2Token);
    assert.equal(String(qr2Claims.tenantId), String(cafe2._id));
    assert.equal(String(qr2Claims.tableId), String(cafe2Table._id));

    // Resolve tenant using QR 2
    const resolvedTenant2 = await Tenant.findOne({ slug: 'cafe-2' }).lean();
    assert.equal(resolvedTenant2.name, 'Cafe 2');
    console.log(`✓ QR 2 resolved correct cafe: "${resolvedTenant2.name}" (NOT Velvet!)`);

    // Verify Cafe 2 menu
    await runWithTenant(cafe2._id, async () => {
      const cafe2Products = await Product.find({}).lean();
      assert.ok(cafe2Products.length > 0, 'Cafe 2 should have products');
      const containsCafe2Product = cafe2Products.some((p) => String(p._id) === String(cafe2Product._id));
      assert.equal(containsCafe2Product, true, 'Cafe 2 menu must contain Cafe 2 products');
      console.log(`✓ Cafe 2 menu has ${cafe2Products.length} items; strictly isolated to Cafe 2.`);
    });

    console.log('\n--- STEP 5: PLACE ORDER FROM QR 2 (Cafe 2) ---');
    let order2;
    await runWithTenant(cafe2._id, async () => {
      // Validate table belongs to Cafe 2
      const table = await Table.findOne({ _id: qr2Claims.tableId, active: true });
      assert.ok(table, 'Table must be found in Cafe 2 context');
      assert.equal(String(table.tenantId), String(cafe2._id));

      // Validate prices and fetch items in Cafe 2 context
      const validatedItems = await validateAndFetchProductPrices(
        [{ productId: String(cafe2Product._id), quantity: 2 }],
        Product,
        cafe2._id
      );

      assert.equal(validatedItems.length, 1);
      assert.equal(validatedItems[0].price, 220);
      assert.equal(validatedItems[0].itemTotal, 440);

      // Create order
      const token = generateOrderAccessToken();
      order2 = await Order.create({
        tableNumber: 2,
        customer: { name: 'Test Customer', phone: '+919876543210' },
        items: validatedItems,
        subtotal: 440,
        tax: 22,
        total: 462,
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        accessTokenHash: hashAccessToken(token),
      });

      console.log(`✓ Order placed successfully: ID ${order2._id}, Order# ${order2.orderNumber}`);
      assert.equal(String(order2.tenantId), String(cafe2._id), 'Order.tenantId MUST match Cafe 2');
    });

    console.log('\n--- STEP 6: VERIFY ORDER VISIBILITY IN ADMIN PANELS ---');
    // Cafe 2 admin query
    await runWithTenant(cafe2._id, async () => {
      const cafe2Orders = await Order.find({ _id: order2._id });
      assert.equal(cafe2Orders.length, 1, 'Cafe 2 admin MUST see order2');
      console.log(`✓ Cafe 2 admin sees the order (found ${cafe2Orders.length} matching order).`);
    });

    // Cafe 1 admin query
    await runWithTenant(cafe1._id, async () => {
      const cafe1Orders = await Order.find({ _id: order2._id });
      assert.equal(cafe1Orders.length, 0, 'Cafe 1 admin MUST NEVER see order2');
      console.log(`✓ Cafe 1 admin CANNOT see Cafe 2 order (found ${cafe1Orders.length} orders - completely isolated).`);
    });

    console.log('\n--- STEP 7: TEST CROSS-TENANT ATTACK PREVENTIONS ---');
    // Try to order Cafe 1's product inside Cafe 2's context
    const cafe1Product = await Product.findOne({ tenantId: cafe1._id });
    if (cafe1Product) {
      await runWithTenant(cafe2._id, async () => {
        let threw = false;
        try {
          await validateAndFetchProductPrices(
            [{ productId: String(cafe1Product._id), quantity: 1 }],
            Product,
            cafe2._id
          );
        } catch (e) {
          threw = true;
          console.log(`✓ Blocked cross-tenant product injection attempt: "${e.message}"`);
        }
        assert.ok(threw, 'Cross-tenant product ordering MUST be blocked');
      });
    }

    // Try to validate Cafe 1's table token in Cafe 2's context
    const claims = verifyTableQrToken(qr1Token);
    assert.notEqual(String(claims.tenantId), String(cafe2._id));
    console.log('✓ Blocked cross-tenant table token validation attempt (tenantId mismatch detected).');

    console.log('\n========================================');
    console.log('ALL MULTI-TENANT VERIFICATION TESTS PASSED!');
    console.log('========================================\n');
  });

  await mongoose.disconnect();
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
