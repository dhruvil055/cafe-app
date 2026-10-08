import Branch from '../models/Branch.js';
import Table from '../models/Table.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Subscription from '../models/Subscription.js';
import Plan from '../models/Plan.js';
import { getPlan } from '../config/plans.js';

/**
 * Fetch resolved limits for a tenant.
 * Considers Subscription overrides, dynamic Plan DB record, or fallback static config.
 */
export const getTenantLimits = async (tenantId, tenantPlan = 'starter') => {
  let sub = null;
  try {
    sub = await Subscription.findOne({ tenantId }).lean();
  } catch {
    // Ignore lookup error, default to null
  }

  const activePlanId = sub?.plan || tenantPlan || 'starter';
  let dbPlan = null;
  try {
    dbPlan = await Plan.findOne({ planId: activePlanId, active: true }).lean();
  } catch {
    // Ignore lookup error, default to null
  }

  const baseConfig = getPlan(activePlanId);
  const baseLimits = dbPlan?.limits || {
    branches: baseConfig?.limits?.outlets || 1,
    tables: baseConfig?.limits?.tables || 5,
    menuItems: baseConfig?.limits?.menuItems || 20,
    staffUsers: baseConfig?.limits?.staffUsers || 2,
    monthlyOrders: baseConfig?.limits?.monthlyOrders || 250,
  };

  // Allow custom subscription overrides (e.g. for enterprise negotiated terms)
  const overrides = sub?.usageOverrides || {};
  return {
    planId: activePlanId,
    status: sub?.status || 'active',
    limits: {
      branches: Number(overrides.branches ?? baseLimits.branches ?? 1),
      tables: Number(overrides.tables ?? baseLimits.tables ?? 5),
      menuItems: Number(overrides.menuItems ?? baseLimits.menuItems ?? 20),
      staffUsers: Number(overrides.staffUsers ?? baseLimits.staffUsers ?? 2),
      monthlyOrders: Number(overrides.monthlyOrders ?? baseLimits.monthlyOrders ?? 250),
    },
    features: dbPlan?.features || baseConfig?.features || {},
  };
};

/**
 * Get current count for a given feature in a tenant scope.
 */
export const getCurrentUsage = async (feature) => {
  switch (feature) {
    case 'branches':
      return Branch.countDocuments({ active: { $ne: false } });
    case 'tables':
      return Table.countDocuments({ active: { $ne: false } });
    case 'menuItems':
      return Product.countDocuments();
    case 'staffUsers':
      return User.countDocuments({ active: { $ne: false } });
    case 'monthlyOrders': {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      return Order.countDocuments({ createdAt: { $gte: startOfMonth } });
    }
    default:
      return 0;
  }
};

/**
 * Verify whether a feature can increment by +1.
 * Throws or returns validation result.
 */
export const checkLimit = async (tenantId, tenantPlan, feature) => {
  const { limits, status } = await getTenantLimits(tenantId, tenantPlan);

  if (status === 'suspended') {
    const error = new Error('Your café account subscription is currently suspended.');
    error.code = 'SUBSCRIPTION_SUSPENDED';
    error.status = 403;
    throw error;
  }

  const current = await getCurrentUsage(feature);
  const maxLimit = limits[feature] ?? Infinity;

  if (current >= maxLimit) {
    const error = new Error(`Plan limit reached for ${feature}. Allowed: ${maxLimit}, Current: ${current}.`);
    error.code = 'PLAN_LIMIT_REACHED';
    error.feature = feature;
    error.limit = maxLimit;
    error.current = current;
    error.status = 403;
    throw error;
  }

  return { allowed: true, current, limit: maxLimit, feature };
};

/**
 * Express middleware to enforce plan limits on create/add endpoints.
 */
export const enforceUsageLimit = (feature) => {
  return async (req, res, next) => {
    try {
      await checkLimit(req.tenantId, req.tenant?.plan, feature);
      next();
    } catch (err) {
      if (err.code === 'PLAN_LIMIT_REACHED') {
        return res.status(403).json({
          error: `Plan limit reached for ${feature}. Please upgrade your subscription to add more.`,
          code: 'PLAN_LIMIT_REACHED',
          feature: err.feature,
          limit: err.limit,
          current: err.current,
        });
      }
      next(err);
    }
  };
};
