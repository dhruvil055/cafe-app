import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createApp } from '../index.js';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Table from '../models/Table.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { createTableQrToken } from '../utils/tableQr.js';
import { runWithTenant, runWithSystemTenantAccess } from '../utils/tenantContext.js';

test('EXACT API CONTRACTS & ACCEPTANCE TESTS A-G', async (t) => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  const app = createApp();
  let server;
  let baseUrl;

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const request = async (path, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  };

  t.after(() => {
    if (server) server.close();
  });

  // Setup Two Cafes: Velvet Cafe & Blue Cafe
  let velvetCafe, blueCafe;
  let velvetTable1, blueTable1;
  let velvetProduct, blueProduct;
  let velvetAdmin, blueAdmin;
  let velvetToken, blueToken;
  let qrA, qrB;

  await runWithSystemTenantAccess(async () => {
    // 1. Velvet Cafe
    velvetCafe = await Tenant.findOne({ slug: 'velvet-test' });
    if (!velvetCafe) {
      velvetCafe = await Tenant.create({
        name: 'Velvet Cafe',
        slug: 'velvet-test',
        status: 'active',
        settings: {
          cafeName: 'Velvet Cafe',
          currency: 'INR',
          taxRate: 5,
          primaryColor: '#7928ca',
          accentColor: '#111111',
          tagline: 'Welcome to Velvet Cafe',
        },
      });
    }

    velvetAdmin = await User.findOne({ email: 'admin@velvet-test.com' });
    if (!velvetAdmin) {
      velvetAdmin = await User.create({
        tenantId: velvetCafe._id,
        name: 'Velvet Admin',
        email: 'admin@velvet-test.com',
        password: 'Password123!',
        role: 'owner',
      });
    }

    velvetTable1 = await Table.findOne({ tenantId: velvetCafe._id, tableNumber: 1 });
    if (!velvetTable1) {
      velvetTable1 = await Table.create({
        tenantId: velvetCafe._id,
        tableNumber: 1,
        label: 'Table 1',
        seats: 4,
        active: true,
      });
    }

    let velvetCat = await Category.findOne({ tenantId: velvetCafe._id, name: 'Hot Drinks' });
    if (!velvetCat) {
      velvetCat = await Category.create({
        tenantId: velvetCafe._id,
        name: 'Hot Drinks',
        active: true,
      });
    }

    velvetProduct = await Product.findOne({ tenantId: velvetCafe._id, name: 'Cappuccino' });
    if (!velvetProduct) {
      velvetProduct = await Product.create({
        tenantId: velvetCafe._id,
        name: 'Cappuccino',
        description: 'Fresh cappuccino',
        price: 150,
        category: velvetCat._id,
        available: true,
      });
    }

    // 2. Blue Cafe
    blueCafe = await Tenant.findOne({ slug: 'blue-test' });
    if (!blueCafe) {
      blueCafe = await Tenant.create({
        name: 'Blue Cafe',
        slug: 'blue-test',
        status: 'active',
        settings: {
          cafeName: 'Blue Cafe',
          currency: 'INR',
          taxRate: 5,
          primaryColor: '#0070f3',
          accentColor: '#000000',
          tagline: 'Welcome to Blue Cafe',
        },
      });
    }

    blueAdmin = await User.findOne({ email: 'admin@blue-test.com' });
    if (!blueAdmin) {
      blueAdmin = await User.create({
        tenantId: blueCafe._id,
        name: 'Blue Admin',
        email: 'admin@blue-test.com',
        password: 'Password123!',
        role: 'owner',
      });
    }

    blueTable1 = await Table.findOne({ tenantId: blueCafe._id, tableNumber: 1 });
    if (!blueTable1) {
      blueTable1 = await Table.create({
        tenantId: blueCafe._id,
        tableNumber: 1,
        label: 'Table 1',
        seats: 4,
        active: true,
      });
    }

    let blueCat = await Category.findOne({ tenantId: blueCafe._id, name: 'Main Course' });
    if (!blueCat) {
      blueCat = await Category.create({
        tenantId: blueCafe._id,
        name: 'Main Course',
        active: true,
      });
    }

    blueProduct = await Product.findOne({ tenantId: blueCafe._id, name: 'Pizza' });
    if (!blueProduct) {
      blueProduct = await Product.create({
        tenantId: blueCafe._id,
        name: 'Pizza',
        description: 'Delicious pizza',
        price: 300,
        category: blueCat._id,
        available: true,
      });
    }

    qrA = createTableQrToken(velvetTable1._id, velvetCafe._id);
    qrB = createTableQrToken(blueTable1._id, blueCafe._id);
  });

  // ── CONTRACT 1 & TEST A: Resolve Cafe From QR ──────────────────────────────
  await t.test('Contract 1 & Test A: Resolve Cafe From QR', async () => {
    // Resolve QR-A -> Velvet
    const resA = await request(`/api/public/cafes/resolve?token=${encodeURIComponent(qrA)}`);
    assert.equal(resA.status, 200);
    assert.equal(resA.data.success, true);
    assert.equal(resA.data.data.cafe.name, 'Velvet Cafe');
    assert.equal(resA.data.data.cafe.slug, 'velvet-test');
    assert.equal(resA.data.data.table.number, 1);
    assert.equal(resA.data.data.qr.token, qrA);

    // Resolve QR-B -> Blue
    const resB = await request(`/api/public/cafes/resolve?token=${encodeURIComponent(qrB)}`);
    assert.equal(resB.status, 200);
    assert.equal(resB.data.success, true);
    assert.equal(resB.data.data.cafe.name, 'Blue Cafe');
    assert.equal(resB.data.data.cafe.slug, 'blue-test');
    assert.equal(resB.data.data.table.number, 1);
    assert.equal(resB.data.data.qr.token, qrB);

    // Alternative: cafeSlug and tableSlug
    const resSlug = await request(`/api/public/cafes/resolve?cafeSlug=blue-test&tableSlug=1`);
    assert.equal(resSlug.status, 200);
    assert.equal(resSlug.data.success, true);
    assert.equal(resSlug.data.data.cafe.slug, 'blue-test');
    assert.equal(resSlug.data.data.table.number, 1);

    // Invalid QR -> 404 QR_NOT_FOUND
    const resInvalid = await request('/api/public/cafes/resolve?token=invalid-random-token-here');
    assert.equal(resInvalid.status, 404);
    assert.equal(resInvalid.data.success, false);
    assert.equal(resInvalid.data.error.code, 'QR_NOT_FOUND');
    assert.equal(resInvalid.data.error.message, 'QR code was not found or is no longer valid.');

    // Cafe not found -> 404 CAFE_NOT_FOUND
    const resNoCafe = await request('/api/public/cafes/resolve?cafeSlug=non-existent-cafe-slug&tableSlug=1');
    assert.equal(resNoCafe.status, 404);
    assert.equal(resNoCafe.data.success, false);
    assert.equal(resNoCafe.data.error.code, 'CAFE_NOT_FOUND');

    // Table does not belong to cafe -> 409 TABLE_CAFE_MISMATCH
    const resMismatch = await request(`/api/public/cafes/resolve?cafeSlug=blue-test&tableSlug=${velvetTable1._id}`);
    assert.equal(resMismatch.status, 409);
    assert.equal(resMismatch.data.success, false);
    assert.equal(resMismatch.data.error.code, 'TABLE_CAFE_MISMATCH');
  });

  // ── CONTRACT 2: Get Public Cafe Details ────────────────────────────────────
  await t.test('Contract 2: Get Public Cafe Details', async () => {
    // Valid by ID
    const resId = await request(`/api/public/cafes/${velvetCafe._id}`);
    assert.equal(resId.status, 200);
    assert.equal(resId.data.success, true);
    assert.equal(resId.data.data.id, String(velvetCafe._id));
    assert.equal(resId.data.data.name, 'Velvet Cafe');
    assert.equal(resId.data.data.slug, 'velvet-test');
    assert.equal(resId.data.data.branding.primaryColor, '#7928ca');
    assert.equal(resId.data.data.settings.currency, 'INR');

    // Valid by slug
    const resSlug = await request(`/api/public/cafes/blue-test`);
    assert.equal(resSlug.status, 200);
    assert.equal(resSlug.data.success, true);
    assert.equal(resSlug.data.data.name, 'Blue Cafe');

    // Invalid ID -> 400 INVALID_CAFE_ID
    const resInvalidId = await request('/api/public/cafes/invalid_id_not_found');
    assert.equal(resInvalidId.status, 400);
    assert.equal(resInvalidId.data.success, false);
    assert.equal(resInvalidId.data.error.code, 'INVALID_CAFE_ID');

    // Cafe Not Found -> 404 CAFE_NOT_FOUND (using valid 24-hex ObjectId that does not exist)
    const fakeObjectId = new mongoose.Types.ObjectId();
    const resNotFound = await request(`/api/public/cafes/${fakeObjectId}`);
    assert.equal(resNotFound.status, 404);
    assert.equal(resNotFound.data.success, false);
    assert.equal(resNotFound.data.error.code, 'CAFE_NOT_FOUND');
  });

  // ── CONTRACT 3 & TEST B: Get Cafe Menu & Isolation ─────────────────────────
  await t.test('Contract 3 & Test B: Get Cafe Menu & Isolation', async () => {
    // Menu of Velvet Cafe
    const resMenuVelvet = await request(`/api/public/cafes/${velvetCafe._id}/menu`);
    assert.equal(resMenuVelvet.status, 200);
    assert.equal(resMenuVelvet.data.success, true);
    const velvetItems = resMenuVelvet.data.data.categories.flatMap((c) => c.items);
    assert.ok(velvetItems.some((i) => i.name === 'Cappuccino'), 'Velvet menu must have Cappuccino');
    assert.ok(!velvetItems.some((i) => i.name === 'Pizza'), 'Velvet menu MUST NOT have Pizza');

    // Menu of Blue Cafe
    const resMenuBlue = await request(`/api/public/cafes/${blueCafe._id}/menu`);
    assert.equal(resMenuBlue.status, 200);
    assert.equal(resMenuBlue.data.success, true);
    const blueItems = resMenuBlue.data.data.categories.flatMap((c) => c.items);
    assert.ok(blueItems.some((i) => i.name === 'Pizza'), 'Blue menu must have Pizza');
    assert.ok(!blueItems.some((i) => i.name === 'Cappuccino'), 'Blue menu MUST NOT have Cappuccino');
  });

  // ── CONTRACT 4: Get Cafe Tables ────────────────────────────────────────────
  await t.test('Contract 4: Get Cafe Tables', async () => {
    // Preferred: GET /api/public/cafes/:cafeId/tables/:tableId
    const resTable = await request(`/api/public/cafes/${velvetCafe._id}/tables/${velvetTable1._id}`);
    assert.equal(resTable.status, 200);
    assert.equal(resTable.data.success, true);
    assert.equal(resTable.data.data.id, String(velvetTable1._id));
    assert.equal(resTable.data.data.number, 1);
    assert.equal(resTable.data.data.status, 'available');

    // Table Not Found -> 404 TABLE_NOT_FOUND
    const fakeTableId = new mongoose.Types.ObjectId();
    const resNotFound = await request(`/api/public/cafes/${velvetCafe._id}/tables/${fakeTableId}`);
    assert.equal(resNotFound.status, 404);
    assert.equal(resNotFound.data.success, false);
    assert.equal(resNotFound.data.error.code, 'TABLE_NOT_FOUND');

    // Wrong Cafe -> 403 TABLE_ACCESS_DENIED (Velvet table requested under Blue Cafe)
    const resDenied = await request(`/api/public/cafes/${blueCafe._id}/tables/${velvetTable1._id}`);
    assert.equal(resDenied.status, 403);
    assert.equal(resDenied.data.success, false);
    assert.equal(resDenied.data.error.code, 'TABLE_ACCESS_DENIED');
  });

  // ── CONTRACT 5, 6 & TEST C, D, E: Create Customer Order & Validations ─────
  let createdBlueOrder;
  await t.test('Contract 5, 6 & Test C, D, E: Customer Order Creation & Isolation', async () => {
    // Test D: Table Isolation -> Blue cafeId + Velvet tableId -> 409 TABLE_CAFE_MISMATCH
    const resTableMismatch = await request('/api/public/orders', {
      method: 'POST',
      headers: {
        'X-Cafe-ID': String(blueCafe._id),
        'X-QR-TOKEN': qrB,
      },
      body: {
        tableId: String(velvetTable1._id),
        items: [{ productId: String(blueProduct._id), quantity: 1 }],
        customer: { name: 'Alice', phone: '9876543210' },
        paymentMethod: 'ONLINE',
      },
    });
    assert.equal(resTableMismatch.status, 409);
    assert.equal(resTableMismatch.data.success, false);
    assert.equal(resTableMismatch.data.error.code, 'TABLE_CAFE_MISMATCH');
    assert.equal(resTableMismatch.data.error.message, 'The selected table does not belong to this cafe.');

    // Test E: Product Isolation -> Blue cafeId + Velvet productId -> 409 PRODUCT_CAFE_MISMATCH
    const resProductMismatch = await request('/api/public/orders', {
      method: 'POST',
      headers: {
        'X-Cafe-ID': String(blueCafe._id),
        'X-QR-TOKEN': qrB,
      },
      body: {
        tableId: String(blueTable1._id),
        items: [{ productId: String(velvetProduct._id), quantity: 1 }],
        customer: { name: 'Bob', phone: '9876543210' },
        paymentMethod: 'ONLINE',
      },
    });
    assert.equal(resProductMismatch.status, 409);
    assert.equal(resProductMismatch.data.success, false);
    assert.equal(resProductMismatch.data.error.code, 'PRODUCT_CAFE_MISMATCH');
    assert.equal(resProductMismatch.data.error.message, 'One or more products do not belong to this cafe.');
    assert.deepEqual(resProductMismatch.data.error.details.invalidProductIds, [String(velvetProduct._id)]);

    // Valid Order: Order from QR-B at Blue Cafe
    const resOrder = await request('/api/public/orders', {
      method: 'POST',
      headers: {
        'X-Cafe-ID': String(blueCafe._id),
        'X-QR-TOKEN': qrB,
      },
      body: {
        tableId: String(blueTable1._id),
        items: [{ productId: String(blueProduct._id), quantity: 2 }],
        customer: { name: 'John', phone: '9876543210' },
        paymentMethod: 'ONLINE',
      },
    });
    assert.equal(resOrder.status, 201);
    assert.equal(resOrder.data.success, true);
    assert.equal(resOrder.data.data.order.cafeId, String(blueCafe._id));
    assert.equal(resOrder.data.data.order.status, 'PENDING');
    assert.equal(resOrder.data.data.order.paymentStatus, 'PENDING');
    assert.equal(resOrder.data.data.order.total, 630); // 2 * 300 = 600 + 5% tax = 630

    createdBlueOrder = resOrder.data.data.order;

    // Verify in database: order.tenantId === Blue Cafe ID
    const dbOrder = await runWithTenant(blueCafe._id, async () => {
      return Order.findById(createdBlueOrder.id).lean();
    });
    assert.ok(dbOrder, 'Order must exist in database');
    assert.equal(String(dbOrder.tenantId), String(blueCafe._id), 'order.cafeId must be Blue Cafe');
  });

  // ── CONTRACT 7: Admin Authentication ───────────────────────────────────────
  await t.test('Contract 7: Admin Authentication', async () => {
    // Login as Velvet Admin
    const resLogin = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'admin@velvet-test.com',
        password: 'Password123!',
      },
    });
    assert.equal(resLogin.status, 200);
    assert.equal(resLogin.data.success, true);
    assert.equal(resLogin.data.data.user.email, 'admin@velvet-test.com');
    assert.equal(resLogin.data.data.user.role, 'CAFE_ADMIN');
    assert.ok(Array.isArray(resLogin.data.data.cafes));
    assert.equal(resLogin.data.data.cafes[0].name, 'Velvet Cafe');
    assert.equal(resLogin.data.data.cafes[0].role, 'OWNER');
    assert.ok(resLogin.data.data.accessToken);

    velvetToken = resLogin.data.data.accessToken;

    // Login as Blue Admin
    const resLoginBlue = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'admin@blue-test.com',
        password: 'Password123!',
      },
    });
    assert.equal(resLoginBlue.status, 200);
    blueToken = resLoginBlue.data.data.accessToken;
  });

  // ── CONTRACT 8, 9 & TEST C (Admin Visibility): Admin Orders ────────────────
  await t.test('Contract 8, 9 & Test C: Admin Orders Isolation', async () => {
    // Missing Cafe Context / Unauthenticated -> 401 UNAUTHENTICATED
    const resNoAuth = await request('/api/admin/orders');
    assert.equal(resNoAuth.status, 401);
    assert.equal(resNoAuth.data.error.code, 'UNAUTHENTICATED');

    // Blue Admin queries /api/admin/orders -> MUST see the Blue order
    const resBlueOrders = await request('/api/admin/orders', {
      headers: {
        Authorization: `Bearer ${blueToken}`,
      },
    });
    assert.equal(resBlueOrders.status, 200);
    assert.equal(resBlueOrders.data.success, true);
    assert.ok(resBlueOrders.data.data.orders.some((o) => o.id === createdBlueOrder.id));
    assert.ok(resBlueOrders.data.data.orders.every((o) => o.cafeId === String(blueCafe._id)));

    // Velvet Admin queries /api/admin/orders -> MUST NEVER see the Blue order
    const resVelvetOrders = await request('/api/admin/orders', {
      headers: {
        Authorization: `Bearer ${velvetToken}`,
      },
    });
    assert.equal(resVelvetOrders.status, 200);
    assert.equal(resVelvetOrders.data.success, true);
    assert.ok(!resVelvetOrders.data.data.orders.some((o) => o.id === createdBlueOrder.id));
    assert.ok(resVelvetOrders.data.data.orders.every((o) => o.cafeId === String(velvetCafe._id)));

    // User Not Authorized For Cafe -> 403 CAFE_ACCESS_DENIED
    // Velvet admin attempts to supply X-Cafe-ID of Blue Cafe
    const resDenied = await request('/api/admin/orders', {
      headers: {
        Authorization: `Bearer ${velvetToken}`,
        'X-Cafe-ID': String(blueCafe._id),
      },
    });
    assert.equal(resDenied.status, 403);
    assert.equal(resDenied.data.error.code, 'CAFE_ACCESS_DENIED');
  });

  // ── CONTRACT 10: Create Cafe / Free Trial ──────────────────────────────────
  await t.test('Contract 10: Create Cafe / Free Trial', async () => {
    const uniqueSlugSuffix = Date.now();
    const newName = `Cafe ${uniqueSlugSuffix}`;
    const ownerEmail = `owner${uniqueSlugSuffix}@example.com`;

    const resCreate = await request('/api/cafes', {
      method: 'POST',
      body: {
        name: newName,
        ownerEmail,
        trialDays: 14,
      },
    });
    assert.equal(resCreate.status, 201);
    assert.equal(resCreate.data.success, true);
    assert.equal(resCreate.data.data.cafe.name, newName);
    assert.equal(resCreate.data.data.cafe.status, 'TRIAL');
    assert.ok(resCreate.data.data.cafe.trialEndsAt);

    // Duplicate Slug -> 409 CAFE_SLUG_EXISTS
    const resDupSlug = await request('/api/cafes', {
      method: 'POST',
      body: {
        name: newName,
        ownerEmail: `another${uniqueSlugSuffix}@example.com`,
      },
    });
    assert.equal(resDupSlug.status, 409);
    assert.equal(resDupSlug.data.error.code, 'CAFE_SLUG_EXISTS');

    // Duplicate Owner/Email -> 409 OWNER_ALREADY_EXISTS
    const resDupEmail = await request('/api/cafes', {
      method: 'POST',
      body: {
        name: 'Brand New Unique Cafe Name',
        ownerEmail: 'admin@velvet-test.com', // existing user email
      },
    });
    assert.equal(resDupEmail.status, 409);
    assert.equal(resDupEmail.data.error.code, 'OWNER_ALREADY_EXISTS');
  });

  // ── CONTRACT 11: Admin QR Generation ───────────────────────────────────────
  await t.test('Contract 11: Admin QR Generation', async () => {
    const resQr = await request(`/api/admin/cafes/${blueCafe._id}/tables/${blueTable1._id}/qr`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${blueToken}`,
      },
    });
    assert.equal(resQr.status, 201);
    assert.equal(resQr.data.success, true);
    assert.equal(resQr.data.data.qr.cafeId, String(blueCafe._id));
    assert.equal(resQr.data.data.qr.tableId, String(blueTable1._id));
    assert.equal(resQr.data.data.qr.status, 'ACTIVE');
    assert.ok(resQr.data.data.qr.token);
    assert.ok(resQr.data.data.qr.url.includes(encodeURIComponent(resQr.data.data.qr.token)) || resQr.data.data.qr.url.includes(resQr.data.data.qr.token));
  });

  // ── TEST F & G: Browser Cache & Direct URL Manipulation ────────────────────
  await t.test('Test F & G: Direct URL manipulation and resolution isolation', async () => {
    // Test F: QR-A resolves Velvet Cafe
    const resA = await request(`/api/public/cafes/resolve?token=${encodeURIComponent(qrA)}`);
    assert.equal(resA.data.data.cafe.name, 'Velvet Cafe');

    // Test F: QR-B resolves Blue Cafe without stale Velvet data
    const resB = await request(`/api/public/cafes/resolve?token=${encodeURIComponent(qrB)}`);
    assert.equal(resB.data.data.cafe.name, 'Blue Cafe');
    assert.notEqual(resB.data.data.cafe.name, resA.data.data.cafe.name);

    // Test G: Changing ?token=QR-A to another invalid/random token must NOT load Velvet or any default cafe
    const resRandom = await request(`/api/public/cafes/resolve?token=tampered-invalid-token`);
    assert.equal(resRandom.status, 404);
    assert.equal(resRandom.data.success, false);
    assert.equal(resRandom.data.error.code, 'QR_NOT_FOUND');
    assert.equal(resRandom.data.data, undefined);
  });
});
