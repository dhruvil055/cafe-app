import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tenant from '../models/Tenant.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Table from '../models/Table.js';
import { runWithTenant, runWithSystemTenantAccess } from '../utils/tenantContext.js';
import { createTableQrToken } from '../utils/tableQr.js';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cafe_dev';
if (!mongoUri) {
  console.error('MONGO_URI is required.');
  process.exit(1);
}

const seed = async () => {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  // 1. Tenant 1: Brewhaus Café
  const brewhaus = await runWithSystemTenantAccess(async () => {
    return Tenant.findOneAndUpdate(
      { slug: 'brewhaus' },
      {
        $set: {
          name: 'Brewhaus Café',
          slug: 'brewhaus',
          status: 'active',
          plan: 'starter',
          settings: {
            cafeName: 'Brewhaus Café',
            logoUrl: '',
            primaryColor: '#c96b18',
            accentColor: '#1a0f08',
            currency: 'INR',
            timezone: 'Asia/Kolkata',
            gstNumber: '29ABCDE1234F1Z5',
            taxRate: 5,
            address: '12 Artisan Lane, Roastery Square, Indiranagar',
            contactEmail: 'hello@brewhauscafe.com',
            contactPhone: '+91 98765 43210',
            openingHours: { monday: '08:00-22:00', tuesday: '08:00-22:00' },
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  });
  console.log(`Configured Tenant 1: ${brewhaus.name} (${brewhaus.slug})`);

  // 2. Tenant 2: Velvet Roast
  const velvet = await runWithSystemTenantAccess(async () => {
    return Tenant.findOneAndUpdate(
      { slug: 'velvet-roast' },
      {
        $set: {
          name: 'Velvet Roast',
          slug: 'velvet-roast',
          status: 'active',
          plan: 'pro',
          settings: {
            cafeName: 'Velvet Roast',
            logoUrl: '',
            primaryColor: '#2563eb',
            accentColor: '#0f172a',
            currency: 'USD',
            timezone: 'America/New_York',
            gstNumber: '',
            taxRate: 8.875,
            address: '742 Evergreen Terrace, Brooklyn, NY',
            contactEmail: 'contact@velvetroast.com',
            contactPhone: '+1 212 555 0199',
            openingHours: { monday: '07:00-20:00', tuesday: '07:00-20:00' },
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  });
  console.log(`Configured Tenant 2: ${velvet.name} (${velvet.slug})`);

  // 3. Tenant 3: Suspended Café
  const suspended = await runWithSystemTenantAccess(async () => {
    return Tenant.findOneAndUpdate(
      { slug: 'suspended-cafe' },
      {
        $set: {
          name: 'Suspended Roasters',
          slug: 'suspended-cafe',
          status: 'suspended',
          plan: 'starter',
          settings: {
            cafeName: 'Suspended Roasters',
            primaryColor: '#6b7280',
            accentColor: '#111827',
            currency: 'INR',
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  });
  console.log(`Configured Tenant 3 (Suspended): ${suspended.name} (${suspended.slug})`);

  // Seed Menu items for Brewhaus if empty
  await runWithTenant(brewhaus._id, async () => {
    let cat = await Category.findOne({ name: 'Artisanal Coffee' });
    if (!cat) {
      cat = await Category.create({ name: 'Artisanal Coffee', active: true, sortOrder: 1 });
    }
    const existing = await Product.findOne({ name: 'Brewhaus Pour Over' });
    if (!existing) {
      await Product.create({
        name: 'Brewhaus Pour Over',
        description: 'Single-origin Ethiopian beans brewed slowly to preserve delicate floral notes.',
        price: 180,
        category: cat._id,
        isVeg: true,
        available: true,
        popular: true,
      });
      await Product.create({
        name: 'Vanilla Bean Flat White',
        description: 'Double ristretto espresso with silky steamed micro-foam and Madagascar vanilla.',
        price: 220,
        category: cat._id,
        isVeg: true,
        available: true,
      });
    }
    const table = await Table.findOne({ tableNumber: 1 });
    if (!table) {
      await Table.create({ tableNumber: 1, label: 'Patio Corner', seats: 2 });
    }
    console.log('Seeded menu and table for Brewhaus Café.');
  });

  // Seed Menu items for Velvet Roast
  await runWithTenant(velvet._id, async () => {
    let cat = await Category.findOne({ name: 'Cold Brews & Nitro' });
    if (!cat) {
      cat = await Category.create({ name: 'Cold Brews & Nitro', active: true, sortOrder: 1 });
    }
    const existing = await Product.findOne({ name: 'Velvet Nitro Draft' });
    if (!existing) {
      await Product.create({
        name: 'Velvet Nitro Draft',
        description: 'Cold brewed for 24 hours and infused with nitrogen for a creamy, stout-like head.',
        price: 5.5,
        category: cat._id,
        isVeg: true,
        available: true,
        popular: true,
      });
      await Product.create({
        name: 'Kyoto Drip Reserve',
        description: 'Slow-drip cold extraction highlighting crisp cacao and cherry undertones.',
        price: 6.5,
        category: cat._id,
        isVeg: true,
        available: true,
      });
    }
    const table = await Table.findOne({ tableNumber: 1 });
    if (!table) {
      await Table.create({ tableNumber: 1, label: 'Window Booth', seats: 4 });
    }
    console.log('Seeded menu and table for Velvet Roast.');
  });

  await mongoose.disconnect();
  console.log('Done!');
};

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
