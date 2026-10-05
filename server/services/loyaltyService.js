import Order from '../models/Order.js';
import Customer from '../models/Customer.js';

// One point is earned per ₹100 of discounted food subtotal on successfully paid orders.
export const awardLoyaltyPoints = async (orderId, session) => {
  const order = await Order.findOne({ _id: orderId, paymentStatus: 'paid', loyaltyPointsAwarded: { $ne: true } }).session(session || null);
  if (!order) return null;
  const points = Math.floor(Math.max(0, order.subtotal - (order.discount || 0)) / 100);
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'paid', loyaltyPointsAwarded: { $ne: true } },
    { $set: { loyaltyPointsAwarded: true, loyaltyPointsEarned: points } },
    { new: true, session }
  );
  if (!claimed || !claimed.customerId) return claimed;
  await Customer.updateOne({ _id: claimed.customerId }, { $inc: { loyaltyPoints: points } }, { session });
  return claimed;
};

export const reverseLoyaltyPoints = async (orderId, session) => {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: 'refunded', loyaltyPointsAwarded: true, loyaltyPointsReversed: { $ne: true } },
    { $set: { loyaltyPointsReversed: true } },
    { new: true, session },
  );
  if (!order?.customerId || !order.loyaltyPointsEarned) return order;
  await Customer.updateOne({ _id: order.customerId }, { $inc: { loyaltyPoints: -order.loyaltyPointsEarned } }, { session });
  return order;
};
