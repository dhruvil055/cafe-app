import express from 'express';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import Razorpay from 'razorpay';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Table from '../models/Table.js';
import PendingSignup from '../models/PendingSignup.js';
import { RESERVED_SLUGS } from '../config/plans.js';
import { runWithSystemTenantAccess } from '../utils/tenantContext.js';
import { createTableQrToken } from '../utils/tableQr.js';
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from '../utils/authTokens.js';
import { setSessionCookies } from './auth.js';
import {
  sendVerificationCodeEmail,
  sendWelcomeEmail,
  isEmailConfigured,
} from '../services/emailService.js';

const router = express.Router();

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only expose OTP in automated test runs (never in production or live environments)
const canExposeOtp = (req) => process.env.NODE_ENV === 'test';

const EMAIL_FAILED_MESSAGE =
  'We could not send the verification email right now. Please try again in a moment or contact support.';

// POST /api/platform/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const { cafeName, email, password, slug } = req.body || {};

    const cleanName = String(cafeName || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanSlug = String(slug || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({ error: 'Café name must be between 2 and 100 characters.' });
    }

    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    if (!rawPassword || rawPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    if (!cleanSlug || !SLUG_REGEX.test(cleanSlug)) {
      return res.status(400).json({
        error: 'Café URL identifier (slug) must be 3-30 lowercase characters with letters, numbers, and hyphens.',
      });
    }

    if (RESERVED_SLUGS.has(cleanSlug)) {
      return res.status(400).json({ error: 'This café URL is reserved for platform use. Please pick another one.' });
    }

    // Check system-wide for existing tenant slug and owner email
    const [existingTenant, existingUser] = await runWithSystemTenantAccess(async () => {
      const t = await Tenant.findOne({ slug: cleanSlug }).lean();
      const u = await User.findOne({ email: cleanEmail }).lean();
      return [t, u];
    });

    if (existingTenant) {
      return res.status(400).json({ error: 'This café URL is already taken. Please choose another one.' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Remove any stale pending signups for this email or slug
    await PendingSignup.deleteMany({
      $or: [{ email: cleanEmail }, { slug: cleanSlug }],
    });

    await PendingSignup.create({
      email: cleanEmail,
      passwordHash: rawPassword,
      cafeName: cleanName,
      slug: cleanSlug,
      verificationCode,
      expiresAt,
    });

    // Send verification code
    let emailDispatched = false;
    let dispatchReason = null;
    try {
      const emailResult = await sendVerificationCodeEmail({
        to: cleanEmail,
        cafeName: cleanName,
        code: verificationCode,
      });
      emailDispatched = Boolean(emailResult?.success);
      if (!emailDispatched) {
        dispatchReason = emailResult?.reason;
      }
    } catch (emailErr) {
      dispatchReason = emailErr.message;
      console.error('[platformAuth] Failed to dispatch verification email:', emailErr.message);
    }

    const showDemoCode = canExposeOtp(req);

    if (!emailDispatched && !showDemoCode) {
      console.error(`[platformAuth] Email to ${cleanEmail} failed: ${dispatchReason}`);
      return res.status(400).json({
        error: `Could not send verification email to ${cleanEmail}: ${dispatchReason || 'Delivery failed'}. Check email settings on Render.`,
      });
    }

    res.status(200).json({
      message: 'Verification code sent to your email.',
      email: cleanEmail,
      slug: cleanSlug,
      demoCode: showDemoCode ? verificationCode : undefined,
      emailDelivered: emailDispatched,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/platform/auth/resend-code
router.post('/resend-code', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email is required to resend verification code.' });
    }

    const pending = await PendingSignup.findOne({ email: cleanEmail });
    if (!pending) {
      return res.status(404).json({ error: 'No pending signup found for this email. Please sign up again.' });
    }

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    pending.verificationCode = verificationCode;
    pending.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await pending.save();

    let emailDispatched = false;
    let dispatchReason = null;
    try {
      const emailResult = await sendVerificationCodeEmail({
        to: pending.email,
        cafeName: pending.cafeName,
        code: verificationCode,
      });
      emailDispatched = Boolean(emailResult?.success);
      if (!emailDispatched) {
        dispatchReason = emailResult?.reason;
      }
    } catch (emailErr) {
      dispatchReason = emailErr.message;
      console.error('[platformAuth] Failed to resend verification email:', emailErr.message);
    }

    const showDemoCode = canExposeOtp(req);

    if (!emailDispatched && !showDemoCode) {
      console.error(`[platformAuth] Resend email to ${pending.email} failed: ${dispatchReason}`);
      return res.status(400).json({
        error: `Could not resend verification email to ${pending.email}: ${dispatchReason || 'Delivery failed'}. Check email settings on Render.`,
      });
    }

    res.status(200).json({
      message: 'A fresh verification code has been sent to your email.',
      email: pending.email,
      demoCode: showDemoCode ? verificationCode : undefined,
      emailDelivered: emailDispatched,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/platform/auth/verify-email
router.post('/verify-email', async (req, res, next) => {
  try {
    const { email, code } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();

    if (!cleanEmail || !cleanCode) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const pending = await PendingSignup.findOne({
      email: cleanEmail,
      verificationCode: cleanCode,
      expiresAt: { $gt: new Date() },
    });

    if (!pending) {
      return res.status(400).json({ error: 'Invalid or expired verification code. Please request a new one.' });
    }

    const clientUrl = String(process.env.CUSTOMER_APP_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

    let createdTenantId = null;

    const result = await runWithSystemTenantAccess(async () => {
        // Re-verify slug and email uniqueness
        const slugCheck = await Tenant.findOne({ slug: pending.slug });
        const userCheck = await User.findOne({ email: pending.email });

        // Self-healing: if an earlier verification attempt failed midway for this exact pending signup
        // (orphan tenant/user with 0 tables created), purge the orphan records so the retry succeeds.
        if (slugCheck && userCheck && String(userCheck.tenantId) === String(slugCheck._id)) {
          const tableCount = await Table.countDocuments({ tenantId: slugCheck._id });
          if (tableCount === 0) {
            console.warn(`[platformAuth] Recovering incomplete prior provision for tenant slug '${pending.slug}'. Purging incomplete records.`);
            await Category.deleteMany({ tenantId: slugCheck._id });
            await Product.deleteMany({ tenantId: slugCheck._id });
            await Table.deleteMany({ tenantId: slugCheck._id });
            await User.deleteMany({ tenantId: slugCheck._id });
            await Tenant.deleteOne({ _id: slugCheck._id });
          } else {
            throw new Error('SLUG_TAKEN');
          }
        } else {
          if (slugCheck) {
            throw new Error('SLUG_TAKEN');
          }
          if (userCheck) {
            throw new Error('EMAIL_TAKEN');
          }
        }

        // 1. Create Tenant
        const tenant = await Tenant.create({
          name: pending.cafeName,
          slug: pending.slug,
          status: 'active',
          plan: 'starter',
          subscription: {
            plan: 'starter',
            status: 'trial',
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            currentPeriodEnd: null,
            gracePeriodUntil: null,
            razorpaySubscriptionId: '',
            razorpayCustomerId: '',
            subscriptionCreatedAt: null,
          },
          settings: {
            cafeName: pending.cafeName,
            primaryColor: '#c96b18',
            accentColor: '#1a0f08',
            currency: 'INR',
            timezone: 'Asia/Kolkata',
            taxRate: 5,
          },
        });
        createdTenantId = tenant._id;

        // 2. Create Owner User
        const user = await User.create({
          tenantId: tenant._id,
          name: `${pending.cafeName} Owner`,
          email: pending.email,
          password: pending.passwordHash,
          role: 'owner',
        });

        // 3. Create Starter Categories
        const hotBrews = await Category.create({
          tenantId: tenant._id,
          name: 'Hot Brews',
          icon: '☕',
          active: true,
          sortOrder: 1,
        });

        const coldBrews = await Category.create({
          tenantId: tenant._id,
          name: 'Cold Beverages',
          icon: '🧋',
          active: true,
          sortOrder: 2,
        });

        const pastries = await Category.create({
          tenantId: tenant._id,
          name: 'Pastries',
          icon: '🥐',
          active: true,
          sortOrder: 3,
        });

        // 4. Create Starter Products
        await Product.create([
          {
            tenantId: tenant._id,
            name: 'Espresso',
            description: 'Rich, bold single shot made with freshly roasted beans',
            price: 120,
            category: hotBrews._id,
            available: true,
            popular: true,
            rating: 4.8,
            prepTime: 5,
          },
          {
            tenantId: tenant._id,
            name: 'Iced Latte',
            description: 'Smooth espresso poured over chilled milk and artisanal ice',
            price: 180,
            category: coldBrews._id,
            available: true,
            popular: true,
            rating: 4.9,
            prepTime: 7,
          },
          {
            tenantId: tenant._id,
            name: 'Butter Croissant',
            description: 'Flaky, golden-baked layered pastry served warm with butter',
            price: 150,
            category: pastries._id,
            available: true,
            popular: false,
            rating: 4.7,
            prepTime: 5,
          },
        ]);

        // 5. Create Starter Tables with Signed QR Tokens
        for (let i = 1; i <= 3; i++) {
          const tableId = new mongoose.Types.ObjectId();
          const qrToken = createTableQrToken(tableId, tenant._id);
          const qrUrl = `${clientUrl}/menu?tableToken=${encodeURIComponent(qrToken)}`;
          const qrCode = await QRCode.toDataURL(qrUrl, {
            width: 400,
            margin: 2,
            color: { dark: '#1a0f08', light: '#FFFFFF' },
            errorCorrectionLevel: 'H',
          });

          await Table.create({
            _id: tableId,
            tenantId: tenant._id,
            tableNumber: i,
            label: `Table ${i}`,
            seats: 4,
            active: true,
            qrCode,
            qrUrl,
          });
        }

        // 6. Create Razorpay Subscription (if configured and valid)
        let razorpaySubscription = null;
        let razorpayCustomer = null;
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_ID.includes('xxxx')) {
          try {
            const razorpay = new Razorpay({
              key_id: process.env.RAZORPAY_KEY_ID,
              key_secret: process.env.RAZORPAY_KEY_SECRET,
            });

            const customer = await razorpay.customers.create({
              name: pending.cafeName,
              email: pending.email,
              notes: {
                tenant_id: tenant._id.toString(),
              },
            });
            razorpayCustomer = customer.id;

            const subscription = await razorpay.subscriptions.create({
              plan_id: process.env.RAZORPAY_STARTER_PLAN_ID || 'plan_starter',
              customer_notify: 1,
              total_count: 0,
              quantity: 1,
              addons: [],
              notes: {
                tenant_id: tenant._id.toString(),
              },
            });
            razorpaySubscription = subscription.id;

            if (razorpaySubscription) {
              tenant.subscription.razorpaySubscriptionId = razorpaySubscription;
              tenant.subscription.razorpayCustomerId = razorpayCustomer || '';
              tenant.subscription.subscriptionCreatedAt = new Date();
              await tenant.save();
            }
          } catch (razorpayError) {
            console.warn('[platformAuth] Razorpay subscription setup skipped:', razorpayError.message);
          }
        }

        // 7. Send Welcome Email in background
        const adminUrl = String(process.env.ADMIN_APP_URL || process.env.ADMIN_CLIENT_URL || 'https://admin-cafe.infinigrowsoftech.com').replace(/\/$/, '');
        sendWelcomeEmail({
          to: pending.email,
          cafeName: pending.cafeName,
          adminUrl,
        }).catch((emailError) => {
          console.error('[platformAuth] Welcome email failed:', emailError.message);
        });

        // Cleanup pending record
        await PendingSignup.deleteOne({ _id: pending._id });

        // Generate access & refresh tokens
        const accessToken = createAccessToken(user._id, tenant._id);
        const refreshToken = createRefreshToken();
        user.refreshTokenHash = hashRefreshToken(refreshToken);
        user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
        await user.save();

        return { user, tenant, accessToken, refreshToken };
      });

      setSessionCookies(res, result.accessToken, result.refreshToken);

      res.status(201).json({
        token: result.accessToken,
        user: {
          id: result.user._id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          tenantId: result.tenant._id,
        },
        tenant: {
          id: result.tenant._id,
          name: result.tenant.name,
          slug: result.tenant.slug,
          plan: result.tenant.plan,
          subscription: result.tenant.subscription,
        },
      });
    } catch (error) {
      if (createdTenantId) {
        try {
          await runWithSystemTenantAccess(async () => {
            await Category.deleteMany({ tenantId: createdTenantId });
            await Product.deleteMany({ tenantId: createdTenantId });
            await Table.deleteMany({ tenantId: createdTenantId });
            await User.deleteMany({ tenantId: createdTenantId });
            await Tenant.deleteOne({ _id: createdTenantId });
          });
          console.warn(`[platformAuth] Cleaned up partial tenant records for ${createdTenantId} after provisioning error.`);
        } catch (cleanupErr) {
          console.error('[platformAuth] Cleanup error:', cleanupErr.message);
        }
      }

      console.error('[platformAuth verify-email error]:', error);
      if (error.message === 'SLUG_TAKEN') {
        return res.status(400).json({ error: 'This café URL is already taken. Please choose another one.' });
      }
      if (error.message === 'EMAIL_TAKEN') {
        return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
      }
      next(error);
    }
  });

export default router;
