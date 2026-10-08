import crypto from 'crypto';
import Redis from 'ioredis';

const INSTANCE_ID = crypto.randomUUID();
const REDIS_CHANNEL = 'brewhaus:live_events';

const subscribers = new Map();

let redisPublisher = null;
let redisSubscriber = null;

// Initialize Redis Pub/Sub if REDIS_URL or REDIS_HOST is provided
if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  try {
    const redisConfig = process.env.REDIS_URL || {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    };

    redisPublisher = new Redis(redisConfig);
    redisSubscriber = new Redis(redisConfig);

    redisPublisher.on('error', (err) => {
      console.warn('[Redis Pub/Sub] Publisher connection notice:', err.message);
    });

    redisSubscriber.on('error', (err) => {
      console.warn('[Redis Pub/Sub] Subscriber connection notice:', err.message);
    });

    redisSubscriber.subscribe(REDIS_CHANNEL, (err) => {
      if (err) {
        console.warn('[Redis Pub/Sub] Subscription error:', err.message);
      } else {
        console.log(`[Redis Pub/Sub] Instance ${INSTANCE_ID} subscribed to ${REDIS_CHANNEL}`);
      }
    });

    redisSubscriber.on('message', (channel, message) => {
      if (channel !== REDIS_CHANNEL) return;
      try {
        const payload = JSON.parse(message);
        if (payload.originId === INSTANCE_ID) return; // Ignore own published messages
        dispatchToLocalSubscribers(payload.channel, payload.type, payload.data);
      } catch (err) {
        console.error('[Redis Pub/Sub] Failed to parse cross-instance message:', err.message);
      }
    });
  } catch (err) {
    console.warn('[Redis Pub/Sub] Initialization skipped, running in-memory:', err.message);
  }
}

const dispatchToLocalSubscribers = (channel, type, data = {}) => {
  const listeners = subscribers.get(channel);
  if (!listeners) return;
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const response of listeners) {
    if (!response.writableEnded) response.write(payload);
  }
};

export const getSubscribers = () => subscribers;

export const publishLiveUpdate = (channel, type, data = {}) => {
  // 1. Dispatch locally on this instance
  dispatchToLocalSubscribers(channel, type, data);

  // 2. Broadcast to other backend instances via Redis if connected
  if (redisPublisher && redisPublisher.status === 'ready') {
    try {
      const message = JSON.stringify({
        originId: INSTANCE_ID,
        channel,
        type,
        data,
      });
      redisPublisher.publish(REDIS_CHANNEL, message).catch(() => {
        // Ignore publish error
      });
    } catch (_) {
      // Ignore publish error
    }
  }
};

export const getRedisClients = () => ({ publisher: redisPublisher, subscriber: redisSubscriber });

const orderForLiveUpdate = (order) => {
  const source = typeof order?.toObject === 'function' ? order.toObject() : order;
  if (!source?._id) return null;
  const {
    _id,
    orderNumber,
    tableNumber,
    branchId,
    customer,
    items,
    subtotal,
    tax,
    total,
    paymentMethod,
    paymentStatus,
    cashVerificationStatus,
    orderStatus,
    createdAt,
    updatedAt,
  } = source;
  return {
    _id,
    orderNumber,
    tableNumber,
    branchId,
    customer,
    items,
    subtotal,
    tax,
    total,
    paymentMethod,
    paymentStatus,
    cashVerificationStatus,
    orderStatus,
    createdAt,
    updatedAt,
  };
};

// Event Publishers
export const publishNewOrder = (order) => {
  const safeOrder = orderForLiveUpdate(order);
  if (!safeOrder) return;
  publishLiveUpdate('admin', 'new-order', { order: safeOrder });
  if (safeOrder.branchId) {
    publishLiveUpdate(`branch:${safeOrder.branchId}`, 'new-order', { order: safeOrder });
  }
};

export const publishOrderUpdate = (order) => {
  const safeOrder = orderForLiveUpdate(order);
  if (!safeOrder) return;
  publishLiveUpdate('admin', 'order-update', { order: safeOrder });
  publishLiveUpdate(`order:${safeOrder._id}`, 'order-update', { order: safeOrder });
  if (safeOrder.branchId) {
    publishLiveUpdate(`branch:${safeOrder.branchId}`, 'order-update', { order: safeOrder });
  }
};

export const publishPaymentUpdate = (payment) => {
  const data = typeof payment?.toObject === 'function' ? payment.toObject() : payment;
  publishLiveUpdate('admin', 'payment-update', { payment: data });
  if (data?.orderId) {
    publishLiveUpdate(`order:${data.orderId}`, 'payment-update', { payment: data });
  }
};

export const publishKdsUpdate = (kdsData) => {
  publishLiveUpdate('kitchen', 'kds-update', kdsData);
  publishLiveUpdate('admin', 'kds-update', kdsData);
  if (kdsData?.branchId) {
    publishLiveUpdate(`branch:${kdsData.branchId}`, 'kds-update', kdsData);
  }
};

export const publishTableStatus = (table) => {
  const data = typeof table?.toObject === 'function' ? table.toObject() : table;
  publishLiveUpdate('admin', 'table-status', { table: data });
  publishLiveUpdate('floor', 'table-status', { table: data });
  if (data?.branchId) {
    publishLiveUpdate(`branch:${data.branchId}`, 'table-status', { table: data });
  }
};

export const publishInventoryUpdate = (inventoryItem) => {
  const data = typeof inventoryItem?.toObject === 'function' ? inventoryItem.toObject() : inventoryItem;
  publishLiveUpdate('admin', 'inventory-update', { inventoryItem: data });
  if (data?.branchId) {
    publishLiveUpdate(`branch:${data.branchId}`, 'inventory-update', { inventoryItem: data });
  }
};

export const publishServiceRequest = (request) => {
  const data = typeof request?.toObject === 'function' ? request.toObject() : request;
  publishLiveUpdate('admin', 'service-request', { request: data });
  publishLiveUpdate('waiter', 'service-request', { request: data });
  if (data?.branchId) {
    publishLiveUpdate(`branch:${data.branchId}`, 'service-request', { request: data });
  }
};

export const publishNotification = (notification, targetChannel = 'admin') => {
  publishLiveUpdate(targetChannel, 'notification', { notification });
};

export const publishBillUpdate = (bill) => {
  const data = typeof bill?.toObject === 'function' ? bill.toObject() : bill;
  publishLiveUpdate('admin', 'bill-updated', { bill: data });
  if (data?.tableNumber) {
    publishLiveUpdate(`table:${data.tableNumber}`, 'bill-updated', { bill: data });
  }
  if (data?.branchId) {
    publishLiveUpdate(`branch:${data.branchId}`, 'bill-updated', { bill: data });
  }
};

export const openLiveStream = (req, res, channel) => {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.write('retry: 3000\nevent: connected\ndata: {}\n\n');

  const listeners = subscribers.get(channel) || new Set();
  listeners.add(res);
  subscribers.set(channel, listeners);
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': keep-alive\n\n');
  }, 25000);
  heartbeat.unref?.();

  const cleanup = () => {
    clearInterval(heartbeat);
    listeners.delete(res);
    if (listeners.size === 0) subscribers.delete(channel);
  };
  res.on('close', cleanup);
};

export const liveSubscriberCount = (channel) => subscribers.get(channel)?.size || 0;
