import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import Order from '../models/Order.js';
import Table from '../models/Table.js';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import { createTableQrToken } from '../utils/tableQr.js';
import { runWithTenant, runWithSystemTenantAccess } from '../utils/tenantContext.js';
import { sendApiSuccess, sendApiError } from '../utils/apiResponse.js';

const router = express.Router();

// Middleware to authenticate admin and resolve cafe context
const requireAdminCafeAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    req.cookies?.brewhaus_access_token;

  if (!token) {
    return sendApiError(res, 401, 'UNAUTHENTICATED', 'Authentication is required.');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || '');
  } catch {
    return sendApiError(res, 401, 'INVALID_TOKEN', 'Authentication token is invalid or expired.');
  }

  const userId = decoded.userId || decoded.id;
  const userTenantId = decoded.tenantId;

  if (!userTenantId) {
    return sendApiError(res, 400, 'CAFE_CONTEXT_REQUIRED', 'A cafe context is required.');
  }

  // Verify user in system context
  const user = await runWithSystemTenantAccess(async () => {
    return User.findById(userId).lean();
  });

  if (!user) {
    return sendApiError(res, 401, 'UNAUTHENTICATED', 'Authentication is required.');
  }

  // Verify cafe context if provided in header or route param
  const requestedCafeId = req.params?.cafeId || req.headers['x-cafe-id'] || req.headers['x-tenant-id'];
  if (requestedCafeId) {
    if (String(requestedCafeId) !== String(user.tenantId)) {
      return sendApiError(res, 403, 'CAFE_ACCESS_DENIED', 'You do not have access to this cafe.');
    }
  }

  req.adminUser = user;
  req.cafeId = user.tenantId;
  next();
};

// ── 9. Admin Orders ──────────────────────────────────────────────────────────
// GET /api/admin/orders
router.get('/orders', requireAdminCafeAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const queryFilter = { tenantId: req.cafeId };
    if (req.query.status) {
      const statusParam = String(req.query.status).toLowerCase();
      queryFilter.orderStatus = statusParam;
    }

    const [orders, total] = await runWithTenant(req.cafeId, async () => {
      return Promise.all([
        Order.find(queryFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Order.countDocuments(queryFilter),
      ]);
    });

    const totalPages = Math.ceil(total / limit) || 0;

    return sendApiSuccess(res, 200, {
      orders: orders.map((o) => ({
        id: String(o._id),
        orderNumber: o.orderNumber,
        cafeId: String(o.tenantId),
        tableNumber: o.tableNumber,
        status: (o.orderStatus || 'pending').toUpperCase(),
        paymentStatus: (o.paymentStatus || 'pending').toUpperCase(),
        total: o.total,
        customer: o.customer,
        items: o.items,
        createdAt: o.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── 11. QR Generation ────────────────────────────────────────────────────────
// POST /api/admin/cafes/:cafeId/tables/:tableId/qr
router.post('/cafes/:cafeId/tables/:tableId/qr', requireAdminCafeAuth, async (req, res, next) => {
  try {
    const { cafeId, tableId } = req.params;

    if (String(cafeId) !== String(req.cafeId)) {
      return sendApiError(res, 403, 'CAFE_ACCESS_DENIED', 'You do not have access to this cafe.');
    }

    let table = await runWithTenant(cafeId, async () => {
      if (mongoose.isValidObjectId(tableId)) {
        return Table.findById(tableId);
      }
      const num = Number(tableId);
      if (Number.isInteger(num)) {
        return Table.findOne({ tableNumber: num });
      }
      return null;
    });

    if (!table) {
      let foreignTable = await runWithSystemTenantAccess(async () => {
        if (mongoose.isValidObjectId(tableId)) return Table.findById(tableId);
        const num = Number(tableId);
        if (Number.isInteger(num)) return Table.findOne({ tableNumber: num });
        return null;
      });
      if (foreignTable && String(foreignTable.tenantId) !== String(cafeId)) {
        return sendApiError(res, 409, 'TABLE_CAFE_MISMATCH', 'The table does not belong to the specified cafe.');
      }
      return sendApiError(res, 404, 'TABLE_NOT_FOUND', 'Table not found.');
    }

    const token = createTableQrToken(table._id, cafeId);
    const clientUrl =
      process.env.CUSTOMER_APP_URL || process.env.CLIENT_URL || 'https://cafe.infinigrowsoftech.com';
    const qrUrl = `${clientUrl.replace(/\/$/, '')}/menu?token=${encodeURIComponent(token)}`;

    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1a0f08', light: '#FFFFFF' },
      errorCorrectionLevel: 'H',
    });

    await runWithTenant(cafeId, async () => {
      table.qrCode = qrDataUrl;
      table.qrUrl = qrUrl;
      await table.save();
    });

    return sendApiSuccess(res, 201, {
      qr: {
        id: String(table._id),
        cafeId: String(cafeId),
        tableId: String(table._id),
        token,
        url: qrUrl,
        status: 'ACTIVE',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
