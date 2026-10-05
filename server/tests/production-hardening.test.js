import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
const { createApp } = await import('../index.js');

test('production API requires HTTPS and rejects origins outside the two-site allowlist', async (t) => {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const plainHttp = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://cafe.infinigrowsoftech.com' },
  });
  assert.equal(plainHttp.status, 426);
  assert.equal((await plainHttp.json()).code, 'HTTPS_REQUIRED');

  const subdomainBypass = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://attacker.infinigrowsoftech.com', 'X-Forwarded-Proto': 'https' },
  });
  assert.equal(subdomainBypass.status, 403);

  const forwardedHttps = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://cafe.infinigrowsoftech.com', 'X-Forwarded-Proto': 'https' },
  });
  assert.equal(forwardedHttps.status, 503); // HTTPS passed; DB readiness is correctly unavailable in this isolated test.
  assert.ok(forwardedHttps.headers.get('strict-transport-security'));
});
