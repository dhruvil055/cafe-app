import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptTenantCredentials, encryptTenantCredentials, publicTenantSettings } from '../utils/tenantSecrets.js';

test('tenant payment credentials encrypt at rest and reject ciphertext tampering', () => {
  process.env.TENANT_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  const credentials = { keyId: 'rzp_test_public', keySecret: 'private-secret', webhookSecret: 'webhook-secret' };
  const encrypted = encryptTenantCredentials(credentials);
  assert.equal(encrypted.includes(credentials.keySecret), false);
  assert.equal(encrypted.includes(credentials.webhookSecret), false);
  assert.deepEqual(decryptTenantCredentials(encrypted), credentials);
  const parts = encrypted.split('.');
  const ciphertext = Buffer.from(parts[2], 'base64url');
  ciphertext[0] ^= 1;
  parts[2] = ciphertext.toString('base64url');
  assert.throws(() => decryptTenantCredentials(parts.join('.')));
});

test('public tenant settings omit encrypted payment credentials', () => {
  const result = publicTenantSettings({
    _id: '507f1f77bcf86cd799439011', slug: 'example', status: 'active', name: 'Example Café',
    settings: { cafeName: 'Example Café', currency: 'USD', taxRate: 8.25 },
    paymentCredentialsEncrypted: 'ciphertext',
  });
  assert.equal(result.name, 'Example Café');
  assert.equal(result.currency, 'USD');
  assert.equal(Object.hasOwn(result, 'paymentCredentialsEncrypted'), false);
});
