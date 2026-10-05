import mongoose from 'mongoose';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Table from '../models/Table.js';
import DiningBill from '../models/DiningBill.js';
import { createTableQrToken } from '../utils/tableQr.js';

dotenv.config();

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);

  const duplicates = await Order.aggregate([
    { $match: { idempotencyKey: { $type: 'string', $ne: '' } } },
    { $group: { _id: '$idempotencyKey', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]);
  if (duplicates.length) throw new Error('Duplicate order idempotency keys exist; resolve them before applying this migration.');

  const orderIndexes = await Order.collection.indexes();
  const oldIdempotencyIndex = orderIndexes.find((index) => index.key?.idempotencyKey === 1 && !index.unique);
  if (oldIdempotencyIndex) await Order.collection.dropIndex(oldIdempotencyIndex.name);
  await Order.collection.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true, name: 'idempotencyKey_1' });

  await Payment.createCollection().catch((error) => {
    if (error.codeName !== 'NamespaceExists') throw error;
  });
  const paymentIndexes = await Payment.collection.indexes();
  for (const field of ['orderId', 'diningBillId']) {
    const currentIndex = paymentIndexes.find((index) => index.key?.[field] === 1 && (!index.unique || !index.sparse));
    if (currentIndex) await Payment.collection.dropIndex(currentIndex.name);
  }
  await Payment.collection.createIndex({ orderId: 1 }, { unique: true, sparse: true, name: 'orderId_1' });
  await Payment.collection.createIndex({ diningBillId: 1 }, { unique: true, sparse: true, name: 'diningBillId_1' });
  await Payment.collection.createIndex({ idempotencyKey: 1 }, { unique: true, name: 'idempotencyKey_1' });
  await Payment.collection.createIndex({ razorpayOrderId: 1 }, { sparse: true, name: 'razorpayOrderId_1' });

  for await (const order of Order.find().cursor()) {
    const status = order.paymentStatus === 'paid'
      ? 'captured'
      : order.paymentStatus === 'failed'
        ? 'failed'
        : order.paymentStatus === 'cancelled'
          ? 'cancelled'
          : (order.razorpayOrderId ? 'created' : 'pending');
    await Payment.updateOne(
      { orderId: order._id },
      { $setOnInsert: {
        orderId: order._id,
        idempotencyKey: `order:${order._id}`,
        provider: order.paymentMethod,
        amount: order.total,
        currency: 'INR',
        status,
        razorpayOrderId: order.razorpayOrderId || '',
        razorpayPaymentId: order.razorpayPaymentId || '',
        capturedAt: order.paymentVerifiedAt || null,
      } },
      { upsert: true }
    );
  }

  for await (const bill of DiningBill.find({ razorpayOrderId: { $ne: '' } }).cursor()) {
    await Payment.updateOne(
      { diningBillId: bill._id },
      { $setOnInsert: {
        diningBillId: bill._id,
        idempotencyKey: `bill:${bill._id}`,
        provider: 'razorpay',
        amount: bill.dueAmount,
        currency: 'INR',
        status: bill.status === 'PAID' ? 'captured' : 'created',
        razorpayOrderId: bill.razorpayOrderId,
        razorpayPaymentId: bill.razorpayPaymentId || '',
        capturedAt: bill.paidAt || null,
      } },
      { upsert: true }
    );
  }

  const clientUrl = String(process.env.CUSTOMER_APP_URL || process.env.CLIENT_URL || 'https://cafe.infinigrowsoftech.com').replace(/\/$/, '');
  const tables = await Table.find();
  for (const table of tables) {
    const url = `${clientUrl}/menu?tableToken=${encodeURIComponent(createTableQrToken(table._id))}`;
    table.qrUrl = url;
    table.qrCode = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: '#1a0f08', light: '#FFFFFF' },
      errorCorrectionLevel: 'H',
    });
    await table.save();
  }

  console.log(`Phase 1 migration complete. Signed QR codes refreshed: ${tables.length}.`);
};

run()
  .catch((error) => {
    console.error(`Phase 1 migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
