import express from 'express';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Table from '../models/Table.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { runWithSystemTenantAccess } from '../utils/tenantContext.js';
import { sendApiSuccess, sendApiError } from '../utils/apiResponse.js';

const router = express.Router();

// ── GET /api/cafes - List All Cafes with Profiles ─────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const list = await runWithSystemTenantAccess(async () => {
      const tenants = await Tenant.find().sort({ name: 1 }).lean();
      return Promise.all(
        tenants.map(async (t) => {
          const [tableCount, productCount] = await Promise.all([
            Table.countDocuments({ tenantId: t._id }),
            Product.countDocuments({ tenantId: t._id }),
          ]);

          return {
            id: String(t._id),
            name: t.settings?.cafeName || t.name,
            slug: t.slug,
            status: t.status,
            plan: t.plan,
            branding: {
              primaryColor: t.settings?.primaryColor || '#c96b18',
              secondaryColor: t.settings?.accentColor || '#1a0f08',
            },
            settings: {
              cafeName: t.settings?.cafeName || t.name,
              logoUrl: t.settings?.logoUrl || '',
              tagline: t.settings?.tagline || '',
              primaryColor: t.settings?.primaryColor || '#c96b18',
              accentColor: t.settings?.accentColor || '#1a0f08',
              currency: t.settings?.currency || 'INR',
              taxRate: Number(t.settings?.taxRate ?? 5),
              address: t.settings?.address || '',
              contactEmail: t.settings?.contactEmail || '',
              contactPhone: t.settings?.contactPhone || '',
              openingHours: t.settings?.openingHours || {},
            },
            tableCount,
            productCount,
            createdAt: t.createdAt,
          };
        })
      );
    });

    return sendApiSuccess(res, 200, { cafes: list });
  } catch (error) {
    next(error);
  }
});

const slugify = (text) => {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// ── 10. Create Cafe / Start Free Trial ───────────────────────────────────────
// POST /api/cafes
router.post('/', async (req, res, next) => {
  try {
    const { name, ownerEmail, trialDays } = req.body;
    if (!name || !name.trim()) {
      return sendApiError(res, 400, 'VALIDATION_ERROR', 'Cafe name is required.');
    }

    const trimmedName = name.trim();
    const candidateSlug = slugify(trimmedName);
    const normalizedEmail = ownerEmail ? String(ownerEmail).trim().toLowerCase() : '';

    // Check slug duplication
    const existingTenant = await runWithSystemTenantAccess(async () => {
      return Tenant.findOne({ slug: candidateSlug }).lean();
    });
    if (existingTenant) {
      return sendApiError(res, 409, 'CAFE_SLUG_EXISTS', 'A cafe with this slug already exists.');
    }

    // Check owner email duplication
    if (normalizedEmail) {
      const existingUser = await runWithSystemTenantAccess(async () => {
        return User.findOne({ email: normalizedEmail }).lean();
      });
      if (existingUser) {
        return sendApiError(
          res,
          409,
          'OWNER_ALREADY_EXISTS',
          'This email is already associated with an existing cafe owner.'
        );
      }
    }

    const days = Math.max(1, Number(trialDays) || 14);
    const trialEndsAt = new Date(Date.now() + days * 86400000);

    const tenant = await runWithSystemTenantAccess(async () => {
      return Tenant.create({
        name: trimmedName,
        slug: candidateSlug,
        status: 'active',
        plan: 'starter',
        subscription: {
          plan: 'starter',
          status: 'trial',
          trialEndsAt,
        },
        settings: {
          cafeName: trimmedName,
          primaryColor: '#c96b18',
          accentColor: '#1a0f08',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          taxRate: 5,
        },
      });

      // Seed starter categories and items with images
      try {
        const catCoffee = await Category.create({
          tenantId: tenant._id,
          name: 'Coffee & Brews',
          icon: '☕',
          active: true,
          sortOrder: 1,
        });
        const catDrinks = await Category.create({
          tenantId: tenant._id,
          name: 'Cold Beverages',
          icon: '🧊',
          active: true,
          sortOrder: 2,
        });
        const catBites = await Category.create({
          tenantId: tenant._id,
          name: 'Burgers & Bites',
          icon: '🍔',
          active: true,
          sortOrder: 3,
        });
        const catPizza = await Category.create({
          tenantId: tenant._id,
          name: 'Pizzas',
          icon: '🍕',
          active: true,
          sortOrder: 4,
        });
        const catDessert = await Category.create({
          tenantId: tenant._id,
          name: 'Desserts & Bakery',
          icon: '🍰',
          active: true,
          sortOrder: 5,
        });

        await Product.create([
          {
            tenantId: tenant._id,
            name: 'Espresso',
            description: 'Rich, bold single shot made with freshly roasted 100% Arabica beans',
            price: 120,
            image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80',
            category: catCoffee._id,
            available: true,
            popular: true,
            rating: 4.8,
            prepTime: 4,
            kitchenStation: 'BAR',
          },
          {
            tenantId: tenant._id,
            name: 'Cappuccino',
            description: 'Double shot espresso layered with silky steamed milk and dusted cocoa',
            price: 160,
            image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=800&q=80',
            category: catCoffee._id,
            available: true,
            popular: true,
            rating: 4.9,
            prepTime: 5,
            kitchenStation: 'BAR',
          },
          {
            tenantId: tenant._id,
            name: 'Iced Latte',
            description: 'Smooth espresso poured over chilled whole milk and crystal ice',
            price: 180,
            image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80',
            category: catDrinks._id,
            available: true,
            popular: true,
            rating: 4.8,
            prepTime: 4,
            kitchenStation: 'BAR',
          },
          {
            tenantId: tenant._id,
            name: 'Classic Veg Burger',
            description: 'Crispy herb potato patty, melted cheddar, lettuce, and secret house dressing',
            price: 199,
            image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
            category: catBites._id,
            available: true,
            popular: true,
            rating: 4.8,
            prepTime: 12,
            kitchenStation: 'KITCHEN',
          },
          {
            tenantId: tenant._id,
            name: 'Margherita Classica',
            description: 'Wood-fired thin crust, San Marzano tomato sauce, fresh mozzarella, and fresh basil',
            price: 320,
            image: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80',
            category: catPizza._id,
            available: true,
            popular: true,
            rating: 4.9,
            prepTime: 15,
            kitchenStation: 'KITCHEN',
          },
          {
            tenantId: tenant._id,
            name: 'Butter Croissant',
            description: 'Flaky, golden-baked layered French pastry served warm with butter',
            price: 150,
            image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80',
            category: catDessert._id,
            available: true,
            popular: false,
            rating: 4.7,
            prepTime: 3,
            kitchenStation: 'BAKERY',
          },
        ]);
      } catch (seedErr) {
        // Non-blocking in case of partial creation
      }

      return tenant;
    });

    return sendApiSuccess(res, 201, {
      cafe: {
        id: String(tenant._id),
        name: tenant.name,
        slug: tenant.slug,
        status: 'TRIAL',
        trialEndsAt: trialEndsAt.toISOString(),
      },
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.slug) {
      return sendApiError(res, 409, 'CAFE_SLUG_EXISTS', 'A cafe with this slug already exists.');
    }
    next(error);
  }
});

export default router;
