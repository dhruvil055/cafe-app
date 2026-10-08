import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_TEST_URI || `mongodb://127.0.0.1:27017/cafe_tenant_phase0a_${process.pid}`;
process.env.JWT_SECRET = 'phase0a-tenant-tests-use-a-long-jwt-secret';
process.env.TABLE_QR_SECRET = 'phase0a-tenant-tests-use-a-long-qr-secret';
process.env.TENANT_DEFAULT_SLUG = 'brewhaus';
process.env.TENANT_BASE_DOMAIN = 'saas.test';

const { default: Tenant } = await import('../models/Tenant.js');
const { default: Category } = await import('../models/Category.js');
const { default: Product } = await import('../models/Product.js');
const { default: Table } = await import('../models/Table.js');
const { default: Order } = await import('../models/Order.js');
const { default: Payment } = await import('../models/Payment.js');
const { default: User } = await import('../models/User.js');
const { createTableQrToken, verifyTableQrToken } = await import('../utils/tableQr.js');
const { runWithTenant, runWithSystemTenantAccess } = await import('../utils/tenantContext.js');
const { migratePhase0A, rollbackPhase0A } = await import('../migrations/20261004_phase0a_tenancy.js');

test('Phase 0A migrates the legacy café and centrally isolates tenant data and QR tokens', async (t) => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 });
  await mongoose.connection.dropDatabase();
  const legacyCategoryId = new mongoose.Types.ObjectId();
  const legacyTableId = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('categories').insertOne({ _id: legacyCategoryId, name: 'Legacy Menu', active: true, sortOrder: 1, image: '/legacy.jpg' });
  await mongoose.connection.collection('tables').insertOne({ _id: legacyTableId, tableNumber: 91, label: 'Patio', active: true, seats: 2, qrCode: 'old-qr-image', qrUrl: 'https://legacy.invalid/qr' });

  const brewhaus = await migratePhase0A();
  const movedCategory = await runWithTenant(brewhaus._id, async () => await Category.findById(legacyCategoryId).lean());
  assert.equal(movedCategory.name, 'Legacy Menu');
  assert.equal(movedCategory.image, '/legacy.jpg');
  const movedTable = await runWithTenant(brewhaus._id, async () => await Table.findById(legacyTableId).lean());
  const legacyToken = new URL(movedTable.qrUrl).searchParams.get('tableToken');
  assert.equal(verifyTableQrToken(legacyToken).tenantId, String(brewhaus._id));

  const second = await runWithSystemTenantAccess(() => Tenant.create({ name: 'Second Café', slug: 'second-cafe', status: 'active', plan: 'starter' }));
  const fixtures = {};
  await runWithTenant(brewhaus._id, async () => {
    fixtures.categoryA = await Category.create({ name: 'Shared category' });
    fixtures.productA = await Product.create({ name: 'A menu item', price: 100, category: fixtures.categoryA._id });
    fixtures.tableA = await Table.create({ tableNumber: 1, label: 'One' });
    fixtures.userA = await User.create({ name: 'Owner A', email: 'owner@example.test', password: 'password-a' });
    fixtures.orderA = await Order.create({
      tableNumber: 1, customer: { name: 'A', phone: '1000000001' }, items: [{ name: 'A menu item', price: 100, quantity: 1, itemTotal: 100 }],
      subtotal: 100, tax: 5, total: 105, paymentMethod: 'cash', idempotencyKey: 'tenant-a-order', accessTokenHash: 'tenant-a-access',
    });
    fixtures.paymentA = await Payment.create({ orderId: fixtures.orderA._id, idempotencyKey: 'tenant-a-payment', provider: 'cash', amount: 105 });
  });
  await runWithTenant(second._id, async () => {
    fixtures.categoryB = await Category.create({ name: 'Shared category' });
    fixtures.productB = await Product.create({ name: 'B menu item', price: 200, category: fixtures.categoryB._id });
    fixtures.tableB = await Table.create({ tableNumber: 1, label: 'One' });
    fixtures.userB = await User.create({ name: 'Owner B', email: 'owner@example.test', password: 'password-b' });
    fixtures.orderB = await Order.create({
      tableNumber: 1, customer: { name: 'B', phone: '1000000002' }, items: [{ name: 'B menu item', price: 200, quantity: 1, itemTotal: 200 }],
      subtotal: 200, tax: 10, total: 210, paymentMethod: 'cash', idempotencyKey: 'tenant-b-order', accessTokenHash: 'tenant-b-access',
    });
    fixtures.paymentB = await Payment.create({ orderId: fixtures.orderB._id, idempotencyKey: 'tenant-b-payment', provider: 'cash', amount: 210 });
  });

  await runWithTenant(brewhaus._id, async () => {
    assert.equal(await Product.findById(fixtures.productB._id), null);
    assert.equal(await Category.findById(fixtures.categoryB._id), null);
    assert.equal(await Table.findById(fixtures.tableB._id), null);
    assert.equal(await Order.findById(fixtures.orderB._id), null);
    assert.equal(await Payment.findById(fixtures.paymentB._id), null);
    assert.equal(await User.findById(fixtures.userB._id), null);
    assert.equal(await Category.countDocuments({ tenantId: second._id }), 0);

    // Direct ID guessing write attempts fail silently or error
    await Product.updateOne({ _id: fixtures.productB._id }, { $set: { price: 999 } });
    await Order.updateOne({ _id: fixtures.orderB._id }, { $set: { status: 'cancelled' } });
    await Payment.updateOne({ _id: fixtures.paymentB._id }, { $set: { status: 'refunded' } });
    await User.updateOne({ _id: fixtures.userB._id }, { $set: { name: 'Compromised' } });
    await Order.deleteOne({ _id: fixtures.orderB._id });
    await Payment.deleteOne({ _id: fixtures.paymentB._id });
    await User.deleteOne({ _id: fixtures.userB._id });

    // Cross-tenant document insertion rejected
    await assert.rejects(new Product({ tenantId: second._id, name: 'Forged', price: 1, category: fixtures.categoryA._id }).save(), /tenant ownership/i);
    await assert.rejects(new Order({ tenantId: second._id, tableNumber: 1, items: [{ name: 'Forged', price: 1, quantity: 1, itemTotal: 1 }], subtotal: 1, total: 1, idempotencyKey: 'forge', accessTokenHash: 'h' }).save(), /tenant ownership/i);
    await assert.rejects(new Payment({ tenantId: second._id, orderId: fixtures.orderA._id, amount: 1, idempotencyKey: 'pforge', provider: 'cash' }).save(), /tenant ownership/i);
  });

  // Verify Tenant B's data remains unmodified
  await runWithTenant(second._id, async () => {
    assert.equal((await Product.findById(fixtures.productB._id)).price, 200);
    assert.equal((await Order.findById(fixtures.orderB._id)).orderStatus, 'pending');
    assert.equal((await Payment.findById(fixtures.paymentB._id)).status, 'pending');
    assert.equal((await User.findById(fixtures.userB._id)).name, 'Owner B');
  });

  assert.ok(verifyTableQrToken(createTableQrToken(fixtures.tableA._id, brewhaus._id)));
  assert.equal(String(verifyTableQrToken(createTableQrToken(fixtures.tableA._id, brewhaus._id)).tenantId), String(brewhaus._id));

  const { createApp } = await import('../index.js');
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // HTTP API checks:
  // 1. Tenant B cannot validate Tenant A's table QR token
  const qrResponse = await fetch(`${baseUrl}/api/tables/qr/validate?token=${encodeURIComponent(createTableQrToken(fixtures.tableA._id, brewhaus._id))}`, {
    headers: { origin: 'https://second-cafe.saas.test' },
  });
  assert.equal(qrResponse.status, 404, 'tenant B cannot validate tenant A QR token');

  // 2. Tenant B menu endpoint only returns Tenant B's products
  const menuResponse = await fetch(`${baseUrl}/api/menu`, {
    headers: { origin: 'https://second-cafe.saas.test' },
  });
  assert.equal(menuResponse.status, 200);
  const menuData = await menuResponse.json();
  const menuProductIds = menuData.products.map((p) => String(p._id));
  assert.ok(menuProductIds.includes(String(fixtures.productB._id)), 'Tenant B menu includes Product B');
  assert.ok(!menuProductIds.includes(String(fixtures.productA._id)), 'Tenant B menu excludes Product A');

  // 3. Tenant B cannot access Tenant A order by direct ID guessing
  const crossOrderResponse = await fetch(`${baseUrl}/api/orders/${fixtures.orderA._id}?accessToken=tenant-a-access`, {
    headers: { origin: 'https://second-cafe.saas.test' },
  });
  assert.equal(crossOrderResponse.status, 404, 'Tenant B cannot read Tenant A order via ID guessing');

  // 4. Suspended tenant receives status 423
  await Tenant.updateOne({ _id: second._id }, { $set: { status: 'suspended' } });
  const suspendedResponse = await fetch(`${baseUrl}/api/menu`, {
    headers: { origin: 'https://second-cafe.saas.test' },
  });
  assert.equal(suspendedResponse.status, 423, 'suspended tenants receive a clean blocked response');

  // 5. Unknown tenant receives status 404
  const unknownResponse = await fetch(`${baseUrl}/api/menu`, {
    headers: { origin: 'https://unknown-cafe.saas.test' },
  });
  assert.equal(unknownResponse.status, 404, 'unknown tenant slugs receive a clean not-found response');
  await assert.rejects(rollbackPhase0A(), /other tenants exist/i);

  for (const name of ['categories', 'products', 'tables', 'orders', 'payments', 'users', 'counters']) {
    await mongoose.connection.collection(name).deleteMany({ tenantId: second._id });
  }
  await Tenant.deleteOne({ _id: second._id });
  await rollbackPhase0A();
  const rolledBackCategory = await mongoose.connection.collection('categories').findOne({ _id: legacyCategoryId });
  const rolledBackTable = await mongoose.connection.collection('tables').findOne({ _id: legacyTableId });
  assert.equal(rolledBackCategory.tenantId, undefined);
  assert.equal(rolledBackTable.qrCode, 'old-qr-image');
  assert.equal(rolledBackTable.qrUrl, 'https://legacy.invalid/qr');
  assert.equal(await Tenant.countDocuments({ slug: 'brewhaus' }), 0);
});
