import express from 'express';
import Supplier from '../models/Supplier.js';
import { protect, ownerOrManager } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = express.Router();

// GET /api/suppliers — List suppliers
router.get('/', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { search, active } = req.query;
    const query = {};

    if (active !== undefined) {
      query.active = active === 'true';
    }
    if (search) {
      const regex = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ name: regex }, { contactPerson: regex }, { phone: regex }, { email: regex }];
    }

    const suppliers = await Supplier.find(query).sort({ name: 1 }).lean();
    return res.json({ success: true, suppliers, count: suppliers.length });
  } catch (error) {
    next(error);
  }
});

// POST /api/suppliers — Create new vendor/supplier
router.post('/', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { name, contactPerson, phone, email, address, gstin, paymentTerms, categories, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier name is required.' });
    }

    const supplier = await Supplier.create({
      tenantId: req.tenantId,
      name: name.trim(),
      contactPerson: String(contactPerson || '').trim(),
      phone: String(phone || '').trim(),
      email: String(email || '').trim().toLowerCase(),
      address: String(address || '').trim(),
      gstin: String(gstin || '').trim().toUpperCase(),
      paymentTerms: String(paymentTerms || 'net_30').trim(),
      categories: Array.isArray(categories) ? categories : [],
      notes: String(notes || '').trim(),
      active: true,
    });

    await writeAuditLog({
      actor: req.user,
      action: 'supplier.created',
      targetType: 'Supplier',
      targetId: supplier._id,
      details: { name: supplier.name },
    });

    return res.status(201).json({ success: true, supplier });
  } catch (error) {
    next(error);
  }
});

// PUT /api/suppliers/:id — Update supplier
router.put('/:id', protect, ownerOrManager, async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

    const fields = ['name', 'contactPerson', 'phone', 'email', 'address', 'gstin', 'paymentTerms', 'categories', 'notes', 'active'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f === 'email') supplier.email = String(req.body.email).trim().toLowerCase();
        else if (f === 'gstin') supplier.gstin = String(req.body.gstin).trim().toUpperCase();
        else supplier[f] = req.body[f];
      }
    }

    await supplier.save();
    return res.json({ success: true, supplier });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/suppliers/:id — Delete supplier
router.delete('/:id', protect, ownerOrManager, async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

    await writeAuditLog({
      actor: req.user,
      action: 'supplier.deleted',
      targetType: 'Supplier',
      targetId: supplier._id,
      details: { name: supplier.name },
    });

    return res.json({ success: true, message: 'Supplier removed.' });
  } catch (error) {
    next(error);
  }
});

export default router;
