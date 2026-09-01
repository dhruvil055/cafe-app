import crypto from 'crypto';

export const validateOrderItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order items are required.');
  }

  return items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Item at index ${index} is invalid.`);
    }

    const price = Number(item.price);
    const quantity = Number(item.quantity);
    const itemTotal = Number(item.itemTotal);

    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Item "${item.name || 'Unknown'}" has an invalid price.`);
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Item "${item.name || 'Unknown'}" has an invalid quantity.`);
    }

    if (!Number.isFinite(itemTotal) || itemTotal < 0) {
      throw new Error(`Item "${item.name || 'Unknown'}" has an invalid item total.`);
    }

    const computedTotal = Number((price * quantity).toFixed(2));
    if (Math.abs(itemTotal - computedTotal) > 0.01) {
      throw new Error(`Item "${item.name || 'Unknown'}" itemTotal does not match price × quantity.`);
    }

    return {
      ...item,
      price,
      quantity,
      itemTotal,
    };
  });
};

export const normalizeOrderItems = (items = []) => {
  return validateOrderItems(items).map((item) => ({
    ...item,
    price: Number(item.price),
    quantity: Number(item.quantity),
    itemTotal: Number(item.itemTotal),
  }));
};

export const calculateOrderTotals = (items = []) => {
  const normalizedItems = normalizeOrderItems(items);
  const subtotal = normalizedItems.reduce((sum, item) => sum + Number(item.itemTotal || 0), 0);
  const taxRate = 5;
  const tax = Math.round(subtotal * taxRate / 100);
  const total = subtotal + tax;

  return { subtotal, tax, total, taxRate };
};

export const verifyRazorpaySignature = ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  keySecret,
}) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !keySecret) {
    return false;
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body)
    .digest('hex');

  const providedSignature = String(razorpay_signature).trim();
  if (providedSignature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSignature)
  );
};
