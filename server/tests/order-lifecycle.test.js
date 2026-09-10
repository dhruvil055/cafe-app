import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_TEST_URI || `mongodb://127.0.0.1:27017/cafe_lifecycle_test_${process.pid}`;
process.env.JWT_SECRET = 'integration-test-jwt-secret-with-more-than-32-bytes';

const { createApp } = await import('../index.js');
const { default: Category } = await import('../models/Category.js');
const { default: Product } = await import('../models/Product.js');
const { default: Table } = await import('../models/Table.js');
const { default: Order } = await import('../models/Order.js');
const { default: InventoryItem } = await import('../models/InventoryItem.js');
const { default: InventoryCategory } = await import('../models/InventoryCategory.js');
const { default: MenuInventoryMapping } = await import('../models/MenuInventoryMapping.js');
const { default: InventoryTransaction } = await import('../models/InventoryTransaction.js');
const { restoreForOrder, confirmOrderAndDeduct } = await import('../services/inventoryService.js');

test('order lifecycle, idempotency, and inventory restoration suite', async (t) => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();

  const app = createApp();
  const httpServer = app.listen(0);
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

  try {
    const table = await Table.create({ tableNumber: 5, seats: 4, active: true });
    const category = await Category.create({ name: 'Coffee Test', icon: '☕' });
    const invCat = await InventoryCategory.create({ name: 'Beans', icon: '🫘' });
    const invItem = await InventoryItem.create({
      name: 'Coffee Beans',
      category: invCat._id,
      unit: 'cup',
      currentQuantity: 20,
      minimumStock: 2,
    });
    const product = await Product.create({
      name: 'Test Espresso',
      price: 150,
      category: category._id,
      available: true,
    });
    await MenuInventoryMapping.create({
      product: product._id,
      inventoryItem: invItem._id,
      quantityRequired: 1,
      active: true,
    });

    await t.test('POST /api/orders with idempotencyKey returns identical order on retry without duplicate insertion', async () => {
      const idempotencyKey = 'client-unique-req-12345';
      const orderPayload = {
        tableNumber: 5,
        customer: { name: 'Alice', phone: '9123456780' },
        items: [{ productId: String(product._id), quantity: 2 }],
        paymentMethod: 'cash',
        idempotencyKey,
      };

      const res1 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });
      const data1 = await res1.json();
      assert.equal(res1.status, 201);
      assert.ok(data1.order);
      assert.ok(data1.accessToken);

      // Retry exact same order with same idempotencyKey
      const res2 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });
      const data2 = await res2.json();
      assert.equal(res2.status, 200);
      assert.equal(data2.idempotent, true);
      assert.equal(data2.order._id, data1.order._id);
      assert.equal(data2.accessToken, data1.accessToken);

      // Total orders in DB should be exactly 1
      const totalOrders = await Order.countDocuments({ idempotencyKey });
      assert.equal(totalOrders, 1);
    });

    await t.test('confirmOrderAndDeduct and restoreForOrder atomically manage inventory idempotently', async () => {
      const order = await Order.create({
        tableNumber: 5,
        customer: { name: 'Bob', phone: '9123456781' },
        items: [{
          product: product._id,
          name: product.name,
          price: product.price,
          quantity: 3,
          itemTotal: 450,
        }],
        subtotal: 450,
        tax: 22.5,
        total: 472.5,
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        accessTokenHash: 'dummyhash1234567890abcdef',
      });

      // Stock before confirmation: 20
      const stockBefore = await InventoryItem.findById(invItem._id);
      assert.equal(stockBefore.currentQuantity, 20);

      // Confirm order (deducts 3 cups)
      const confirmResult = await confirmOrderAndDeduct(order._id);
      assert.equal(confirmResult.deducted, true);

      const stockAfterDeduct = await InventoryItem.findById(invItem._id);
      assert.equal(stockAfterDeduct.currentQuantity, 17);

      // Calling confirmOrderAndDeduct again is idempotent (does NOT deduct again)
      const confirmRetry = await confirmOrderAndDeduct(order._id);
      assert.equal(confirmRetry.alreadyProcessed, true);
      const stockAfterRetry = await InventoryItem.findById(invItem._id);
      assert.equal(stockAfterRetry.currentQuantity, 17);

      // Cancel and restore inventory
      const restoreResult = await restoreForOrder(order._id);
      assert.equal(restoreResult.restored, true);

      const stockAfterRestore = await InventoryItem.findById(invItem._id);
      assert.equal(stockAfterRestore.currentQuantity, 20);

      // Calling restore again is idempotent (does NOT restore again)
      const restoreRetry = await restoreForOrder(order._id);
      assert.equal(restoreRetry.alreadyRestored, true);

      const stockFinal = await InventoryItem.findById(invItem._id);
      assert.equal(stockFinal.currentQuantity, 20);
    });
  } finally {
    await new Promise((resolve) => httpServer.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
