import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true, unique: true, match: /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/ },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', required: true },
  plan: { type: String, default: 'starter', required: true },
  subscription: {
    plan: { type: String, default: 'starter' },
    status: { type: String, enum: ['trial', 'active', 'past_due', 'cancelled', 'suspended'], default: 'trial' },
    trialEndsAt: { type: Date, default: () => new Date(Date.now() + 14 * 86400000) },
    currentPeriodEnd: { type: Date, default: null },
    gracePeriodUntil: { type: Date, default: null },
    razorpaySubscriptionId: { type: String, default: '' },
    razorpayCustomerId: { type: String, default: '' },
    subscriptionCreatedAt: { type: Date, default: null },
  },
  settings: {
    cafeName: { type: String, trim: true, maxlength: 100, default: '' },
    logoUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    heroImageUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    tagline: { type: String, trim: true, maxlength: 200, default: '' },
    primaryColor: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: '#c96b18' },
    accentColor: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: '#1a0f08' },
    currency: { type: String, uppercase: true, match: /^[A-Z]{3}$/, default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    gstNumber: { type: String, trim: true, maxlength: 32, default: '' },
    taxRate: { type: Number, min: 0, max: 100, default: 5 },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    contactPhone: { type: String, trim: true, maxlength: 32, default: '' },
    openingHours: { type: mongoose.Schema.Types.Mixed, default: {} },
    gstSettings: {
      gstin: { type: String, trim: true, default: '' },
      legalName: { type: String, trim: true, default: '' },
      tradeName: { type: String, trim: true, default: '' },
      stateCode: { type: String, trim: true, default: '24' },
      compositionScheme: { type: Boolean, default: false },
      invoicePrefix: { type: String, trim: true, default: 'INV' },
      nextInvoiceNumber: { type: Number, default: 1001 },
    },
    posSettings: {
      autoAcceptOrders: { type: Boolean, default: false },
      printReceiptOnOrder: { type: Boolean, default: true },
      defaultStation: { type: String, default: 'KITCHEN' },
    },
  },
  paymentCredentialsEncrypted: { type: String, select: false, default: '' },
  razorpayWebhookSecret: { type: String, select: false, default: '' },
  deletionRequestedAt: { type: Date, default: null },
  scheduledPurgeAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: true } });

export default mongoose.model('Tenant', tenantSchema);
