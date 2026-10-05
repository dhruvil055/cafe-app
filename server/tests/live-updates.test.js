import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import mongoose from 'mongoose';
import { openLiveStream, publishLiveUpdate, liveSubscriberCount } from '../services/liveUpdates.js';
import { calculateServerTotals, validateAndFetchProductPrices } from '../utils/orderSecurity.js';

test('SSE stream publishes named events and removes closed subscribers', () => {
  const request = new EventEmitter();
  const response = new EventEmitter();
  response.writableEnded = false;
  response.output = '';
  response.status = (code) => { response.statusCode = code; return response; };
  response.set = (headers) => { response.headers = headers; return response; };
  response.flushHeaders = () => {};
  response.write = (chunk) => { response.output += chunk; return true; };

  openLiveStream(request, response, 'test-channel');
  assert.equal(liveSubscriberCount('test-channel'), 1);
  publishLiveUpdate('test-channel', 'order-update', { order: { orderStatus: 'ready' } });
  assert.match(response.output, /event: connected/);
  assert.match(response.output, /event: order-update\ndata: \{"order":\{"orderStatus":"ready"\}\}/);
  response.emit('close');
  assert.equal(liveSubscriberCount('test-channel'), 0);
});

test('order validation retains bounded special instructions with server-selected variants and add-ons', async () => {
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();
  const addonId = new mongoose.Types.ObjectId();
  const product = {
    _id: productId,
    name: 'Latte',
    price: 100,
    image: '/latte.jpg',
    available: true,
    variants: [{ _id: variantId, name: 'Large', price: 140 }],
    addons: [{ _id: addonId, name: 'Oat Milk', price: 20 }],
  };
  const Product = { findById: async () => product };
  const instructions = `No sugar ${'please '.repeat(30)}`;
  const [item] = await validateAndFetchProductPrices([{
    productId: String(productId),
    quantity: 2,
    variantId: String(variantId),
    addonIds: [String(addonId)],
    specialInstructions: instructions,
    price: 0,
    itemTotal: 0,
  }], Product);

  assert.equal(item.price, 160);
  assert.equal(item.itemTotal, 320);
  assert.equal(item.specialInstructions.length, 120);
  assert.equal(calculateServerTotals([item]).total, 336);
});
