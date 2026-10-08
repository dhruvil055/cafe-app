import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_TEST_URI || `mongodb://127.0.0.1:27017/cafe_hardening_test_${process.pid}`;
process.env.JWT_SECRET = 'saas-hardening-tests-jwt-secret-min32chars';
process.env.TABLE_QR_SECRET = 'saas-hardening-tests-qr-secret-min32chars';
process.env.SUPER_ADMIN_EMAIL = 'super@hardening.test';
process.env.SUPER_ADMIN_PASSWORD = 'SuperHardeningPass123!';

const { createApp } = await import('../index.js');
const { default: Tenant } = await import('../models/Tenant.js');
const { default: User } = await import('../models/User.js');
const { default: Branch } = await import('../models/Branch.js');
const { default: Plan } = await import('../models/Plan.js');
const { default: Subscription } = await import('../models/Subscription.js');
const { default: SuperAdmin } = await import('../models/SuperAdmin.js');
const { default: Table } = await import('../models/Table.js');
const { default: Order } = await import('../models/Order.js');
const { default: Payment } = await import('../models/Payment.js');
const { default: PaymentLedger } = await import('../models/PaymentLedger.js');
const { createTableQrToken } = await import('../utils/tableQr.js');
const { createAccessToken } = await import('../utils/authTokens.js');
const { runWithTenant } = await import('../utils/tenantContext.js');

const app = createApp();

test('Phase 2-6 Hardening: Multi-Tenant, Branches, SaaS Limits, Super Admin & Impersonation', async (t) => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const request = async (route, { method = 'GET', body, token, headers = {} } = {}) => {
    const reqHeaders = { ...headers };
    if (token) reqHeaders.Authorization = `Bearer ${token}`;
    let reqBody = body;
    if (body !== undefined && typeof body !== 'string') {
      reqHeaders['Content-Type'] = 'application/json';
      reqBody = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}${route}`, {
      method,
      headers: reqHeaders,
      body: reqBody,
    });
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await res.json()
      : await res.text();
    return { status: res.status, body: data, headers: res.headers };
  };

  // 1. Observability Tests
  await t.test('Observability: /ready and /health return standard structure', async () => {
    const healthRes = await request('/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.status, 'ok');
    assert.equal(healthRes.body.database, 'connected');
    assert.equal(healthRes.body.version, '1.0.0');

    const readyRes = await request('/ready');
    assert.equal(readyRes.status, 200);
    assert.equal(readyRes.body.status, 'ok');
    assert.equal(readyRes.body.database, 'connected');
  });

  // 2. Setup Tenants, Plans, and Users
  const tenantA = await Tenant.create({
    name: 'Café Alpha',
    slug: 'cafe-alpha',
    status: 'active',
    plan: 'starter',
  });

  const tenantB = await Tenant.create({
    name: 'Café Beta',
    slug: 'cafe-beta',
    status: 'active',
    plan: 'pro',
  });

  // Create Starter Plan with max 1 branch
  await Plan.create({
    planId: 'starter',
    name: 'Starter Plan',
    priceMonthly: 999,
    priceYearly: 9990,
    limits: {
      branches: 1,
      staffUsers: 2,
      menuItems: 15,
      tables: 5,
    },
  });

  await Plan.create({
    planId: 'pro',
    name: 'Pro Plan',
    priceMonthly: 2499,
    priceYearly: 24990,
    limits: {
      branches: 5,
      staffUsers: 15,
      menuItems: 100,
      tables: 30,
    },
  });

  // Branches and Users for Tenant A
  const { branchA1, ownerA, cashierA } = await runWithTenant(tenantA._id, async () => {
    const branch = await Branch.create({
      tenantId: tenantA._id,
      name: 'Alpha Downtown',
      code: 'DT',
      isMain: true,
    });

    const owner = await User.create({
      name: 'Owner Alpha',
      email: 'owner@alpha.test',
      password: 'OwnerPassword123!',
      role: 'owner',
      tenantId: tenantA._id,
    });

    const cashier = await User.create({
      name: 'Cashier Alpha 1',
      email: 'cashier@alpha.test',
      password: 'CashierPassword123!',
      role: 'cashier',
      branchId: branch._id,
      tenantId: tenantA._id,
    });

    return { branchA1: branch, ownerA: owner, cashierA: cashier };
  });

  const branchB1 = await runWithTenant(tenantB._id, async () => {
    return Branch.create({
      tenantId: tenantB._id,
      name: 'Beta Uptown',
      code: 'UP',
      isMain: true,
    });
  });

  const ownerAToken = createAccessToken(ownerA._id, tenantA._id, { role: 'owner' });
  const cashierAToken = createAccessToken(cashierA._id, tenantA._id, { role: 'cashier', branchId: branchA1._id });

  // 3. Plan Limits Enforcement
  await t.test('Plan Limits: Starter cannot exceed maximum branches limit', async () => {
    // Attempting to create a second branch on starter plan (limit = 1)
    const createBranchRes = await request('/api/branches', {
      method: 'POST',
      token: ownerAToken,
      body: { name: 'Alpha Suburb', code: 'SB' },
    });
    assert.equal(createBranchRes.status, 403);
    assert.equal(createBranchRes.body.code, 'PLAN_LIMIT_REACHED');
    assert.equal(createBranchRes.body.feature, 'branches');
  });

  // 4. Branch Management and Safety
  await t.test('Branch Management: Cannot delete branch with active tables', async () => {
    let branchA2;
    await runWithTenant(tenantA._id, async () => {
      branchA2 = await Branch.create({
        tenantId: tenantA._id,
        name: 'Alpha West',
        code: 'WST',
        isMain: false,
      });
      await Table.create({
        tenantId: tenantA._id,
        branchId: branchA2._id,
        tableNumber: 1,
        active: true,
      });
    });

    const deleteRes = await request(`/api/branches/${branchA2._id}`, {
      method: 'DELETE',
      token: ownerAToken,
    });
    assert.equal(deleteRes.status, 400);
    assert.match(deleteRes.body.error, /assigned table/i);
  });

  // 5. Customer Table QR Validation
  await t.test('QR Validation: Returns INVALID_TABLE_QR for cross-tenant token', async () => {
    // Valid token for Tenant B table
    const tableB = await runWithTenant(tenantB._id, async () => {
      return Table.create({
        tenantId: tenantB._id,
        branchId: branchB1._id,
        tableNumber: 10,
        active: true,
      });
    });
    const tokenB = createTableQrToken(tableB._id, tenantB._id);

    // Customer scans QR while resolving against Tenant A
    const validateRes = await request(`/api/tables/qr/validate?token=${tokenB}`, {
      headers: { 'X-Tenant-Id': String(tenantA._id) },
    });
    assert.equal(validateRes.status, 404);
    assert.equal(validateRes.body.code, 'INVALID_TABLE_QR');
  });

  // 6. Super Admin Security and Impersonation Hardening
  await t.test('Super Admin & Impersonation: Impersonated tokens cannot access platform admin APIs', async () => {
    // Login as Super Admin
    const superAdminLoginRes = await request('/api/platform/admin/login', {
      method: 'POST',
      body: {
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD,
      },
    });
    assert.equal(superAdminLoginRes.status, 200);
    const superAdminToken = superAdminLoginRes.body.token;
    assert.ok(superAdminToken);

    // Impersonate Tenant A
    const impersonateRes = await request(`/api/platform/admin/tenants/${tenantA._id}/impersonate`, {
      method: 'POST',
      token: superAdminToken,
      body: { reason: 'Audit verification' },
    });
    assert.equal(impersonateRes.status, 200);
    const impersonatedToken = impersonateRes.body.token;
    assert.ok(impersonatedToken);
    assert.equal(impersonateRes.body.user.isImpersonated, true);

    // CRITICAL SECURITY CHECK:
    // Impersonated token attempts to access Super Admin platform metrics
    const privilegeEscalationAttempt = await request('/api/platform/admin/metrics', {
      token: impersonatedToken,
    });
    assert.equal(privilegeEscalationAttempt.status, 403);
    assert.equal(privilegeEscalationAttempt.body.code, 'FORBIDDEN_IMPERSONATED_ACCESS');

    // Exit impersonation endpoint works
    const exitRes = await request('/api/platform/admin/exit-impersonation', {
      method: 'POST',
      token: impersonatedToken,
    });
    assert.equal(exitRes.status, 200);
    assert.equal(exitRes.body.success, true);
  });
});
