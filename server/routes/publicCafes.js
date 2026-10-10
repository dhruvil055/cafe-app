import express from 'express';
import mongoose from 'mongoose';
import Tenant from '../models/Tenant.js';
import Table from '../models/Table.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import { createTableQrToken, verifyTableQrTokenDetailed } from '../utils/tableQr.js';
import { generateOrderAccessToken, hashAccessToken } from '../utils/orderSecurity.js';
import { runWithTenant, runWithSystemTenantAccess } from '../utils/tenantContext.js';
import { sendApiSuccess, sendApiError } from '../utils/apiResponse.js';

const router = express.Router();

// Helper to resolve cafe by ID or slug
const resolveCafe = async (cafeIdOrSlug) => {
  if (!cafeIdOrSlug) return { error: 'INVALID_ID' };
  const trimmed = String(cafeIdOrSlug).trim();
  if (mongoose.isValidObjectId(trimmed)) {
    const cafe = await Tenant.findById(trimmed).lean();
    if (!cafe) return { error: 'NOT_FOUND' };
    return { cafe };
  }
  // Try slug lookup
  const cafe = await Tenant.findOne({ slug: trimmed.toLowerCase() }).lean();
  if (!cafe) return { error: 'INVALID_ID' };
  return { cafe };
};

// ── 1. Resolve Cafe From QR ──────────────────────────────────────────────────
// GET /api/public/cafes/resolve?token=<QR_TOKEN>
// OR  /api/public/cafes/resolve?cafeSlug=<CAFE_SLUG>&tableSlug=<TABLE_SLUG>
router.get('/cafes/resolve', async (req, res, next) => {
  try {
    const token = req.query.token || req.query.tableToken;
    if (token) {
      const result = verifyTableQrTokenDetailed(token);
      if (!result.valid) {
        if (result.reason === 'EXPIRED') {
          return sendApiError(res, 410, 'QR_EXPIRED', 'This QR code has expired or has been disabled.');
        }
        return sendApiError(res, 404, 'QR_NOT_FOUND', 'QR code was not found or is no longer valid.');
      }

      const cafe = await Tenant.findById(result.tenantId).lean();
      if (!cafe) {
        return sendApiError(res, 404, 'CAFE_NOT_FOUND', 'The cafe associated with this QR code was not found.');
      }
      if (cafe.status !== 'active') {
        return sendApiError(res, 410, 'QR_EXPIRED', 'This QR code has expired or has been disabled.');
      }

      const table = await runWithSystemTenantAccess(async () => {
        return Table.findById(result.tableId).lean();
      });

      if (!table) {
        return sendApiError(res, 404, 'QR_NOT_FOUND', 'QR code was not found or is no longer valid.');
      }
      if (!table.active) {
        return sendApiError(res, 410, 'QR_EXPIRED', 'This QR code has expired or has been disabled.');
      }
      if (String(table.tenantId) !== String(cafe._id)) {
        return sendApiError(res, 409, 'TABLE_CAFE_MISMATCH', 'The table does not belong to the specified cafe.');
      }

      return sendApiSuccess(res, 200, {
        cafe: {
          id: String(cafe._id),
          name: cafe.settings?.cafeName || cafe.name,
          slug: cafe.slug,
          logo: cafe.settings?.logoUrl || '',
          branding: {
            primaryColor: cafe.settings?.primaryColor || '#c96b18',
            secondaryColor: cafe.settings?.accentColor || '#1a0f08',
          },
        },
        table: {
          id: String(table._id),
          name: table.label || `Table ${table.tableNumber}`,
          number: table.tableNumber,
        },
        qr: {
          id: String(table._id),
          token,
        },
      });
    }

    // Alternative: cafeSlug and tableSlug
    const cafeSlug = String(req.query.cafeSlug || req.query.cafe || req.query.cafeId || '').trim();
    const tableSlug = String(req.query.tableSlug || req.query.table || req.query.tableId || '').trim();

    if (!cafeSlug || !tableSlug) {
      return sendApiError(res, 404, 'QR_NOT_FOUND', 'QR code was not found or is no longer valid.');
    }

    let cafe = null;
    if (mongoose.isValidObjectId(cafeSlug)) {
      cafe = await Tenant.findById(cafeSlug).lean();
    }
    if (!cafe) {
      cafe = await Tenant.findOne({ slug: cafeSlug.toLowerCase() }).lean();
    }
    if (!cafe) {
      return sendApiError(res, 404, 'CAFE_NOT_FOUND', 'The cafe associated with this QR code was not found.');
    }
    if (cafe.status !== 'active') {
      return sendApiError(res, 410, 'QR_EXPIRED', 'This QR code has expired or has been disabled.');
    }

    let tableNum = null;
    const numMatch = tableSlug.match(/\d+/);
    if (numMatch) {
      tableNum = Number(numMatch[0]);
    }

    let table = await runWithTenant(cafe._id, async () => {
      if (mongoose.isValidObjectId(tableSlug)) {
        const t = await Table.findById(tableSlug).lean();
        if (t) return t;
      }
      if (tableNum !== null) {
        const t = await Table.findOne({ tableNumber: tableNum }).lean();
        if (t) return t;
      }
      return Table.findOne({ label: tableSlug }).lean();
    });

    if (!table) {
      // Check if table exists under another cafe for mismatch reporting
      let foreignTable = await runWithSystemTenantAccess(async () => {
        if (mongoose.isValidObjectId(tableSlug)) return Table.findById(tableSlug).lean();
        if (tableNum !== null) return Table.findOne({ tableNumber: tableNum }).lean();
        return null;
      });
      if (foreignTable && String(foreignTable.tenantId) !== String(cafe._id)) {
        return sendApiError(res, 409, 'TABLE_CAFE_MISMATCH', 'The table does not belong to the specified cafe.');
      }
      return sendApiError(res, 404, 'QR_NOT_FOUND', 'QR code was not found or is no longer valid.');
    }

    if (!table.active) {
      return sendApiError(res, 410, 'QR_EXPIRED', 'This QR code has expired or has been disabled.');
    }

    const generatedToken = createTableQrToken(table._id, cafe._id);

    return sendApiSuccess(res, 200, {
      cafe: {
        id: String(cafe._id),
        name: cafe.settings?.cafeName || cafe.name,
        slug: cafe.slug,
        logo: cafe.settings?.logoUrl || '',
        branding: {
          primaryColor: cafe.settings?.primaryColor || '#c96b18',
          secondaryColor: cafe.settings?.accentColor || '#1a0f08',
        },
      },
      table: {
        id: String(table._id),
        name: table.label || `Table ${table.tableNumber}`,
        number: table.tableNumber,
      },
      qr: {
        id: String(table._id),
        token: generatedToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── 2. Get Public Cafe Details ───────────────────────────────────────────────
// GET /api/public/cafes/:cafeId
router.get('/cafes/:cafeId', async (req, res, next) => {
  try {
    const { cafe, error } = await resolveCafe(req.params.cafeId);
    if (error === 'INVALID_ID') {
      return sendApiError(res, 400, 'INVALID_CAFE_ID', 'The provided cafe ID is invalid.');
    }
    if (error === 'NOT_FOUND' || !cafe) {
      return sendApiError(res, 404, 'CAFE_NOT_FOUND', 'Cafe not found.');
    }

      return sendApiSuccess(res, 200, {
        id: String(cafe._id),
        name: cafe.settings?.cafeName || cafe.name,
        slug: cafe.slug,
        logo: cafe.settings?.logoUrl || '',
        logoUrl: cafe.settings?.logoUrl || '',
        description: cafe.settings?.tagline || `Welcome to ${cafe.settings?.cafeName || cafe.name}`,
        branding: {
          primaryColor: cafe.settings?.primaryColor || '#c96b18',
          secondaryColor: cafe.settings?.accentColor || '#1a0f08',
        },
        settings: {
          cafeName: cafe.settings?.cafeName || cafe.name,
          logoUrl: cafe.settings?.logoUrl || '',
          tagline: cafe.settings?.tagline || '',
          primaryColor: cafe.settings?.primaryColor || '#c96b18',
          accentColor: cafe.settings?.accentColor || '#1a0f08',
          currency: cafe.settings?.currency || 'INR',
          taxRate: Number(cafe.settings?.taxRate ?? 5),
          taxEnabled: Boolean((cafe.settings?.taxRate ?? 0) > 0),
          address: cafe.settings?.address || '',
          contactEmail: cafe.settings?.contactEmail || '',
          contactPhone: cafe.settings?.contactPhone || '',
          openingHours: cafe.settings?.openingHours || {},
        },
      });
  } catch (error) {
    next(error);
  }
});

// ── 3. Get Cafe Menu ─────────────────────────────────────────────────────────
// GET /api/public/cafes/:cafeId/menu
router.get('/cafes/:cafeId/menu', async (req, res, next) => {
  try {
    const { cafe, error } = await resolveCafe(req.params.cafeId);
    if (error === 'INVALID_ID') {
      return sendApiError(res, 400, 'INVALID_CAFE_ID', 'The provided cafe ID is invalid.');
    }
    if (error === 'NOT_FOUND' || !cafe) {
      return sendApiError(res, 404, 'CAFE_NOT_FOUND', 'Cafe not found.');
    }

    const productFilter = { available: true };
    if (req.query.veg === 'true' || req.query.vegOnly === 'true') {
      productFilter.isVeg = true;
    }
    if (req.query.category && mongoose.isValidObjectId(req.query.category)) {
      productFilter.category = req.query.category;
    }

    const [categories, products] = await runWithTenant(cafe._id, async () => {
      return Promise.all([
        Category.find({ active: { $ne: false } }).sort({ order: 1, name: 1 }).lean(),
        Product.find(productFilter).sort({ order: 1, name: 1 }).lean(),
      ]);
    });

    const categoryMap = new Map();
    for (const cat of categories) {
      categoryMap.set(String(cat._id), {
        id: String(cat._id),
        name: cat.name,
        items: [],
      });
    }

    const uncategorizedItems = [];
    for (const prod of products) {
      const catId = prod.category ? String(prod.category) : null;
      const item = {
        id: String(prod._id),
        name: prod.name,
        description: prod.description || '',
        price: prod.price,
        image: prod.image || '',
        available: prod.available !== false,
        isVeg: prod.isVeg !== false,
        variants: prod.variants || [],
        addons: prod.addons || [],
        popular: Boolean(prod.popular),
        prepTime: prod.prepTime,
        rating: prod.rating,
      };
      if (catId && categoryMap.has(catId)) {
        categoryMap.get(catId).items.push(item);
      } else {
        uncategorizedItems.push(item);
      }
    }

    const formattedCategories = Array.from(categoryMap.values());
    if (uncategorizedItems.length > 0) {
      formattedCategories.push({
        id: 'general',
        name: 'General',
        items: uncategorizedItems,
      });
    }

    return sendApiSuccess(res, 200, {
      cafeId: String(cafe._id),
      categories: formattedCategories,
    });
  } catch (error) {
    next(error);
  }
});

// ── 4. Get Cafe Tables ───────────────────────────────────────────────────────
// GET /api/public/cafes/:cafeId/tables/:tableId
router.get('/cafes/:cafeId/tables/:tableId', async (req, res, next) => {
  try {
    const { cafe, error } = await resolveCafe(req.params.cafeId);
    if (error === 'INVALID_ID') {
      return sendApiError(res, 400, 'INVALID_CAFE_ID', 'The provided cafe ID is invalid.');
    }
    if (error === 'NOT_FOUND' || !cafe) {
      return sendApiError(res, 404, 'CAFE_NOT_FOUND', 'Cafe not found.');
    }

    const { tableId } = req.params;
    let table = await runWithSystemTenantAccess(async () => {
      if (mongoose.isValidObjectId(tableId)) {
        return Table.findById(tableId).lean();
      }
      const num = Number(tableId);
      if (Number.isInteger(num)) {
        const t = await Table.findOne({ tableNumber: num, tenantId: cafe._id }).lean();
        if (t) return t;
        return Table.findOne({ tableNumber: num }).lean();
      }
      return null;
    });

    if (!table) {
      return sendApiError(res, 404, 'TABLE_NOT_FOUND', 'Table not found.');
    }

    if (String(table.tenantId) !== String(cafe._id)) {
      return sendApiError(res, 403, 'TABLE_ACCESS_DENIED', 'This table does not belong to this cafe.');
    }

    return sendApiSuccess(res, 200, {
      id: String(table._id),
      cafeId: String(cafe._id),
      name: table.label || `Table ${table.tableNumber}`,
      number: table.tableNumber,
      status: table.active ? 'available' : 'occupied',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/public/cafes/:cafeId/tables
router.get('/cafes/:cafeId/tables', async (req, res, next) => {
  try {
    const { cafe, error } = await resolveCafe(req.params.cafeId);
    if (error === 'INVALID_ID') {
      return sendApiError(res, 400, 'INVALID_CAFE_ID', 'The provided cafe ID is invalid.');
    }
    if (error === 'NOT_FOUND' || !cafe) {
      return sendApiError(res, 404, 'CAFE_NOT_FOUND', 'Cafe not found.');
    }

    const tables = await runWithTenant(cafe._id, async () => {
      return Table.find({ active: true }).sort({ tableNumber: 1 }).lean();
    });

    return sendApiSuccess(res, 200, {
      cafeId: String(cafe._id),
      tables: tables.map((t) => ({
        id: String(t._id),
        cafeId: String(cafe._id),
        name: t.label || `Table ${t.tableNumber}`,
        number: t.tableNumber,
        status: t.active ? 'available' : 'occupied',
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ── 5 & 6. Create Customer Order ─────────────────────────────────────────────
// POST /api/public/orders
router.post('/orders', async (req, res, next) => {
  try {
    const cafeIdHeader =
      req.headers['x-cafe-id'] ||
      req.headers['x-cafe-id'.toLowerCase()] ||
      req.headers['x-tenant-id'] ||
      req.body.cafeId ||
      req.query.cafeId;

    const qrTokenHeader =
      req.headers['x-qr-token'] ||
      req.headers['x-qr-token'.toLowerCase()] ||
      req.headers['x-table-token'] ||
      req.body.qrToken ||
      req.body.tableToken;

    if (!cafeIdHeader && !qrTokenHeader) {
      return sendApiError(res, 400, 'CAFE_CONTEXT_REQUIRED', 'A cafe context is required.');
    }

    // Resolve Cafe
    let cafe = null;
    if (cafeIdHeader) {
      const resolved = await resolveCafe(cafeIdHeader);
      if (resolved.cafe) cafe = resolved.cafe;
    }

    // Validate QR Token if provided
    if (qrTokenHeader) {
      const qrResult = verifyTableQrTokenDetailed(qrTokenHeader);
      if (!qrResult.valid) {
        if (qrResult.reason === 'EXPIRED') {
          return sendApiError(res, 410, 'QR_EXPIRED', 'This QR code has expired or has been disabled.');
        }
        return sendApiError(res, 404, 'QR_NOT_FOUND', 'QR code was not found or is no longer valid.');
      }
      if (!cafe) {
        cafe = await Tenant.findById(qrResult.tenantId).lean();
      } else if (String(qrResult.tenantId) !== String(cafe._id)) {
        return sendApiError(res, 409, 'TABLE_CAFE_MISMATCH', 'The selected table does not belong to this cafe.');
      }
    }

    if (!cafe) {
      return sendApiError(res, 404, 'CAFE_NOT_FOUND', 'The cafe was not found.');
    }

    // Validate Table
    const { tableId, items, customer, paymentMethod } = req.body;
    if (!tableId) {
      return sendApiError(res, 400, 'VALIDATION_ERROR', 'Table ID is required.', {
        field: 'tableId',
        reason: 'Table ID is required.',
      });
    }

    let table = await runWithSystemTenantAccess(async () => {
      if (mongoose.isValidObjectId(tableId)) {
        return Table.findById(tableId).lean();
      }
      const num = Number(tableId);
      if (Number.isInteger(num)) {
        const t = await Table.findOne({ tableNumber: num, tenantId: cafe._id }).lean();
        if (t) return t;
        return Table.findOne({ tableNumber: num }).lean();
      }
      return null;
    });

    if (!table) {
      return sendApiError(res, 404, 'TABLE_NOT_FOUND', 'Table not found.');
    }

    if (String(table.tenantId) !== String(cafe._id)) {
      return sendApiError(res, 409, 'TABLE_CAFE_MISMATCH', 'The selected table does not belong to this cafe.');
    }

    // Validate Items
    if (!Array.isArray(items) || items.length === 0) {
      return sendApiError(res, 400, 'VALIDATION_ERROR', 'At least one item is required.', {
        field: 'items',
        reason: 'Order must contain items.',
      });
    }

    const requestedProductIds = items.map((item) => String(item.productId));
    const productsFound = await runWithSystemTenantAccess(async () => {
      return Product.find({ _id: { $in: requestedProductIds } }).lean();
    });

    const invalidProductIds = [];
    const validProductsMap = new Map();

    for (const pid of requestedProductIds) {
      const prod = productsFound.find((p) => String(p._id) === pid);
      if (!prod || String(prod.tenantId) !== String(cafe._id)) {
        invalidProductIds.push(pid);
      } else {
        validProductsMap.set(pid, prod);
      }
    }

    if (invalidProductIds.length > 0) {
      return sendApiError(
        res,
        409,
        'PRODUCT_CAFE_MISMATCH',
        'One or more products do not belong to this cafe.',
        { invalidProductIds }
      );
    }

    // Calculate totals securely
    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const prod = validProductsMap.get(String(item.productId));
      const qty = Number(item.quantity) || 1;
      const price = prod.price;
      const itemTotal = price * qty;
      subtotal += itemTotal;
      orderItems.push({
        productId: prod._id,
        name: prod.name,
        price,
        quantity: qty,
        itemTotal,
      });
    }

    const taxRate = cafe.settings?.taxRate ?? 5;
    const tax = Number(((subtotal * taxRate) / 100).toFixed(2));
    const total = Math.round((subtotal + tax) * 100) / 100;

    let createdOrder = null;
    await runWithTenant(cafe._id, async () => {
      const token = generateOrderAccessToken();
      const orderDoc = new Order({
        tenantId: cafe._id,
        tableNumber: table.tableNumber,
        customer: {
          name: String(customer?.name || 'Customer').trim(),
          phone: String(customer?.phone || '').trim(),
        },
        items: orderItems,
        subtotal,
        tax,
        total,
        paymentMethod: paymentMethod === 'ONLINE' || paymentMethod === 'razorpay' ? 'razorpay' : 'cash',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        accessTokenHash: hashAccessToken(token),
      });
      await orderDoc.save();
      createdOrder = orderDoc;
    });

    return sendApiSuccess(res, 201, {
      order: {
        id: String(createdOrder._id),
        orderNumber: createdOrder.orderNumber,
        cafeId: String(cafe._id),
        tableId: String(table._id),
        status: 'PENDING',
        paymentStatus: 'PENDING',
        total: createdOrder.total,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
