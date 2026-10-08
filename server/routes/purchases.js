import express from 'express';
import Purchase from '../models/Purchase.js';
import InventoryItem from '../models/InventoryItem.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import Supplier from '../models/Supplier.js';
import { protect, ownerOrManager } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = express.Router();

// GET /api/purchases — List purchase orders
router.get('/', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { supplierId, status, paidStatus, branchId, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (supplierId) query.supplier = supplierId;
    if (status && status !== 'ALL') query.status = status;
    if (paidStatus && paidStatus !== 'ALL') query.paidStatus = paidStatus;
    if (branchId) query.branchId = branchId;
    if (search) {
      const regex = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ poNumber: regex }, { invoiceNumber: regex }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [purchases, totalCount] = await Promise.all([
      Purchase.find(query)
        .populate('supplier', 'name contactPerson phone gstin')
        .populate('branchId', 'name code')
        .populate('receivedBy', 'name email')
        .populate('items.inventoryItem', 'name unit currentQuantity')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Purchase.countDocuments(query),
    ]);

    return res.json({
      success: true,
      purchases,
      totalCount,
      page: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/purchases — Create new Purchase Order
router.post('/', protect, ownerOrManager, async (req, res, next) => {
  try {
    const {
      supplierId,
      branchId,
      invoiceNumber,
      invoiceDate,
      items = [],
      paymentMethod = 'bank_transfer',
      paidStatus = 'unpaid',
      notes = '',
    } = req.body;

    if (!supplierId) {
      return res.status(400).json({ error: 'Supplier is required.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required in the purchase order.' });
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

    // Validate and build line items
    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    const validatedItems = [];

    for (const item of items) {
      const invItem = await InventoryItem.findById(item.inventoryItemId || item.inventoryItem);
      if (!invItem) {
        return res.status(400).json({ error: `Inventory item ${item.inventoryItemId || item.name} not found.` });
      }

      const qty = Number(item.quantity);
      const unitCost = Number(item.unitCost);
      const taxPercent = Number(item.taxPercent || 0);

      if (qty <= 0 || unitCost < 0) {
        return res.status(400).json({ error: `Invalid quantity or cost for item ${invItem.name}.` });
      }

      const itemBase = Number((qty * unitCost).toFixed(2));
      const itemTax = Number(((itemBase * taxPercent) / 100).toFixed(2));
      const itemTotal = Number((itemBase + itemTax).toFixed(2));

      calculatedSubtotal += itemBase;
      calculatedTax += itemTax;

      validatedItems.push({
        inventoryItem: invItem._id,
        name: invItem.name,
        quantity: qty,
        unit: invItem.unit || 'unit',
        unitCost,
        taxPercent,
        total: itemTotal,
      });
    }

    const calculatedTotal = Number((calculatedSubtotal + calculatedTax).toFixed(2));
    const poNumber = `PO-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    const purchase = await Purchase.create({
      tenantId: req.tenantId,
      branchId: branchId || null,
      supplier: supplier._id,
      poNumber,
      invoiceNumber: String(invoiceNumber || '').trim(),
      invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
      items: validatedItems,
      subtotal: calculatedSubtotal,
      tax: calculatedTax,
      total: calculatedTotal,
      status: 'draft',
      paidStatus,
      paymentMethod,
      notes: String(notes || '').trim(),
    });

    await writeAuditLog({
      actor: req.user,
      action: 'purchase.created',
      targetType: 'Purchase',
      targetId: purchase._id,
      details: { poNumber, supplier: supplier.name, total: calculatedTotal },
    });

    return res.status(201).json({ success: true, purchase });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/purchases/:id/status — Transition PO status & auto-replenish stock on receive
router.patch('/:id/status', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['draft', 'ordered', 'received', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Purchase order not found.' });

    // Handle stock replenishment if transitioning to 'received' for the first time
    if (status === 'received' && purchase.status !== 'received') {
      for (const lineItem of purchase.items) {
        const invItem = await InventoryItem.findById(lineItem.inventoryItem);
        if (invItem) {
          const balanceBefore = invItem.currentQuantity || 0;
          const balanceAfter = Number((balanceBefore + lineItem.quantity).toFixed(3));

          invItem.currentQuantity = balanceAfter;
          if (lineItem.unitCost > 0) {
            invItem.costPerUnit = lineItem.unitCost;
          }
          await invItem.save();

          await InventoryTransaction.create({
            tenantId: req.tenantId,
            inventoryItem: invItem._id,
            type: 'purchase',
            quantity: lineItem.quantity,
            balanceBefore,
            balanceAfter,
            reference: purchase.poNumber,
            reason: `Stock received via PO ${purchase.poNumber}`,
            performedBy: req.user?._id || null,
          });
        }
      }

      purchase.receivedAt = new Date();
      purchase.receivedBy = req.user?._id || null;
    }

    purchase.status = status;
    await purchase.save();

    await writeAuditLog({
      actor: req.user,
      action: 'purchase.status_updated',
      targetType: 'Purchase',
      targetId: purchase._id,
      details: { poNumber: purchase.poNumber, newStatus: status },
    });

    return res.json({ success: true, purchase });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/purchases/:id — Remove draft purchase order
router.delete('/:id', protect, ownerOrManager, async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Purchase order not found.' });

    if (purchase.status === 'received') {
      return res.status(400).json({ error: 'Cannot delete an already received purchase order.' });
    }

    await Purchase.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Purchase order removed.' });
  } catch (error) {
    next(error);
  }
});

export default router;
