import crypto from 'crypto';

const getKey = () => {
  const value = process.env.TENANT_CREDENTIALS_ENCRYPTION_KEY || '';
  let key;
  if (/^[a-f\d]{64}$/i.test(value)) key = Buffer.from(value, 'hex');
  else {
    try { key = Buffer.from(value, 'base64'); } catch { key = Buffer.alloc(0); }
  }
  if (key.length !== 32) {
    const error = new Error('TENANT_CREDENTIALS_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key.');
    error.code = 'TENANT_CREDENTIALS_KEY_INVALID';
    error.status = 503;
    throw error;
  }
  return key;
};

export const encryptTenantCredentials = (credentials) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
};

export const decryptTenantCredentials = (stored) => {
  if (!stored) return { keyId: '', keySecret: '', webhookSecret: '' };
  const [ivText, tagText, dataText] = String(stored).split('.');
  if (!ivText || !tagText || !dataText) throw new Error('Stored payment credentials are invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8'));
};

export const publicTenantSettings = (tenant) => {
  if (!tenant) return null;
  return {
    id: String(tenant._id || ''),
    slug: tenant.slug || '',
    status: tenant.status || 'active',
    name: tenant.settings?.cafeName || tenant.name || 'Café',
    logoUrl: tenant.settings?.logoUrl || '',
    heroImageUrl: tenant.settings?.heroImageUrl || '',
    tagline: tenant.settings?.tagline || '',
    primaryColor: tenant.settings?.primaryColor || '#c96b18',
    accentColor: tenant.settings?.accentColor || '#1a0f08',
    currency: tenant.settings?.currency || 'INR',
    timezone: tenant.settings?.timezone || 'Asia/Kolkata',
    gstNumber: tenant.settings?.gstNumber || '',
    taxRate: Number(tenant.settings?.taxRate ?? 5),
    address: tenant.settings?.address || '',
    contactEmail: tenant.settings?.contactEmail || '',
    contactPhone: tenant.settings?.contactPhone || '',
    openingHours: tenant.settings?.openingHours || {},
  };
};
