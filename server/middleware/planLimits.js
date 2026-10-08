import { getPlan } from '../config/plans.js';
import { checkLimit } from '../services/usageLimitService.js';

export const getTenantPlanConfig = (tenant) => {
  const planId = tenant?.plan || tenant?.subscription?.plan || 'starter';
  return getPlan(planId);
};

export const checkTableLimit = async (req, res, next) => {
  try {
    await checkLimit(req.tenantId, req.tenant?.plan, 'tables');
    next();
  } catch (error) {
    if (error.code === 'PLAN_LIMIT_REACHED') {
      return res.status(403).json({
        error: 'Plan limit reached.',
        code: 'PLAN_LIMIT_REACHED',
        feature: 'tables',
        limit: error.limit,
        current: error.current,
      });
    }
    next(error);
  }
};

export const checkMenuItemLimit = async (req, res, next) => {
  try {
    await checkLimit(req.tenantId, req.tenant?.plan, 'menuItems');
    next();
  } catch (error) {
    if (error.code === 'PLAN_LIMIT_REACHED') {
      return res.status(403).json({
        error: 'Plan limit reached.',
        code: 'PLAN_LIMIT_REACHED',
        feature: 'menuItems',
        limit: error.limit,
        current: error.current,
      });
    }
    next(error);
  }
};

export const checkStaffUserLimit = async (req, res, next) => {
  try {
    await checkLimit(req.tenantId, req.tenant?.plan, 'staffUsers');
    next();
  } catch (error) {
    if (error.code === 'PLAN_LIMIT_REACHED') {
      return res.status(403).json({
        error: 'Plan limit reached.',
        code: 'PLAN_LIMIT_REACHED',
        feature: 'staffUsers',
        limit: error.limit,
        current: error.current,
      });
    }
    next(error);
  }
};

export const checkPlanFeature = (featureName) => (req, res, next) => {
  const plan = getTenantPlanConfig(req.tenant);
  if (!plan.features?.[featureName]) {
    return res.status(403).json({
      error: `The feature '${featureName}' is not available on your ${plan.name}. Please upgrade your plan to unlock this feature.`,
      code: 'PLAN_FEATURE_RESTRICTED',
      feature: featureName,
      requiredPlan: 'pro',
    });
  }
  next();
};
