export const isProductScheduledAvailable = (product, now = new Date()) => {
  if (!product) return false;
  const startsAt = product.availableFrom ? new Date(product.availableFrom) : null;
  const endsAt = product.availableUntil ? new Date(product.availableUntil) : null;
  return (!startsAt || startsAt <= now) && (!endsAt || endsAt > now);
};
