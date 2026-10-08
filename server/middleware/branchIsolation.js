import mongoose from 'mongoose';
import Branch from '../models/Branch.js';

/**
 * Validates that any branchId sent by the client belongs to the active tenant,
 * and that the authenticated user has access rights to that branch.
 */
export const validateBranchAccess = async (req, requestedBranchId) => {
  if (!requestedBranchId) return null;
  if (!mongoose.isValidObjectId(requestedBranchId)) {
    const error = new Error('Invalid branch ID.');
    error.code = 'INVALID_BRANCH_ID';
    error.status = 400;
    throw error;
  }

  // Find branch inside current tenant scope
  const branch = await Branch.findById(requestedBranchId);
  if (!branch) {
    const error = new Error('Branch not found in this café.');
    error.code = 'BRANCH_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  if (!branch.active) {
    const error = new Error('This branch is currently inactive.');
    error.code = 'BRANCH_INACTIVE';
    error.status = 403;
    throw error;
  }

  // If user is authenticated, check role & assigned branches
  const user = req.user;
  if (user && !['owner', 'super_admin'].includes(user.role)) {
    const assignedBranchId = user.branchId ? String(user.branchId) : null;
    const accessible = (user.accessibleBranches || []).map(b => String(b));

    const isAuthorized =
      (assignedBranchId && assignedBranchId === String(branch._id)) ||
      accessible.includes(String(branch._id));

    // If user has branch restrictions and requested branch is not in their allowed set
    if (assignedBranchId && !isAuthorized) {
      const error = new Error('You do not have permission to access or perform operations on this branch.');
      error.code = 'BRANCH_ACCESS_DENIED';
      error.status = 403;
      throw error;
    }
  }

  return branch;
};

/**
 * Express middleware to validate and attach branch context.
 * Resolves branch from:
 * 1. Header: x-branch-id
 * 2. Query param: branchId
 * 3. Body: branchId
 * 4. User default: user.branchId (if user is restricted to a branch)
 */
export const branchScopeMiddleware = async (req, res, next) => {
  try {
    const rawBranchId =
      req.headers['x-branch-id'] ||
      req.headers['x-branch-id'.toLowerCase()] ||
      req.query?.branchId ||
      req.body?.branchId ||
      req.user?.branchId ||
      null;

    if (rawBranchId) {
      const branch = await validateBranchAccess(req, rawBranchId);
      req.branchId = branch ? branch._id : null;
      req.branch = branch;
    } else {
      req.branchId = null;
      req.branch = null;
    }

    next();
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message || 'Branch validation error.',
      code: error.code || 'BRANCH_VALIDATION_ERROR',
    });
  }
};

/**
 * Middleware that REQUIRES an active, valid branch context.
 */
export const requireBranch = async (req, res, next) => {
  try {
    if (!req.branchId) {
      const fallbackBranch = req.user?.branchId || (await Branch.findOne({ isMain: true }))?._id;
      if (fallbackBranch) {
        req.branchId = fallbackBranch;
      } else {
        return res.status(400).json({
          error: 'Branch specification is required for this operation.',
          code: 'BRANCH_REQUIRED',
        });
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};
