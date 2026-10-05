import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import AuditEvent from '../models/AuditEvent.js';
import { authorizeRoles, protect } from '../middleware/auth.js';
import { checkStaffUserLimit } from '../middleware/planLimits.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = express.Router();
const ownerOnly = [protect, authorizeRoles('owner')];
const VALID_ROLES = ['owner', 'manager', 'cashier', 'kitchen'];
const publicUser = (user) => ({ _id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });

router.get('/', ...ownerOnly, async (req, res) => {
  const users = await User.find({ role: { $in: VALID_ROLES.concat(['admin', 'staff']) } }).sort({ createdAt: 1 }).select('name email role createdAt').lean();
  return res.json({ users });
});

router.post('/', ...ownerOnly, checkStaffUserLimit, async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!String(name || '').trim() || !String(email || '').trim() || typeof password !== 'string' || password.length < 8 || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Name, email, a password of at least 8 characters, and a valid staff role are required.' });
  }
  try {
    const user = await User.create({ name: String(name).trim().slice(0, 100), email: String(email).trim().toLowerCase(), password, role });
    await writeAuditLog({ actor: req.user, action: 'user.role_assigned', targetType: 'User', targetId: user._id, details: { role } });
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 400).json({ error: error.code === 11000 ? 'An account with this email already exists.' : error.message });
  }
});

router.put('/:id/role', ...ownerOnly, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid user ID.' });
  const { role } = req.body || {};
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Role must be owner, manager, cashier, or kitchen.' });
  const user = await User.findById(req.params.id);
  if (!user || user.role === 'customer') return res.status(404).json({ error: 'Staff account not found.' });
  const previousRole = ({ admin: 'owner', staff: 'manager' }[user.role] || user.role);
  if (user._id.equals(req.user._id) && role !== previousRole) return res.status(409).json({ error: 'You cannot change your own role.' });
  if (previousRole === 'owner' && role !== 'owner') {
    const ownerCount = await User.countDocuments({ role: { $in: ['owner', 'admin'] } });
    if (ownerCount <= 1) return res.status(409).json({ error: 'The last owner cannot be removed.' });
  }
  user.role = role;
  await user.save();
  await writeAuditLog({ actor: req.user, action: 'user.role_changed', targetType: 'User', targetId: user._id, details: { from: previousRole, to: role } });
  return res.json({ user: publicUser(user) });
});

router.get('/audit', ...ownerOnly, async (req, res) => {
  try {
    const { page = '1', limit = '50', action, actorEmail, targetType, startDate, endDate } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

    const query = {};
    if (action) query.action = { $regex: action, $options: 'i' };
    if (actorEmail) query.actorEmail = { $regex: actorEmail, $options: 'i' };
    if (targetType) query.targetType = targetType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [events, total] = await Promise.all([
      AuditEvent.find(query).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      AuditEvent.countDocuments(query),
    ]);

    return res.json({ events, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch audit events.' });
  }
});

export default router;
