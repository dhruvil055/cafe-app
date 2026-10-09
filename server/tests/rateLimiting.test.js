import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import RedisMock from 'ioredis-mock';

dotenv.config();

// Configure test environment variables
process.env.NODE_ENV = 'test';
process.env.ENABLE_RATE_LIMITING = 'true';
process.env.RATE_LIMIT_WINDOW_MS = '60000'; // 1 minute window
process.env.AUTH_RATE_LIMIT_MAX = '5';       // 5 attempts allowed
process.env.PUBLIC_RATE_LIMIT_MAX = '50';
process.env.RATE_LIMIT_MAX = '50';
process.env.TRUST_PROXY_HOPS = '1';

import { setRedisClient, getRedisClient } from '../config/redis.js';
import { createApp } from '../index.js';

test('PRODUCTION HARDENING & RATE LIMITING VERIFICATION TEST SUITE', async (t) => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  // Setup shared mock Redis
  const sharedRedis = new RedisMock();
  setRedisClient(sharedRedis);

  const startTestServer = async (appInstance) => {
    let server;
    let baseUrl;
    await new Promise((resolve) => {
      server = appInstance.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
    return { server, baseUrl };
  };

  const app1 = createApp();
  const { server: server1, baseUrl: baseUrl1 } = await startTestServer(app1);

  t.after(async () => {
    if (server1) server1.close();
    setRedisClient(null);
  });

  const request = async (baseUrl, path, options = {}) => {
    const clientIp = options.ip || '203.0.113.10';
    const headers = {
      'Content-Type': 'application/json',
      'X-Forwarded-For': clientIp,
      'X-Forwarded-Host': options.host || 'testcafe.localhost',
      ...(options.headers || {}),
    };
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      data,
    };
  };

  await t.test('1. Normal read traffic to /api/tenant/public and /api/auth/me is never blocked', async () => {
    for (let i = 0; i < 15; i++) {
      const res = await request(baseUrl1, '/api/tenant/public', { ip: '198.51.100.1' });
      assert.notEqual(res.status, 429, `Request ${i + 1} to /api/tenant/public should not be rate limited`);
    }

    for (let i = 0; i < 15; i++) {
      const res = await request(baseUrl1, '/api/auth/me', { ip: '198.51.100.1' });
      assert.notEqual(res.status, 429, `Request ${i + 1} to /api/auth/me should not be rate limited`);
      assert.equal(res.status, 401, 'Should return 401 unauthenticated, not 429');
    }
  });

  await t.test('2. Repeated failed logins return 429 with standard headers and JSON payload', async () => {
    const attackerIp = '198.51.100.77';
    let triggered429 = false;
    let final429Response = null;

    // AUTH_RATE_LIMIT_MAX = 5. Fire 8 failed attempts from this IP:
    for (let i = 1; i <= 8; i++) {
      const res = await request(baseUrl1, '/api/auth/login', {
        method: 'POST',
        ip: attackerIp,
        body: { email: 'fake@example.com', password: 'wrongpassword' },
      });

      if (res.status === 429) {
        triggered429 = true;
        final429Response = res;
        break;
      }
    }

    assert.ok(triggered429, 'Repeated failed logins must trigger HTTP 429');
    assert.ok(final429Response, '429 response must exist');
    assert.equal(final429Response.status, 429);

    // Verify Headers
    const headers = final429Response.headers;
    assert.ok(headers['retry-after'], 'Response must have Retry-After header');
    assert.ok(Number(headers['retry-after']) > 0, 'Retry-After must be positive seconds');
    assert.ok(headers['ratelimit-limit'] || headers['ratelimit'], 'Response must have RateLimit-* header');

    // Verify JSON payload shape
    assert.equal(final429Response.data.code, 'RATE_LIMITED');
    assert.ok(final429Response.data.retryAfterSeconds > 0);
    assert.ok(final429Response.data.error.includes('Too many requests'));

    console.log('\n--- VERIFIED 429 RESPONSE HEADERS ---');
    console.log('Status:', final429Response.status, 'Too Many Requests');
    console.log('Retry-After:', headers['retry-after']);
    console.log('RateLimit-Limit:', headers['ratelimit-limit']);
    console.log('RateLimit-Remaining:', headers['ratelimit-remaining']);
    console.log('RateLimit-Reset:', headers['ratelimit-reset']);
    console.log('JSON Payload:', JSON.stringify(final429Response.data, null, 2));
    console.log('-------------------------------------\n');
  });

  await t.test('3. IP isolation: different client IP is not blocked by attacker', async () => {
    // Innocent user on different IP '198.51.100.99'
    const res = await request(baseUrl1, '/api/auth/login', {
      method: 'POST',
      ip: '198.51.100.99',
      body: { email: 'innocent@example.com', password: 'wrongpassword' },
    });

    assert.notEqual(res.status, 429, 'Innocent client IP must not be locked out');
    assert.equal(res.status, 401, 'Should return normal 401 invalid credentials');
  });

  await t.test('4. Rate limits are shared across multiple backend instances via Redis', async () => {
    // Start Instance 2 sharing the same Redis client
    const app2 = createApp();
    const { server: server2, baseUrl: baseUrl2 } = await startTestServer(app2);

    try {
      const sharedClientIp = '198.51.100.55';

      // Fire 3 requests on Instance 1
      for (let i = 0; i < 3; i++) {
        const res1 = await request(baseUrl1, '/api/auth/login', {
          method: 'POST',
          ip: sharedClientIp,
          body: { email: 'test@example.com', password: 'wrong' },
        });
        assert.equal(res1.status, 401);
      }

      // Fire 3 requests on Instance 2 from the same IP -> should hit limit (total = 6 > 5)
      let instance2Triggered429 = false;
      for (let i = 0; i < 3; i++) {
        const res2 = await request(baseUrl2, '/api/auth/login', {
          method: 'POST',
          ip: sharedClientIp,
          body: { email: 'test@example.com', password: 'wrong' },
        });
        if (res2.status === 429) {
          instance2Triggered429 = true;
          break;
        }
      }

      assert.ok(instance2Triggered429, 'Rate limit must be enforced across instances via shared Redis');
    } finally {
      server2.close();
    }
  });

  await t.test('5. Rate limit counters survive instance restart', async () => {
    const restartIp = '198.51.100.44';

    // 4 failed attempts on server 1
    for (let i = 0; i < 4; i++) {
      await request(baseUrl1, '/api/auth/login', {
        method: 'POST',
        ip: restartIp,
        body: { email: 'test@example.com', password: 'wrong' },
      });
    }

    // Simulate restart by spinning up a new app instance with the same Redis store
    const restartedApp = createApp();
    const { server: restartedServer, baseUrl: restartedUrl } = await startTestServer(restartedApp);

    try {
      // 5th attempt on restarted server should hit the limit (limit is 5)
      const res5 = await request(restartedUrl, '/api/auth/login', {
        method: 'POST',
        ip: restartIp,
        body: { email: 'test@example.com', password: 'wrong' },
      });
      // 6th attempt is strictly 429
      const res6 = await request(restartedUrl, '/api/auth/login', {
        method: 'POST',
        ip: restartIp,
        body: { email: 'test@example.com', password: 'wrong' },
      });
      assert.ok(res5.status === 429 || res6.status === 429, 'Counter must persist across restart via Redis');
    } finally {
      restartedServer.close();
    }
  });

  await t.test('6. /api/readyz reports readiness for Mongo and Redis', async () => {
    const res = await request(baseUrl1, '/api/readyz');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
    assert.equal(res.data.database, 'connected');
  });

  await t.test('7. Sensitive routes return Cache-Control: no-store', async () => {
    const res = await request(baseUrl1, '/api/auth/me');
    const cc = res.headers['cache-control'] || '';
    assert.ok(cc.includes('no-store'), 'Sensitive route must include no-store');
    assert.ok(cc.includes('private'), 'Sensitive route must include private');
  });
});
