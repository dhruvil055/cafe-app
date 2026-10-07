import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';
import { connectDB } from './config/db.js';

// Routes
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import categoryRoutes from './routes/categories.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payment.js';
import tableRoutes from './routes/tables.js';
import uploadRoutes from './routes/upload.js';
import galleryRoutes from './routes/gallery.js';
import sessionRoutes from './routes/session.js';
import contactRoutes from './routes/contact.js';
import analyticsRoutes from './routes/analytics.js';
import inventoryRoutes from './routes/inventory.js';
import customerRoutes from './routes/customers.js';
import marketingRoutes from './routes/marketing.js';
import notificationRoutes from './routes/notifications.js';
import pushRoutes from './routes/push.js';
import userRoutes from './routes/users.js';
import couponRoutes from './routes/coupons.js';
import tenantRoutes from './routes/tenant.js';
import platformAuthRoutes from './routes/platformAuth.js';
import platformAdminRoutes from './routes/platformAdmin.js';
import billingRoutes from './routes/billing.js';
import { startCampaignScheduler } from './services/campaignRunner.js';
import { isEmailConfigured } from './services/emailService.js';
import { requestContext } from './middleware/requestContext.js';
import { validateRequestEnvelope } from './middleware/requestValidation.js';
import { tenantResolver } from './middleware/tenant.js';

dotenv.config();

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

export const createApp = ({ razorpayFactory, errorTracker } = {}) => {
  const app = express();
  if (razorpayFactory) app.locals.razorpayFactory = razorpayFactory;
  if (errorTracker) app.locals.errorTracker = errorTracker;
  if (['production', 'staging'].includes(process.env.NODE_ENV)) app.set('trust proxy', 1);
  app.use(requestContext);

  // Security middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.razorpay.com", "wss:", "ws:"],
        frameAncestors: ["'none'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
    noSniff: true,
  }));
  app.use(cookieParser());

  const productionOrigins = new Set([
    'https://cafe.infinigrowsoftech.com',
    'https://admin-cafe.infinigrowsoftech.com',
    ...[
      process.env.CLIENT_URL,
      process.env.CUSTOMER_APP_URL,
      process.env.ADMIN_CLIENT_URL,
      process.env.ADMIN_APP_URL,
      process.env.CLIENT_URLS,
      process.env.ADMIN_CLIENT_URLS,
    ]
      .flatMap((v) => String(v || '').split(','))
      .map(normalizeOrigin)
      .filter(Boolean),
  ]);
  const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    const normalized = normalizeOrigin(origin);
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost') || parsed.hostname === '127.0.0.1') return true;
    } catch { /* ignore parsing errors */ }
    const tenantBaseDomain = String(process.env.TENANT_BASE_DOMAIN || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
    let tenantCustomerOrigin = false;
    if (tenantBaseDomain) {
      try {
        const parsed = new URL(normalized);
        const prefix = parsed.hostname.endsWith(`.${tenantBaseDomain}`)
          ? parsed.hostname.slice(0, -(tenantBaseDomain.length + 1)) : '';
        tenantCustomerOrigin = parsed.protocol === 'https:' && Boolean(prefix) && !prefix.includes('.') && prefix !== 'admin';
      } catch { tenantCustomerOrigin = false; }
    }
    if (process.env.NODE_ENV === 'production') {
      return productionOrigins.has(normalized) || tenantCustomerOrigin;
    }
    // Development/staging: allow configured origins + localhost
    const devOrigins = new Set([
      ...[process.env.CLIENT_URL, process.env.CUSTOMER_APP_URL, process.env.ADMIN_CLIENT_URL, process.env.ADMIN_APP_URL]
        .flatMap((v) => String(v || '').split(','))
        .map(normalizeOrigin)
        .filter(Boolean),
      'http://localhost:5173', 'http://localhost:4173', 'http://localhost:5174',
      'http://localhost:4174', 'http://localhost:5175', 'http://localhost:3000',
    ]);
    return devOrigins.has(normalized) || productionOrigins.has(normalized) || tenantCustomerOrigin;
  };

  // Production allows the existing customer/admin origins plus one-label tenant customer subdomains.
  app.use(cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      const error = new Error('Origin is not allowed by CORS');
      error.status = 403;
      return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'idempotency-key', 'X-Requested-With', 'X-Order-Access-Token'],
    maxAge: 86400,
  }));

  app.use((req, res, next) => {
    const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.hostname.endsWith('.localhost');
    if (!isLocalhost && ['production', 'staging'].includes(process.env.NODE_ENV) && !req.secure) {
      return res.status(426).json({ error: 'HTTPS is required.', code: 'HTTPS_REQUIRED' });
    }
    next();
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────
  // Enforced in production and test suites; disabled in local development
  // so hot-reloads and multiple browser tabs are not throttled.
  if (!['development', 'test'].includes(process.env.NODE_ENV)) {
    // General baseline — covers all /api/ routes (200 req/15min)
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later.' },
    });

    // Relaxed limiter for read-heavy public endpoints
    const publicLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later.' },
    });

    // Strict limiter for sensitive mutation endpoints
    const strictLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later.' },
    });

    app.use('/api/', apiLimiter);

    // Relaxed on public read-heavy routes
    app.use('/api/menu', publicLimiter);
    app.use('/api/categories', publicLimiter);
    app.use('/api/session', publicLimiter);
    app.use('/api/tables', publicLimiter);
    app.use('/api/gallery', publicLimiter);

    // Strict on sensitive endpoints
    app.use('/api/auth', strictLimiter);
    app.use('/api/payment', strictLimiter);
    app.use('/api/contact', strictLimiter);
  }

  app.use(express.json({
    limit: '100kb',
    verify: (req, res, buffer) => {
      const pathOnly = req.originalUrl.split('?')[0];
      if (pathOnly === '/api/payment/webhook' || pathOnly === '/api/billing/webhook') req.rawBody = Buffer.from(buffer);
    },
  }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(validateRequestEnvelope);
  app.use(tenantResolver);
  app.use('/uploads', express.static('uploads', { maxAge: '1d', immutable: true, setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable') }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/menu', menuRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/tables', tableRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/gallery', galleryRoutes);
  app.use('/api/session', sessionRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/marketing', marketingRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/coupons', couponRoutes);
  app.use('/api/tenant', tenantRoutes);
  app.use('/api/platform/auth', platformAuthRoutes);
  app.use('/api/platform/admin', platformAdminRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/tenant/billing', billingRoutes);
  app.get('/api/tenant/export', (req, res, next) => res.redirect(307, '/api/tenant/billing/export'));

  app.get('/', (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(200).json({
      name: 'BrewHaus Café API Server',
      status: ready ? 'online' : 'connecting',
      database: ready ? 'connected' : 'disconnected',
      health: '/api/health',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/health', (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'unavailable',
      timestamp: new Date().toISOString(),
      email: {
        configured: isEmailConfigured(),
        hasBrevoApiKey: Boolean(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY),
        brevoSender: process.env.BREVO_FROM || process.env.SMTP_USER || null,
        hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
        hasSmtpCreds: Boolean((process.env.SMTP_USER || process.env.EMAIL_USER) && (process.env.SMTP_PASS || process.env.EMAIL_PASS)),
      },
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use((err, req, res, next) => {
    const status = Number(err.status || err.statusCode) || 500;
    const safeError = status >= 500 && process.env.NODE_ENV === 'production'
      ? new Error('Internal server error')
      : err;
    const tracker = app.locals.errorTracker;
    if (status >= 500 && typeof tracker === 'function') {
      try { tracker(safeError, { requestId: req.requestId, method: req.method, path: req.path }); } catch { /* Tracking must never break the response. */ }
    }
    if (status >= 500) process.stderr.write(`${JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', event: 'http.error', requestId: req.requestId, status, name: err.name || 'Error' })}\n`);
    res.status(status).json({
      error: status >= 500 ? (process.env.NODE_ENV === 'development' ? err.message : 'Internal server error') : (err.message || 'Request failed.'),
      code: err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      requestId: req.requestId,
      ...(process.env.NODE_ENV === 'development' && status >= 500 && { stack: err.stack }),
    });
  });

  return app;
};

export const app = createApp();

export const startServer = async () => {
  const port = process.env.PORT || 5000;
  await connectDB();
  startCampaignScheduler();
  return app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  startServer().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  });
}


