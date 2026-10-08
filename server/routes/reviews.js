import express from 'express';
import Review from '../models/Review.js';
import Order from '../models/Order.js';
import { protect, ownerOrManager } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditLog.js';

const router = express.Router();

// GET /api/reviews — List reviews & rating breakdown
router.get('/', async (req, res, next) => {
  try {
    const { status = 'published', minRating, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status && status !== 'ALL') query.status = status;
    if (minRating) query.overallRating = { $gte: Number(minRating) };

    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, totalCount, statsData] = await Promise.all([
      Review.find(query)
        .populate('reply.repliedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Review.countDocuments(query),
      Review.aggregate([
        { $match: { status: 'published' } },
        {
          $group: {
            _id: null,
            avgOverall: { $avg: '$overallRating' },
            avgFood: { $avg: '$foodRating' },
            avgService: { $avg: '$serviceRating' },
            avgAmbience: { $avg: '$ambienceRating' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats = statsData.length > 0 ? {
      overall: Number((statsData[0].avgOverall || 5).toFixed(1)),
      food: Number((statsData[0].avgFood || 5).toFixed(1)),
      service: Number((statsData[0].avgService || 5).toFixed(1)),
      ambience: Number((statsData[0].avgAmbience || 5).toFixed(1)),
      totalReviews: statsData[0].count,
    } : {
      overall: 5.0,
      food: 5.0,
      service: 5.0,
      ambience: 5.0,
      totalReviews: 0,
    };

    return res.json({
      success: true,
      reviews,
      stats,
      totalCount,
      page: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/reviews — Submit customer feedback
router.post('/', async (req, res, next) => {
  try {
    const { orderId, foodRating, serviceRating, ambienceRating, comment, customerName, customerPhone } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required to submit a review.' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const fRate = Number(foodRating);
    const sRate = Number(serviceRating);
    const aRate = Number(ambienceRating);

    if (!fRate || fRate < 1 || fRate > 5 || !sRate || sRate < 1 || sRate > 5 || !aRate || aRate < 1 || aRate > 5) {
      return res.status(400).json({ error: 'Ratings for food, service, and ambience must each be between 1 and 5.' });
    }

    // Check if review already exists for this order
    const existing = await Review.findOne({ orderId });
    if (existing) {
      return res.status(400).json({ error: 'A review has already been submitted for this order.' });
    }

    const overall = Math.round(((fRate + sRate + aRate) / 3) * 10) / 10;
    const review = await Review.create({
      tenantId: req.tenantId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerName: customerName || order.customer?.name || 'Customer',
      customerPhone: customerPhone || order.customer?.phone || '',
      foodRating: fRate,
      serviceRating: sRate,
      ambienceRating: aRate,
      overallRating: overall,
      comment: String(comment || '').trim().slice(0, 1000),
      status: 'published',
    });

    return res.status(201).json({ success: true, review });
  } catch (error) {
    next(error);
  }
});

// POST /api/reviews/:id/reply — Management reply to review
router.post('/:id/reply', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Reply text cannot be empty.' });
    }

    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found.' });

    review.reply = {
      text: text.trim().slice(0, 1000),
      repliedAt: new Date(),
      repliedBy: req.user?._id || null,
    };

    await review.save();

    await writeAuditLog({
      actor: req.user,
      action: 'review.replied',
      targetType: 'Review',
      targetId: review._id,
      details: { orderNumber: review.orderNumber },
    });

    return res.json({ success: true, review });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/reviews/:id/status — Moderate review visibility
router.patch('/:id/status', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['published', 'hidden', 'flagged'].includes(status)) {
      return res.status(400).json({ error: 'Status must be published, hidden, or flagged.' });
    }

    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found.' });

    review.status = status;
    await review.save();

    return res.json({ success: true, review });
  } catch (error) {
    next(error);
  }
});

export default router;
