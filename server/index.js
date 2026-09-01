import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
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

dotenv.config();

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

export const createApp = ({ razorpayFactory } = {}) => {
  const app = express();
  if (razorpayFactory) app.locals.razorpayFactory = razorpayFactory;

  // Security middleware
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const allowedOrigins = new Set([
    ...[process.env.CLIENT_URL, process.env.CLIENT_URLS]
      .flatMap((value) => String(value || '').split(','))
      .map(normalizeOrigin)
      .filter(Boolean),
    'http://localhost:5173',
    'http://localhost:4173',
  ]);

  // Strict CORS allowlist. Requests without an Origin are allowed for native
  // clients and command-line integrations; browser origins must be explicit.
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(normalizeOrigin(origin))) return callback(null, true);
      const error = new Error('Origin is not allowed by CORS');
      error.status = 403;
      return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Too many requests. Please try again later.' },
  });
  app.use('/api/', limiter);

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use('/uploads', express.static('uploads'));

  app.use('/api/auth', authRoutes);
  app.use('/api/menu', menuRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/tables', tableRoutes);
  app.use('/api/upload', uploadRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  return app;
};

export const app = createApp();

export const startServer = async () => {
  const port = process.env.PORT || 5000;
  await connectDB();
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
