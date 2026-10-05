const subscribers = new Map();

export const getSubscribers = () => subscribers;

export const publishLiveUpdate = (channel, type, data = {}) => {
  const listeners = subscribers.get(channel);
  if (!listeners) return;
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const response of listeners) {
    if (!response.writableEnded) response.write(payload);
  }
};

const orderForLiveUpdate = (order) => {
  const source = typeof order?.toObject === 'function' ? order.toObject() : order;
  if (!source?._id) return null;
  const { _id, orderNumber, tableNumber, customer, items, subtotal, tax, total, paymentMethod, paymentStatus, cashVerificationStatus, orderStatus, createdAt, updatedAt } = source;
  return { _id, orderNumber, tableNumber, customer, items, subtotal, tax, total, paymentMethod, paymentStatus, cashVerificationStatus, orderStatus, createdAt, updatedAt };
};

export const publishNewOrder = (order) => {
  const safeOrder = orderForLiveUpdate(order);
  if (safeOrder) publishLiveUpdate('admin', 'new-order', { order: safeOrder });
};

export const publishOrderUpdate = (order) => {
  const safeOrder = orderForLiveUpdate(order);
  if (!safeOrder) return;
  publishLiveUpdate('admin', 'order-update', { order: safeOrder });
  publishLiveUpdate(`order:${safeOrder._id}`, 'order-update', { order: safeOrder });
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
