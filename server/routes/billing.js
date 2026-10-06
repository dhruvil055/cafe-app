import express from 'express';
import crypto from 'crypto';
import Tenant from '../models/Tenant.js';
import Table from '../models/Table.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';
import BillingWebhookEvent from '../models/BillingWebhookEvent.js';
import { PLANS } from '../config/plans.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { runWithSystemTenantAccess } from '../utils/tenantContext.js';

const router = express.Router();

const getTenantWebhookSecret = (tenant) => {
  // Per-tenant webhook secret takes precedence, fallback to platform secret
  return tenant?.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || process.env.JWT_SECRET || 'brewhaus-billing-webhook-secret-min32chars';
};

const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!Buffer.isBuffer(rawBody) || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const suppliedBytes = Buffer.from(String(signature));
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && crypto.timingSafeEqual(suppliedBytes, expectedBytes);
};

const getTenantIdFromWebhook = async (subId, tenantNotesId) => {
  let tenant = null;
  if (subId) {
    tenant = await Tenant.findOne({ 'subscription.razorpaySubscriptionId': subId });
  }
  if (!tenant && tenantNotesId) {
    tenant = await Tenant.findById(tenantNotesId);
  }
  return tenant;
};

const verifyWebhookSignatureForTenant = (rawBody, signature, tenant) => {
  const secret = getTenantWebhookSecret(tenant);
  return verifyWebhookSignature(rawBody, signature, secret);
};


// POST /api/billing/webhook - Razorpay Subscription Webhook
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

    const payload = req.body || {};
    const event = String(payload.event || '');
    const eventId = String(
      req.headers['x-razorpay-event-id'] ||
      payload.event_id ||
      `${event}_${payload.payload?.subscription?.entity?.id || payload.payload?.payment?.entity?.id || 'evt'}_${payload.created_at || Date.now()}`
    );

    // 1. Idempotency guard: duplicate webhooks are recorded and ignored safely
    try {
      await BillingWebhookEvent.create({
        eventId,
        eventType: event,
        payload,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(200).json({ status: 'ignored', reason: 'duplicate_event', eventId });
      }
      throw err;
    }

    // 2. Process Subscription Events
    const subscriptionEntity = payload.payload?.subscription?.entity;
    const paymentEntity = payload.payload?.payment?.entity;
    const subId = subscriptionEntity?.id || paymentEntity?.subscription_id;
    const tenantNotesId = subscriptionEntity?.notes?.tenantId || paymentEntity?.notes?.tenantId;

    await runWithSystemTenantAccess(async () => {
      const tenant = await getTenantIdFromWebhook(subId, tenantNotesId);

      if (!tenant) {
        // Acknowledge webhook even if tenant not yet linked to prevent webhook retries
        return;
      }

      if (!verifyWebhookSignatureForTenant(rawBody, signature, tenant)) {
        return res.status(400).json({ error: 'Invalid Razorpay webhook signature.' });
      }

      if (event === 'subscription.charged') {
        tenant.subscription.status = 'active';
        tenant.status = 'active';
        tenant.subscription.gracePeriodUntil = null;
        if (subscriptionEntity?.current_end) {
          tenant.subscription.currentPeriodEnd = new Date(subscriptionEntity.current_end * 1000);
        }
        await tenant.save();
      } else if (event === 'payment.failed') {
        tenant.subscription.status = 'past_due';
        if (!tenant.subscription.gracePeriodUntil) {
          // 3-day grace period
          tenant.subscription.gracePeriodUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        }
        await tenant.save();
      } else if (event === 'subscription.halted' || event === 'subscription.cancelled') {
        tenant.subscription.status = 'suspended';
        tenant.status = 'suspended';
        await tenant.save();
      }

      // Update event record with resolved tenant
      await BillingWebhookEvent.updateOne({ eventId }, { $set: { tenantId: tenant._id, status: 'processed' } });
    });

    res.status(200).json({ status: 'processed', eventId });
  } catch (error) {
    next(error);
  }
});

// ── Tenant Owner Billing Routes ──────────────────────────────────────────────

// GET /api/tenant/billing/summary
router.get('/summary', protect, adminOnly, async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

    const [tableCount, productCount, staffCount] = await Promise.all([
      Table.countDocuments({ tenantId: req.tenantId }),
      Product.countDocuments({ tenantId: req.tenantId }),
      User.countDocuments({ tenantId: req.tenantId, role: { $ne: 'customer' } }),
    ]);

    const planConfig = PLANS[tenant.plan] || PLANS.starter;

    res.json({
      plan: tenant.plan,
      planDetails: planConfig,
      subscription: tenant.subscription || { status: 'trial', plan: tenant.plan },
      limits: planConfig.limits,
      usage: {
        tables: tableCount,
        menuItems: productCount,
        staffUsers: staffCount,
      },
      deletionRequestedAt: tenant.deletionRequestedAt,
      scheduledPurgeAt: tenant.scheduledPurgeAt,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tenant/billing/change-plan
router.post('/change-plan', protect, adminOnly, async (req, res, next) => {
  try {
    const { plan } = req.body || {};
    if (!['starter', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    const targetPlan = PLANS[plan];
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

    // Validate current usage against new plan limits (downgrade protection)
    const [tableCount, productCount, staffCount] = await Promise.all([
      Table.countDocuments({ tenantId: req.tenantId }),
      Product.countDocuments({ tenantId: req.tenantId }),
      User.countDocuments({ tenantId: req.tenantId, role: { $ne: 'customer' } }),
    ]);

    if (tableCount > targetPlan.limits.tables) {
      return res.status(400).json({
        error: `Cannot change to ${targetPlan.name} plan: your table count (${tableCount}) exceeds the limit (${targetPlan.limits.tables}). Please delete tables first.`,
        code: 'PLAN_LIMIT_EXCEEDED',
      });
    }

    if (productCount > targetPlan.limits.menuItems) {
      return res.status(400).json({
        error: `Cannot change to ${targetPlan.name} plan: your menu item count (${productCount}) exceeds the limit (${targetPlan.limits.menuItems}). Please delete menu items first.`,
        code: 'PLAN_LIMIT_EXCEEDED',
      });
    }

    if (staffCount > targetPlan.limits.staffUsers) {
      return res.status(400).json({
        error: `Cannot change to ${targetPlan.name} plan: your staff count (${staffCount}) exceeds the limit (${targetPlan.limits.staffUsers}). Please remove staff members first.`,
        code: 'PLAN_LIMIT_EXCEEDED',
      });
    }

    tenant.plan = plan;
    tenant.subscription.plan = plan;
    tenant.subscription.status = 'active';
    await tenant.save();

    res.json({
      success: true,
      plan: tenant.plan,
      subscription: tenant.subscription,
      limits: targetPlan.limits,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tenant/billing/cancel
router.post('/cancel', protect, adminOnly, async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

    const now = new Date();
    const purgeDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30-day data retention

    tenant.status = 'suspended';
    tenant.subscription.status = 'cancelled';
    tenant.deletionRequestedAt = now;
    tenant.scheduledPurgeAt = purgeDate;
    await tenant.save();

    res.json({
      success: true,
      status: tenant.status,
      subscriptionStatus: tenant.subscription.status,
      scheduledPurgeAt: tenant.scheduledPurgeAt,
      message: 'Subscription cancelled. Account is suspended with a 30-day data retention period.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tenant/billing/export (also alias for /api/tenant/export)
router.get('/export', protect, adminOnly, async (req, res, next) => {
  try {
    const [tenant, categories, products, tables, orders, customers] = await Promise.all([
      Tenant.findById(req.tenantId).lean(),
      Category.find({ tenantId: req.tenantId }).lean(),
      Product.find({ tenantId: req.tenantId }).lean(),
      Table.find({ tenantId: req.tenantId }).lean(),
      Order.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(1000).lean(),
      Customer.find({ tenantId: req.tenantId }).lean(),
    ]);

    const sanitizedData = {
      exportedAt: new Date().toISOString(),
      cafe: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        settings: tenant.settings,
      },
      categories: categories.map((c) => ({ name: c.name, icon: c.icon, sortOrder: c.sortOrder })),
      products: products.map((p) => ({ name: p.name, description: p.description, price: p.price, available: p.available })),
      tables: tables.map((t) => ({ tableNumber: t.tableNumber, label: t.label, seats: t.seats })),
      orders: orders.map((o) => ({ orderNumber: o.orderNumber, status: o.status, total: o.pricing?.finalTotal, createdAt: o.createdAt })),
      customers: customers.map((c) => ({ name: c.name, phone: c.phone, totalVisits: c.stats?.totalVisits })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${tenant.slug}-export-${Date.now()}.json"`);
    res.send(JSON.stringify(sanitizedData, null, 2));
  } catch (error) {
    next(error);
  }
});

export default router;