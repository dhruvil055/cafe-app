export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter Plan',
    price: 999, // INR / month
    currency: 'INR',
    limits: {
      tables: 5,
      menuItems: 15,
      staffUsers: 2,
      outlets: 1,
    },
    features: {
      basicAnalytics: true,
      advancedAnalytics: false,
      inventory: false,
      marketingCampaigns: false,
      customBranding: true,
      tableQrOrdering: true,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro Plan',
    price: 2499,
    currency: 'INR',
    limits: {
      tables: 25,
      menuItems: 100,
      staffUsers: 10,
      outlets: 2,
    },
    features: {
      basicAnalytics: true,
      advancedAnalytics: true,
      inventory: true,
      marketingCampaigns: true,
      customBranding: true,
      tableQrOrdering: true,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Plan',
    price: 6999,
    currency: 'INR',
    limits: {
      tables: 1000,
      menuItems: 2000,
      staffUsers: 50,
      outlets: 10,
    },
    features: {
      basicAnalytics: true,
      advancedAnalytics: true,
      inventory: true,
      marketingCampaigns: true,
      customBranding: true,
      tableQrOrdering: true,
    },
  },
};

export const getPlan = (planId = 'starter') => PLANS[planId] || PLANS.starter;

export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'www',
  'app',
  'platform',
  'billing',
  'support',
  'dashboard',
  'system',
  'root',
  'superadmin',
  'super-admin',
  'login',
  'signup',
  'auth',
  'mail',
  'test',
  'demo',
  'help',
  'status',
]);
