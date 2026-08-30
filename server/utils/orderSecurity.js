import crypto from 'crypto';

/**
 * Generate a cryptographically secure access token for order retrieval.
 * Never expose the token itself to the database; store a hash instead.
 */
export const generateOrderAccessToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash an access token for secure storage.
 */
export const hashAccessToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Verify an access token against a stored hash.
 */
export const verifyAccessToken = (suppliedToken, storedHash) => {
  const suppliedHash = crypto.createHash('sha256').update(suppliedToken).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(suppliedHash),
    Buffer.from(storedHash)
  );
};

/**
 * Escape regex special characters to prevent ReDoS and NoSQL injection.
 */
export const escapeRegex = (value) => {
  if (!value) return '';
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Validate and fetch product prices from database.
 * Never trust client-supplied prices.
 */
export const validateAndFetchProductPrices = async (items, Product) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order items are required.');
  }

  if (items.length > 100) {
    throw new Error('Order cannot have more than 100 items.');
  }

  const validatedItems = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid item structure.');
    }

    const { productId, quantity, variantId, addonIds } = item;

    // Validate quantity
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
      throw new Error('Quantity must be an integer between 1 and 999.');
    }

    // Validate productId
    if (!productId || typeof productId !== 'string') {
      throw new Error('Product ID is required and must be a string.');
    }

    // Fetch product from database
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    if (!product.available) {
      throw new Error(`Product is not available: ${product.name}`);
    }

    let basePrice = product.price;
    let variant = null;
    let addons = [];

    // Validate and fetch variant if provided
    if (variantId) {
      variant = product.variants.find(v => String(v._id) === String(variantId));
      if (!variant) {
        throw new Error(`Invalid variant for product: ${product.name}`);
      }
      basePrice += variant.price;
    }

    // Validate and fetch addons if provided
    if (Array.isArray(addonIds) && addonIds.length > 0) {
      for (const addonId of addonIds) {
        const addon = product.addons.find(a => String(a._id) === String(addonId));
        if (!addon) {
          throw new Error(`Invalid addon for product: ${product.name}`);
        }
        addons.push(addon);
      }
    }

    // Calculate server-side total (never trust client)
    const addonPrice = addons.reduce((sum, a) => sum + a.price, 0);
    const itemTotal = Number(((basePrice + addonPrice) * qty).toFixed(2));

    validatedItems.push({
      productId,
      product: product._id,
      name: product.name,
      image: product.image,
      quantity: qty,
      basePrice,
      variant: variant ? { _id: variant._id, name: variant.name, price: variant.price } : null,
      addons,
      itemTotal,
    });
  }

  return validatedItems;
};

/**
 * Calculate order totals server-side.
 * Input: validated items with server-calculated prices.
 */
export const calculateServerTotals = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Items are required.');
  }

  const subtotal = Number(
    items.reduce((sum, item) => sum + item.itemTotal, 0).toFixed(2)
  );

  // 5% GST
  const tax = Number((subtotal * 0.05).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  return { subtotal, tax, total, taxRate: 5 };
};

/**
 * Verify Razorpay signature with constant-time comparison.
 */
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

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  } catch (e) {
    return false;
  }
};
