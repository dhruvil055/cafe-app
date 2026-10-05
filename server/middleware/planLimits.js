import { getPlan } from '../config/plans.js';
import Table from '../models/Table.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

export const getTenantPlanConfig = (tenant) => {
  const planId = tenant?.plan || tenant?.subscription?.plan || 'starter';
  return getPlan(planId);
};

export const checkTableLimit = async (req, res, next) => {
  try {
    const plan = getTenantPlanConfig(req.tenant);
    const count = await Table.countDocuments();
    if (count >= plan.limits.tables) {
      return res.status(403).json({
        error: `Table limit of ${plan.limits.tables} reached for your ${plan.name}. Please upgrade your subscription to add more tables.`,
        code: 'PLAN_LIMIT_EXCEEDED',
        resource: 'tables',
        limit: plan.limits.tables,
        current: count,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const checkMenuItemLimit = async (req, res, next) => {
  try {
    const plan = getTenantPlanConfig(req.tenant);
    const count = await Product.countDocuments();
    if (count >= plan.limits.menuItems) {
      return res.status(403).json({
        error: `Menu item limit of ${plan.limits.menuItems} reached for your ${plan.name}. Please upgrade your subscription to add more items.`,
        code: 'PLAN_LIMIT_EXCEEDED',
        resource: 'menuItems',
        limit: plan.limits.menuItems,
        current: count,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const checkStaffUserLimit = async (req, res, next) => {
  try {
    const plan = getTenantPlanConfig(req.tenant);
    const count = await User.countDocuments();
    if (count >= plan.limits.staffUsers) {
      return res.status(403).json({
        error: `Team member limit of ${plan.limits.staffUsers} reached for your ${plan.name}. Please upgrade your subscription to add more team members.`,
        code: 'PLAN_LIMIT_EXCEEDED',
        resource: 'staffUsers',
        limit: plan.limits.staffUsers,
        current: count,
      });
    }
    next();
  } catch (error) {
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
