import express from 'express';
import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import Tenant from '../models/Tenant.js';
import Table from '../models/Table.js';
import { protect, ownerOrManager } from '../middleware/auth.js';
import { getPlan } from '../config/plans.js';

const router = express.Router();

// Helper to ensure tenant has at least a Main Branch
export const ensureMainBranch = async (tenantId, tenantName = 'Main') => {
  let mainBranch = await Branch.findOne({ isMain: true });
  if (!mainBranch) {
    mainBranch = await Branch.findOne();
  }
  if (!mainBranch) {
    mainBranch = await Branch.create({
      tenantId,
      name: `${tenantName} (Main Branch)`,
      code: 'MAIN-01',
      isMain: true,
      active: true,
    });
  }
  return mainBranch;
};

// GET /api/branches - List branches
router.get('/', protect, async (req, res, next) => {
  try {
    let branches = await Branch.find().sort({ isMain: -1, createdAt: 1 }).lean();
    if (branches.length === 0) {
      const defaultBranch = await ensureMainBranch(req.tenantId, req.tenant?.name || 'Main');
      branches = [defaultBranch.toObject ? defaultBranch.toObject() : defaultBranch];
    }
    return res.json({ success: true, branches });
  } catch (error) {
    next(error);
  }
});

// POST /api/branches - Create branch
router.post('/', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { name, code, address, city, state, phone, email, gstin, isMain } = req.body || {};
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Branch name is required.' });
    }

    const currentCount = await Branch.countDocuments();
    const plan = getPlan(req.tenant?.plan || 'starter');
    const maxOutlets = plan.limits?.outlets || 1;

    if (currentCount >= maxOutlets) {
      return res.status(403).json({
        error: `Your current ${plan.name} allows up to ${maxOutlets} branch(es). Please upgrade your subscription to add more.`,
        code: 'BRANCH_LIMIT_EXCEEDED',
      });
    }

    const cleanCode = String(code || `BR-${currentCount + 1}`).trim().toUpperCase();
    const existingCode = await Branch.findOne({ code: cleanCode });
    if (existingCode) {
      return res.status(400).json({ error: `Branch code '${cleanCode}' is already in use.` });
    }

    if (isMain) {
      await Branch.updateMany({}, { isMain: false });
    }

    const branch = await Branch.create({
      tenantId: req.tenantId,
      name: name.trim(),
      code: cleanCode,
      address: String(address || '').trim(),
      city: String(city || '').trim(),
      state: String(state || '').trim(),
      phone: String(phone || '').trim(),
      email: String(email || '').trim().toLowerCase(),
      gstin: String(gstin || '').trim().toUpperCase(),
      isMain: Boolean(isMain) || currentCount === 0,
      active: true,
    });

    return res.status(201).json({ success: true, branch });
  } catch (error) {
    next(error);
  }
});

// PUT /api/branches/:id - Update branch
router.put('/:id', protect, ownerOrManager, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid branch ID.' });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found.' });
    }

    const { name, code, address, city, state, phone, email, gstin, isMain, active } = req.body || {};

    if (name?.trim()) branch.name = name.trim();
    if (code?.trim()) {
      const cleanCode = code.trim().toUpperCase();
      if (cleanCode !== branch.code) {
        const existing = await Branch.findOne({ code: cleanCode, _id: { $ne: branch._id } });
        if (existing) return res.status(400).json({ error: `Branch code '${cleanCode}' already exists.` });
        branch.code = cleanCode;
      }
    }
    if (address !== undefined) branch.address = String(address).trim();
    if (city !== undefined) branch.city = String(city).trim();
    if (state !== undefined) branch.state = String(state).trim();
    if (phone !== undefined) branch.phone = String(phone).trim();
    if (email !== undefined) branch.email = String(email).trim().toLowerCase();
    if (gstin !== undefined) branch.gstin = String(gstin).trim().toUpperCase();
    if (active !== undefined) branch.active = Boolean(active);

    if (isMain && !branch.isMain) {
      await Branch.updateMany({ _id: { $ne: branch._id } }, { isMain: false });
      branch.isMain = true;
    }

    await branch.save();
    return res.json({ success: true, branch });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/branches/:id - Delete branch
router.delete('/:id', protect, ownerOrManager, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid branch ID.' });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found.' });
    }

    const totalBranches = await Branch.countDocuments();
    if (totalBranches <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only branch of a café.' });
    }

    // Check if tables are assigned to this branch
    const tableCount = await Table.countDocuments({ branchId: branch._id });
    if (tableCount > 0) {
      return res.status(400).json({
        error: `Cannot delete branch because it has ${tableCount} assigned table(s). Reassign or delete tables first.`,
      });
    }

    await Branch.deleteOne({ _id: branch._id });
    return res.json({ success: true, message: 'Branch removed successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
