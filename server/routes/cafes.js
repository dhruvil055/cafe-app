import express from 'express';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import { runWithSystemTenantAccess } from '../utils/tenantContext.js';
import { sendApiSuccess, sendApiError } from '../utils/apiResponse.js';

const router = express.Router();

const slugify = (text) => {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// ── 10. Create Cafe / Start Free Trial ───────────────────────────────────────
// POST /api/cafes
router.post('/', async (req, res, next) => {
  try {
    const { name, ownerEmail, trialDays } = req.body;
    if (!name || !name.trim()) {
      return sendApiError(res, 400, 'VALIDATION_ERROR', 'Cafe name is required.');
    }

    const trimmedName = name.trim();
    const candidateSlug = slugify(trimmedName);
    const normalizedEmail = ownerEmail ? String(ownerEmail).trim().toLowerCase() : '';

    // Check slug duplication
    const existingTenant = await runWithSystemTenantAccess(async () => {
      return Tenant.findOne({ slug: candidateSlug }).lean();
    });
    if (existingTenant) {
      return sendApiError(res, 409, 'CAFE_SLUG_EXISTS', 'A cafe with this slug already exists.');
    }

    // Check owner email duplication
    if (normalizedEmail) {
      const existingUser = await runWithSystemTenantAccess(async () => {
        return User.findOne({ email: normalizedEmail }).lean();
      });
      if (existingUser) {
        return sendApiError(
          res,
          409,
          'OWNER_ALREADY_EXISTS',
          'This email is already associated with an existing cafe owner.'
        );
      }
    }

    const days = Math.max(1, Number(trialDays) || 14);
    const trialEndsAt = new Date(Date.now() + days * 86400000);

    const tenant = await runWithSystemTenantAccess(async () => {
      return Tenant.create({
        name: trimmedName,
        slug: candidateSlug,
        status: 'active',
        plan: 'starter',
        subscription: {
          plan: 'starter',
          status: 'trial',
          trialEndsAt,
        },
        settings: {
          cafeName: trimmedName,
          primaryColor: '#c96b18',
          accentColor: '#1a0f08',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          taxRate: 5,
        },
      });
    });

    return sendApiSuccess(res, 201, {
      cafe: {
        id: String(tenant._id),
        name: tenant.name,
        slug: tenant.slug,
        status: 'TRIAL',
        trialEndsAt: trialEndsAt.toISOString(),
      },
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.slug) {
      return sendApiError(res, 409, 'CAFE_SLUG_EXISTS', 'A cafe with this slug already exists.');
    }
    next(error);
  }
});

export default router;
