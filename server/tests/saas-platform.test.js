import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_TEST_URI || `mongodb://127.0.0.1:27017/cafe_saas_test_${process.pid}`;
process.env.JWT_SECRET = 'saas-platform-tests-jwt-secret-min32chars';
process.env.TABLE_QR_SECRET = 'saas-platform-tests-qr-secret-min32chars';
process.env.RAZORPAY_WEBHOOK_SECRET = 'saas-platform-tests-webhook-secret-min32chars';
process.env.SUPER_ADMIN_EMAIL = 'super@platform.test';
process.env.SUPER_ADMIN_PASSWORD = 'SuperAdminTestPass123!';
process.env.TENANT_DEFAULT_SLUG = 'brewhaus';

const { createApp } = await import('../index.js');
const { default: Tenant } = await import('../models/Tenant.js');
const { default: User } = await import('../models/User.js');
const { default: Table } = await import('../models/Table.js');
const { default: Product } = await import('../models/Product.js');
const { default: Category } = await import('../models/Category.js');
const { default: SuperAdmin } = await import('../models/SuperAdmin.js');
const { default: PlatformAuditEvent } = await import('../models/PlatformAuditEvent.js');
const { default: BillingWebhookEvent } = await import('../models/BillingWebhookEvent.js');
const { runWithTenant } = await import('../utils/tenantContext.js');

const app = createApp();

test('SaaS Platform: Self-Signup, Setup Auto-provisioning, Plan Limits, Billing Webhooks, and Super-Admin', async (t) => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

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

  // Create default tenant for backward compatibility
  await Tenant.create({
    name: 'Brewhaus Café',
    slug: 'brewhaus',
    status: 'active',
    plan: 'starter',
  });

  let newTenantSlug = 'artisan-roast';
  let ownerToken = '';
  let newTenantId = null;

  await t.test('1. Self-Signup validates inputs and blocks reserved slugs', async () => {
    // Attempt signup with reserved slug 'admin'
    const resReserved = await request('/api/platform/auth/signup', {
      method: 'POST',
      body: {
        cafeName: 'Admin Café',
        email: 'admin@reserved.test',
        password: 'Password123!',
        slug: 'admin',
      },
    });
    assert.equal(resReserved.status, 400);
    assert.match(resReserved.body.error, /reserved/i);

    // Attempt signup with reserved slug 'billing'
    const resBilling = await request('/api/platform/auth/signup', {
      method: 'POST',
      body: {
        cafeName: 'Billing Café',
        email: 'billing@reserved.test',
        password: 'Password123!',
        slug: 'billing',
      },
    });
    assert.equal(resBilling.status, 400);

    // Attempt signup with invalid characters
    const resInvalid = await request('/api/platform/auth/signup', {
      method: 'POST',
      body: {
        cafeName: 'Bad Slug Café',
        email: 'bad@slug.test',
        password: 'Password123!',
        slug: 'bad_slug!',
      },
    });
    assert.equal(resInvalid.status, 400);

    // Valid signup
    const resValid = await request('/api/platform/auth/signup', {
      method: 'POST',
      body: {
        cafeName: 'Artisan Roast',
        email: 'owner@artisanroast.test',
        password: 'SecurePassword123!',
        slug: newTenantSlug,
      },
    });
    assert.equal(resValid.status, 200);
    assert.ok(resValid.body.demoCode);
    const demoCode = resValid.body.demoCode;

    // Verify email and auto-provision café assets
    const resVerify = await request('/api/platform/auth/verify-email', {
      method: 'POST',
      body: {
        email: 'owner@artisanroast.test',
        code: demoCode,
      },
    });

    assert.equal(resVerify.status, 201);
    assert.ok(resVerify.body.token);
    assert.equal(resVerify.body.tenant.slug, newTenantSlug);
    assert.equal(resVerify.body.user.role, 'owner');

    ownerToken = resVerify.body.token;
    newTenantId = resVerify.body.tenant.id;

    // Verify starter resources were auto-created for the new tenant
    await runWithTenant(newTenantId, async () => {
      const categories = await Category.find({ tenantId: newTenantId });
      assert.equal(categories.length, 3);

      const products = await Product.find({ tenantId: newTenantId });
      assert.equal(products.length, 3);

      const tables = await Table.find({ tenantId: newTenantId });
      assert.equal(tables.length, 3);
      assert.ok(tables[0].qrCode.startsWith('data:image/png;base64'));
      assert.ok(tables[0].qrUrl.includes('tableToken='));
    });

    // Attempting to signup with the same slug now fails with taken error
    const resDuplicate = await request('/api/platform/auth/signup', {
      method: 'POST',
      body: {
        cafeName: 'Artisan Roast Duplicate',
        email: 'another@test.com',
        password: 'Password123!',
        slug: newTenantSlug,
      },
    });
    assert.equal(resDuplicate.status, 400);
    assert.match(resDuplicate.body.error, /already taken/i);
  });

  await t.test('2. Server-side Plan Limits enforce table and menu item thresholds', async () => {
    // Starter plan limit is 5 tables. New tenant currently has 3 tables.
    // Adding 2 more tables (Tables 4 and 5) should succeed:
    const resT4 = await request('/api/tables', {
      method: 'POST',
      token: ownerToken,
      body: { tableNumber: 4, seats: 4, label: 'Table 4' },
    });
    assert.equal(resT4.status, 201);

    const resT5 = await request('/api/tables', {
      method: 'POST',
      token: ownerToken,
      body: { tableNumber: 5, seats: 4, label: 'Table 5' },
    });
    assert.equal(resT5.status, 201);

    // Attempting to add 6th table must be blocked by checkTableLimit middleware with 403
    const resT6 = await request('/api/tables', {
      method: 'POST',
      token: ownerToken,
      body: { tableNumber: 6, seats: 4, label: 'Table 6' },
    });
    assert.equal(resT6.status, 403);
    assert.ok(['PLAN_LIMIT_REACHED', 'PLAN_LIMIT_EXCEEDED'].includes(resT6.body.code));
    assert.match(resT6.body.error, /limit/i);
  });

  await t.test('3. Razorpay Subscription Webhooks: signature validation, idempotency, and lifecycle', async () => {
    const makeSignature = (payloadObj) => {
      const raw = JSON.stringify(payloadObj);
      const sig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
      return sig;
    };

    // Sub event payload
    const testSubId = 'sub_test_saas_12345';
    // Link sub to tenant
    await Tenant.findByIdAndUpdate(newTenantId, { 'subscription.razorpaySubscriptionId': testSubId });

    const chargedPayload = {
      event: 'subscription.charged',
      created_at: 1760000000,
      payload: {
        subscription: {
          entity: {
            id: testSubId,
            current_end: 1762592000,
          },
        },
      },
    };

    // Invalid signature must be rejected with 400
    const resBadSig = await request('/api/billing/webhook', {
      method: 'POST',
      body: chargedPayload,
      headers: { 'x-razorpay-signature': 'invalidsignature' },
    });
    assert.equal(resBadSig.status, 400);

    // Valid signature succeeds
    const validSig = makeSignature(chargedPayload);
    const resCharged = await request('/api/billing/webhook', {
      method: 'POST',
      body: chargedPayload,
      headers: {
        'x-razorpay-signature': validSig,
        'x-razorpay-event-id': 'evt_sub_charged_001',
      },
    });
    assert.equal(resCharged.status, 200);
    assert.equal(resCharged.body.status, 'processed');

    // Duplicate webhook with the same event ID must be safely ignored (idempotent)
    const resDup = await request('/api/billing/webhook', {
      method: 'POST',
      body: chargedPayload,
      headers: {
        'x-razorpay-signature': validSig,
        'x-razorpay-event-id': 'evt_sub_charged_001',
      },
    });
    assert.equal(resDup.status, 200);
    assert.equal(resDup.body.status, 'ignored');
    assert.equal(resDup.body.reason, 'duplicate_event');

    // Verify tenant status became active
    const tUpdated = await Tenant.findById(newTenantId);
    assert.equal(tUpdated.subscription.status, 'active');

    // Test payment.failed puts tenant into past_due with grace period
    const failedPayload = {
      event: 'payment.failed',
      created_at: 1760000100,
      payload: {
        subscription: {
          entity: {
            id: testSubId,
          },
        },
      },
    };
    const failedSig = makeSignature(failedPayload);
    await request('/api/billing/webhook', {
      method: 'POST',
      body: failedPayload,
      headers: {
        'x-razorpay-signature': failedSig,
        'x-razorpay-event-id': 'evt_pay_failed_001',
      },
    });

    const tFailed = await Tenant.findById(newTenantId);
    assert.equal(tFailed.subscription.status, 'past_due');
    assert.ok(tFailed.subscription.gracePeriodUntil);

    // Test subscription.halted suspends the tenant
    const haltedPayload = {
      event: 'subscription.halted',
      created_at: 1760000200,
      payload: {
        subscription: {
          entity: {
            id: testSubId,
          },
        },
      },
    };
    const haltedSig = makeSignature(haltedPayload);
    await request('/api/billing/webhook', {
      method: 'POST',
      body: haltedPayload,
      headers: {
        'x-razorpay-signature': haltedSig,
        'x-razorpay-event-id': 'evt_sub_halted_001',
      },
    });

    const tHalted = await Tenant.findById(newTenantId);
    assert.equal(tHalted.status, 'suspended');
    assert.equal(tHalted.subscription.status, 'suspended');
  });

  await t.test('4. Tenant Owner Billing, Downgrade Protection, Data Export, and Cancellation', async () => {
    // Reactivate tenant for owner billing test
    await Tenant.findByIdAndUpdate(newTenantId, { status: 'active', 'subscription.status': 'active', plan: 'pro', 'subscription.plan': 'pro' });

    // GET /summary
    const resSummary = await request('/api/tenant/billing/summary', {
      method: 'GET',
      token: ownerToken,
    });
    assert.equal(resSummary.status, 200);
    assert.equal(resSummary.body.plan, 'pro');
    assert.equal(resSummary.body.usage.tables, 5);

    // Downgrade protection: Current tenant has 5 tables. Starter allows up to 5 tables.
    // If we add another table (6 tables on pro), downgrade to starter must be blocked:
    await request('/api/tables', {
      method: 'POST',
      token: ownerToken,
      body: { tableNumber: 6, seats: 2, label: 'Table 6' },
    });

    const resDowngradeBlocked = await request('/api/tenant/billing/change-plan', {
      method: 'POST',
      token: ownerToken,
      body: { plan: 'starter' },
    });
    assert.equal(resDowngradeBlocked.status, 400);
    assert.match(resDowngradeBlocked.body.error, /table count \(6\) exceeds the limit \(5\)/i);

    // Export café data
    const resExport = await request('/api/tenant/billing/export', {
      method: 'GET',
      token: ownerToken,
    });
    assert.equal(resExport.status, 200);
    assert.equal(resExport.body.cafe.slug, newTenantSlug);
    assert.equal(resExport.body.tables.length, 6);

    // Cancel subscription with 30-day retention
    const resCancel = await request('/api/tenant/billing/cancel', {
      method: 'POST',
      token: ownerToken,
      body: { reason: 'Closing store' },
    });
    assert.equal(resCancel.status, 200);
    assert.equal(resCancel.body.status, 'suspended');
    assert.ok(resCancel.body.scheduledPurgeAt);

    const tCancelled = await Tenant.findById(newTenantId);
    assert.equal(tCancelled.status, 'suspended');
    assert.ok(tCancelled.deletionRequestedAt);
  });

  await t.test('5. Super-Admin Panel: Login, Platform Metrics, Tenant Management, and Impersonation', async () => {
    // Login as super admin (auto-bootstraps credentials from env)
    const resLogin = await request('/api/platform/admin/login', {
      method: 'POST',
      body: {
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD,
      },
    });
    assert.equal(resLogin.status, 200);
    assert.ok(resLogin.body.token);
    assert.equal(resLogin.body.admin.role, 'super_admin');
    const adminToken = resLogin.body.token;

    // Platform metrics
    const resMetrics = await request('/api/platform/admin/metrics', {
      method: 'GET',
      token: adminToken,
    });
    assert.equal(resMetrics.status, 200);
    assert.equal(resMetrics.body.metrics.totalTenants, 2);

    // List tenants
    const resTenants = await request('/api/platform/admin/tenants', {
      method: 'GET',
      token: adminToken,
    });
    assert.equal(resTenants.status, 200);
    assert.equal(resTenants.body.tenants.length, 2);

    // Suspend / Reactivate tenant via super-admin
    const resReactivate = await request(`/api/platform/admin/tenants/${newTenantId}/status`, {
      method: 'PUT',
      token: adminToken,
      body: { status: 'active', reason: 'Admin manual reactivation' },
    });
    assert.equal(resReactivate.status, 200);
    assert.equal(resReactivate.body.tenant.status, 'active');

    // Impersonate tenant
    const resImpersonate = await request(`/api/platform/admin/tenants/${newTenantId}/impersonate`, {
      method: 'POST',
      token: adminToken,
    });
    assert.equal(resImpersonate.status, 200);
    assert.ok(resImpersonate.body.token);
    assert.equal(resImpersonate.body.user.impersonatedBy, process.env.SUPER_ADMIN_EMAIL);

    // Verify GET /me returns impersonatedBy claim
    const resMe = await request('/api/auth/me', {
      method: 'GET',
      token: resImpersonate.body.token,
    });
    assert.equal(resMe.status, 200);
    assert.equal(resMe.body.user.impersonatedBy, process.env.SUPER_ADMIN_EMAIL);

    // Verify PlatformAuditEvent was logged
    const resAudit = await request('/api/platform/admin/audit-logs', {
      method: 'GET',
      token: adminToken,
    });
    assert.equal(resAudit.status, 200);
    assert.ok(resAudit.body.logs.length >= 2);
    const impersonateLog = resAudit.body.logs.find((l) => l.action.startsWith('tenant.impersonate'));
    assert.ok(impersonateLog);
    assert.equal(impersonateLog.actorEmail, process.env.SUPER_ADMIN_EMAIL);
  });

  server.close();
  await mongoose.disconnect();
});
