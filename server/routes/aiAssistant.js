import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import InventoryItem from '../models/InventoryItem.js';
import Expense from '../models/Expense.js';
import Review from '../models/Review.js';
import { protect, ownerOrManager } from '../middleware/auth.js';

const router = express.Router();

// Helper to gather tenant-isolated live business context
async function gatherTenantBusinessContext(tenantId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    recentSalesAgg,
    topItemsAgg,
    lowStockItems,
    expensesAgg,
    reviewsAgg,
  ] = await Promise.all([
    // 30-day sales
    Order.aggregate([
      { $match: { orderStatus: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$total' },
        },
      },
    ]),

    // Top selling items (7 days)
    Order.aggregate([
      { $match: { orderStatus: 'completed', createdAt: { $gte: sevenDaysAgo } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.itemTotal' },
        },
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 5 },
    ]),

    // Inventory items low or out of stock
    InventoryItem.find({
      active: true,
      $expr: { $lte: ['$currentQuantity', '$minimumStock'] },
    }).select('name currentQuantity unit minimumStock').limit(10).lean(),

    // 30-day expenses by category
    Expense.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]),

    // Customer satisfaction summary
    Review.aggregate([
      {
        $group: {
          _id: null,
          avgOverall: { $avg: '$overallRating' },
          avgFood: { $avg: '$foodRating' },
          avgService: { $avg: '$serviceRating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]),
  ]);

  const sales = recentSalesAgg[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };
  const totalExpense = expensesAgg.reduce((sum, e) => sum + e.total, 0);
  const reviews = reviewsAgg[0] || { avgOverall: 5, avgFood: 5, avgService: 5, totalReviews: 0 };

  return {
    period: 'Last 30 Days',
    revenue: Number((sales.totalRevenue || 0).toFixed(2)),
    ordersCount: sales.totalOrders || 0,
    averageTicket: Number((sales.avgOrderValue || 0).toFixed(2)),
    topSellingItems: topItemsAgg.map(i => ({ name: i._id, qty: i.quantitySold, sales: Number(i.revenue.toFixed(2)) })),
    lowStockItems: lowStockItems.map(i => ({ name: i.name, inStock: i.currentQuantity, minNeeded: i.minimumStock, unit: i.unit })),
    totalExpenses: Number(totalExpense.toFixed(2)),
    netEstimatedProfit: Number(((sales.totalRevenue || 0) - totalExpense).toFixed(2)),
    expenseBreakdown: expensesAgg.map(e => ({ category: e._id, amount: Number(e.total.toFixed(2)) })),
    customerRating: {
      overall: Number((reviews.avgOverall || 5).toFixed(1)),
      food: Number((reviews.avgFood || 5).toFixed(1)),
      service: Number((reviews.avgService || 5).toFixed(1)),
      count: reviews.totalReviews || 0,
    },
  };
}

// POST /api/ai/ask — Ask operational questions to the AI business advisor
router.post('/ask', protect, ownerOrManager, async (req, res, next) => {
  try {
    const { question = '' } = req.body;
    const cleanQuestion = String(question || '').trim();

    if (!cleanQuestion) {
      return res.status(400).json({ error: 'Question prompt is required.' });
    }

    const businessData = await gatherTenantBusinessContext(req.tenantId);
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;

    if (geminiKey) {
      try {
        const systemPrompt = `You are InfiniGrow Café AI, a senior restaurant and café profitability consultant.
Ground your response strictly in the provided real-time café metrics. Give practical, high-impact recommendations with bullet points and clear numbers. Keep the response under 200 words.

Live Café Metrics:
- 30-Day Revenue: ₹${businessData.revenue} across ${businessData.ordersCount} orders (Average ticket: ₹${businessData.averageTicket})
- 30-Day Expenses: ₹${businessData.totalExpenses} (Net Estimated Profit: ₹${businessData.netEstimatedProfit})
- Top Selling Items (Past 7 Days): ${businessData.topSellingItems.map(i => `${i.name} (${i.qty} sold)`).join(', ') || 'No orders yet'}
- Low Stock Alerts: ${businessData.lowStockItems.map(i => `${i.name}: ${i.inStock} ${i.unit} left (min: ${i.minNeeded})`).join(', ') || 'Stock levels healthy'}
- Customer Rating: ${businessData.customerRating.overall}★ (${businessData.customerRating.count} reviews)
- Expense Categories: ${businessData.expenseBreakdown.map(e => `${e.category}: ₹${e.amount}`).join(', ') || 'No expenses logged'}
`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `${systemPrompt}\n\nOwner's Question: "${cleanQuestion}"` },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 500,
            },
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const aiAnswer = result?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiAnswer) {
            return res.json({
              success: true,
              answer: aiAnswer,
              data: businessData,
              engine: 'gemini-flash',
            });
          }
        }
      } catch (geminiError) {
        console.warn('[AI Assistant] Gemini API call error:', geminiError.message);
      }
    }

    // Deterministic intelligence engine fallback (100% grounded in aggregated data)
    let synthesizedAnswer = '';
    const qLower = cleanQuestion.toLowerCase();

    if (qLower.includes('stock') || qLower.includes('inventory') || qLower.includes('item')) {
      if (businessData.lowStockItems.length > 0) {
        synthesizedAnswer = `⚠️ **Urgent Stock Alerts**:\nYou have ${businessData.lowStockItems.length} item(s) currently at or below minimum threshold:\n` +
          businessData.lowStockItems.map(i => `• **${i.name}**: ${i.inStock} ${i.unit} remaining (minimum buffer is ${i.minNeeded}).`).join('\n') +
          `\n\n💡 **Recommendation**: Create a Purchase Order in the Purchases section immediately to prevent kitchen stock-outs during peak dining hours.`;
      } else {
        synthesizedAnswer = `✅ **Inventory Health**: All raw ingredients and materials are currently above their minimum safety buffer. No immediate purchase orders required!`;
      }
    } else if (qLower.includes('profit') || qLower.includes('revenue') || qLower.includes('sales') || qLower.includes('expense')) {
      synthesizedAnswer = `📊 **Financial Health Overview (30 Days)**:\n` +
        `• **Gross Sales Revenue**: ₹${businessData.revenue.toLocaleString()} (${businessData.ordersCount} orders)\n` +
        `• **Operating Expenses**: ₹${businessData.totalExpenses.toLocaleString()}\n` +
        `• **Net Operating Margin**: ₹${businessData.netEstimatedProfit.toLocaleString()} (${businessData.revenue > 0 ? Math.round((businessData.netEstimatedProfit / businessData.revenue) * 100) : 0}% margin)\n` +
        `• **Average Order Value**: ₹${businessData.averageTicket}\n\n` +
        `💡 **Top Action**: Boost your average ticket by setting up pairing combos (e.g. coffee + bakery item) on your POS and QR menus.`;
    } else if (qLower.includes('top') || qLower.includes('bestseller') || qLower.includes('popular')) {
      synthesizedAnswer = `🔥 **Top Selling Items This Week**:\n` +
        businessData.topSellingItems.map((item, idx) => `${idx + 1}. **${item.name}** — ${item.qty} units sold (₹${item.sales.toLocaleString()} revenue)`).join('\n') +
        `\n\n💡 **Recommendation**: Feature these high-velocity items at the very top of your digital QR menu to speed up customer ordering.`;
    } else {
      synthesizedAnswer = `💡 **Café Executive Summary**:\n` +
        `• **Monthly Revenue**: ₹${businessData.revenue.toLocaleString()} across ${businessData.ordersCount} orders.\n` +
        `• **Star Rating**: ${businessData.customerRating.overall}★ (${businessData.customerRating.count} reviews).\n` +
        `• **Top Bestseller**: ${businessData.topSellingItems[0] ? businessData.topSellingItems[0].name : 'No items yet'}.\n` +
        `• **Stock Status**: ${businessData.lowStockItems.length > 0 ? `${businessData.lowStockItems.length} items need replenishment` : 'All ingredients adequately stocked'}.\n\n` +
        `You can ask me specific questions like: *"Which items are low in stock?"*, *"What are my top selling products?"*, or *"Show my net profit margin"*.`;
    }

    return res.json({
      success: true,
      answer: synthesizedAnswer,
      data: businessData,
      engine: 'business-intelligence',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
