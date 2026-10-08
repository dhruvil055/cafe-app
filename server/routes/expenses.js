import express from 'express';
import Expense, { EXPENSE_CATEGORIES } from '../models/Expense.js';
import { protect, ownerOrManager } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = express.Router();

// GET /api/expenses — List categorized expenses
router.get('/', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { branchId, category, startDate, endDate, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (branchId) query.branchId = branchId;
    if (category && category !== 'ALL') query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (search) {
      query.description = { $regex: search.trim(), $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [expenses, totalCount, aggregateData] = await Promise.all([
      Expense.find(query)
        .populate('branchId', 'name code')
        .populate('createdBy', 'name email')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Expense.countDocuments(query),
      Expense.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalSpend: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const totalSpend = aggregateData.length > 0 ? aggregateData[0].totalSpend : 0;

    return res.json({
      success: true,
      expenses,
      totalCount,
      totalSpend: Number(totalSpend.toFixed(2)),
      categories: EXPENSE_CATEGORIES,
      page: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/expenses/summary — Category breakdown
router.get('/summary', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { branchId, days = 30 } = req.query;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - Number(days));

    const match = { date: { $gte: sinceDate } };
    if (branchId) match.branchId = branchId;

    const categoryBreakdown = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const totalPeriodSpend = categoryBreakdown.reduce((sum, c) => sum + c.totalAmount, 0);

    return res.json({
      success: true,
      categoryBreakdown,
      totalPeriodSpend: Number(totalPeriodSpend.toFixed(2)),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/expenses — Record new operating expense
router.post('/', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { category, amount, description, paymentMethod, date, branchId, receiptUrl } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid expense amount is required.' });
    }
    if (!category || !EXPENSE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}` });
    }

    const expense = await Expense.create({
      tenantId: req.tenantId,
      branchId: branchId || null,
      category,
      amount: numAmount,
      date: date ? new Date(date) : new Date(),
      description: String(description || '').trim(),
      paymentMethod: paymentMethod || 'cash',
      receiptUrl: String(receiptUrl || '').trim(),
      createdBy: req.user?._id || null,
    });

    await writeAuditLog({
      actor: req.user,
      action: 'expense.created',
      targetType: 'Expense',
      targetId: expense._id,
      details: { category, amount: numAmount },
    });

    return res.status(201).json({ success: true, expense });
  } catch (error) {
    next(error);
  }
});

// PUT /api/expenses/:id — Edit expense
router.put('/:id', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { category, amount, description, paymentMethod, date, branchId, receiptUrl } = req.body;
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (numAmount <= 0) return res.status(400).json({ error: 'Amount must be greater than 0.' });
      expense.amount = numAmount;
    }
    if (category) {
      if (!EXPENSE_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `Invalid category: ${category}` });
      }
      expense.category = category;
    }
    if (description !== undefined) expense.description = String(description).trim();
    if (paymentMethod) expense.paymentMethod = paymentMethod;
    if (date) expense.date = new Date(date);
    if (branchId !== undefined) expense.branchId = branchId || null;
    if (receiptUrl !== undefined) expense.receiptUrl = String(receiptUrl).trim();

    await expense.save();
    return res.json({ success: true, expense });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/expenses/:id — Delete expense
router.delete('/:id', protect, ownerOrManager, async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });

    await writeAuditLog({
      actor: req.user,
      action: 'expense.deleted',
      targetType: 'Expense',
      targetId: expense._id,
      details: { category: expense.category, amount: expense.amount },
    });

    return res.json({ success: true, message: 'Expense deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
