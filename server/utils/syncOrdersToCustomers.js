import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';
import { normalizePhoneNumber } from './phoneNormalizer.js';

dotenv.config();

export const syncOrdersToCustomers = async () => {
  await connectDB();

  const orders = await Order.find().sort({ createdAt: 1 });
  console.log(`Found ${orders.length} orders to inspect.`);

  let created = 0;
  let updated = 0;

  for (const order of orders) {
    if (!order.customer?.phone) continue;
    const phone = normalizePhoneNumber(order.customer.phone);
    if (!phone) continue;

    const name = order.customer.name?.trim() || 'Guest Customer';
    let customer = await Customer.findOne({ phone });

    if (!customer) {
      customer = await Customer.create({
        name,
        phone,
        email: order.customer.email || '',
        marketingConsent: true,
        marketingConsentAt: order.createdAt || new Date(),
        firstOrderAt: order.createdAt || new Date(),
        lastOrderAt: order.createdAt || new Date(),
        totalOrders: 1,
        totalSpent: Number(order.total || 0),
        status: 'active',
      });
      created++;
    } else {
      customer.lastOrderAt = order.createdAt || customer.lastOrderAt || new Date();
      customer.totalOrders = (customer.totalOrders || 0) + 1;
      customer.totalSpent = (customer.totalSpent || 0) + Number(order.total || 0);
      if (name && (!customer.name || customer.name === 'Guest Customer' || customer.name === 'Guest')) {
        customer.name = name;
      }
      await customer.save();
      updated++;
    }

    await Order.collection.updateOne(
      { _id: order._id },
      { $set: { customerId: customer._id } }
    );
  }

  const total = await Customer.countDocuments();
  console.log(`Sync completed! Total customers: ${total} (Created: ${created}, Updated: ${updated})`);
  return { total, created, updated };
};

const isDirectRun = process.argv[1] && process.argv[1].includes('syncOrdersToCustomers.js');
if (isDirectRun) {
  syncOrdersToCustomers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Sync failed:', err);
      process.exit(1);
    });
}
