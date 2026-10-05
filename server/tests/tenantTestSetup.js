import Tenant from '../models/Tenant.js';
import mongoose from 'mongoose';
import { enterTenantContextForTests } from '../utils/tenantContext.js';
import { encryptTenantCredentials } from '../utils/tenantSecrets.js';

export const setupTestTenant = async () => {
  process.env.TENANT_CREDENTIALS_ENCRYPTION_KEY ||= Buffer.alloc(32, 19).toString('base64');
  const paymentCredentialsEncrypted = encryptTenantCredentials({ keyId: 'rzp_test_tenant', keySecret: 'integration-test-razorpay-secret', webhookSecret: 'integration-test-webhook-secret' });
  const tenantId = new mongoose.Types.ObjectId();
  enterTenantContextForTests(tenantId);
  const tenant = await Tenant.findOneAndUpdate(
    { slug: 'brewhaus' },
    { $set: { paymentCredentialsEncrypted }, $setOnInsert: { _id: tenantId, name: 'Brewhaus Café', slug: 'brewhaus', status: 'active', plan: 'starter' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  // Align direct fixture access with the existing default tenant when reusing a test database.
  enterTenantContextForTests(tenant._id);
  return tenant;
};
