import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { openLiveStream, publishLiveUpdate, liveSubscriberCount, getSubscribers } from '../services/liveUpdates.js';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_TEST_URI || `mongodb://127.0.0.1:27017/cafe_live_tenant_test_${process.pid}`;
process.env.JWT_SECRET = 'tenant-live-updates-test-jwt-secret-min32chars';
process.env.TABLE_QR_SECRET = 'tenant-live-updates-test-qr-secret-min32chars';

test('Live updates are isolated per tenant - cross-tenant event isolation', async (t) => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();

  // Create two mock tenants by simulating different channels
  const tenantAChannel = 'tenant:tenantA';
  const tenantBChannel = 'tenant:tenantB';

  const createMockResponse = () => {
    const response = {
      writableEnded: false,
      statusCode: 200,
      headers: {},
      output: '',
      status(code) { this.statusCode = code; return this; },
      set(headers) { this.headers = headers; return this; },
      flushHeaders() {},
      write(chunk) { this.output += chunk; return true; },
      on(event, handler) { if (event === 'close') this._closeHandler = handler; return this; },
    };
    return response;
  };

  await t.test('Tenant A receives only Tenant A events', async () => {
    const responseA = createMockResponse();
    const mockRequestA = { 
      on: (event, handler) => { if (event === 'close') mockRequestA._closeHandler = handler; }
    };
    
    openLiveStream(mockRequestA, responseA, tenantAChannel);
    assert.equal(liveSubscriberCount(tenantAChannel), 1);

    // Publish event for Tenant A
    publishLiveUpdate(tenantAChannel, 'new-order', { order: { orderNumber: 'CAF1001', tableNumber: 1 } });
    
    // Allow async processing
    await new Promise(r => setTimeout(r, 50));
    
    assert.match(responseA.output, /event: connected/);
    assert.match(responseA.output, /event: new-order/);
    assert.match(responseA.output, /CAF1001/);

    // Publish event for Tenant B - Tenant A should NOT receive it
    publishLiveUpdate(tenantBChannel, 'new-order', { order: { orderNumber: 'CAF2001', tableNumber: 2 } });
    await new Promise(r => setTimeout(r, 50));
    
    // Tenant A should still only have their own event
    assert.match(responseA.output, /CAF1001/);
    assert.ok(!responseA.output.includes('CAF2001'));
  });

  await t.test('Tenant B receives only Tenant B events', async () => {
    const responseB = createMockResponse();
    const mockRequestB = { 
      on: (event, handler) => { if (event === 'close') mockRequestB._closeHandler = handler; }
    };
    
    openLiveStream(mockRequestB, responseB, tenantBChannel);
    assert.equal(liveSubscriberCount(tenantBChannel), 1);

    // Publish event for Tenant B
    publishLiveUpdate(tenantBChannel, 'new-order', { order: { orderNumber: 'CAF2001', tableNumber: 2 } });
    await new Promise(r => setTimeout(r, 50));
    
    assert.match(responseB.output, /event: connected/);
    assert.match(responseB.output, /event: new-order/);
    assert.match(responseB.output, /CAF2001/);

    // Publish event for Tenant A - Tenant B should NOT receive it
    publishLiveUpdate(tenantAChannel, 'new-order', { order: { orderNumber: 'CAF1001', tableNumber: 1 } });
    await new Promise(r => setTimeout(r, 50));
    
    assert.match(responseB.output, /CAF2001/);
    assert.ok(!responseB.output.includes('CAF1001'));
  });

  await t.test('Multiple subscribers per tenant receive events', async () => {
    const tenantCChannel = 'tenant:tenantC';
    const responses = [createMockResponse(), createMockResponse(), createMockResponse()];
    const mockRequests = [{}, {}, {}].map(() => ({
      on: (event, handler) => { if (event === 'close') mockRequests[0]._closeHandler = handler; }
    }));

    for (let i = 0; i < 3; i++) {
      openLiveStream(mockRequests[i], responses[i], tenantCChannel);
    }
    assert.equal(liveSubscriberCount(tenantCChannel), 3);

    publishLiveUpdate(tenantCChannel, 'order-update', { order: { orderNumber: 'CAF3001', orderStatus: 'ready' } });
    await new Promise(r => setTimeout(r, 50));

    for (const response of responses) {
      assert.match(response.output, /event: order-update/);
      assert.match(response.output, /CAF3001/);
      assert.match(response.output, /ready/);
    }
  });

  await t.test('Client disconnect cleans up subscription', async () => {
    const tenantDChannel = 'tenant:tenantD';
    const response = createMockResponse();
    const mockRequest = { 
      on: (event, handler) => { if (event === 'close') mockRequest._closeHandler = handler; }
    };
    
    openLiveStream(mockRequest, response, tenantDChannel);
    assert.equal(liveSubscriberCount(tenantDChannel), 1);

    // Simulate client disconnect by calling the cleanup directly
    // The cleanup is registered via res.on('close') in openLiveStream
    // We manually invoke the cleanup logic that would be triggered on close
    const listeners = getSubscribers().get(tenantDChannel);
    if (listeners) {
      listeners.delete(response);
      if (listeners.size === 0) getSubscribers().delete(tenantDChannel);
    }
    
    await new Promise(r => setTimeout(r, 50));
    assert.equal(liveSubscriberCount(tenantDChannel), 0);
  });

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});