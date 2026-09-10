/**
 * inventoryService.js
 *
 * Core inventory logic:
 *  - deductForOrder(orderId)       — atomic deduction after order confirmed
 *  - restoreForOrder(orderId)      — restore stock on order cancellation
 *  - checkAvailability(productIds) — returns max orderable qty per product
 *  - getInventoryStats()           — admin dashboard summary
 */

import mongoose from 'mongoose';
import Order from '../models/Order.js';
import InventoryItem from '../models/InventoryItem.js';
import MenuInventoryMapping from '../models/MenuInventoryMapping.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import Product from '../models/Product.js';

/**
 * Atomically confirm an order and deduct its single-use consumable inventory.
 * This is the SINGLE SOURCE OF TRUTH for order confirmation and inventory deduction.
 *
 * Enforces:
 * 1. ONLY non-confirmed -> confirmed triggers deduction.
 * 2. Idempotency: If inventory has already been consumed (inventoryProcessed: true or existing transaction),
 *    it does NOTHING to inventory.
 * 3. Pre-check: All mapped physical consumables are verified for available stock before confirming.
 * 4. Insufficient stock: If any consumable has insufficient quantity, throws an error with exact message,
 *    and the order is NOT confirmed.
 * 5. Atomicity: In MongoDB transaction, inventory quantities are decremented,
 *    inventory transactions are created, and order status is set to 'confirmed' with inventoryProcessed: true.
 *    Never allows Order=CONFIRMED with failed deduction, or Order!=CONFIRMED with deducted stock.
 *
 * @param {string|ObjectId} orderId
 * @param {Object} options
 * @param {Object} options.additionalUpdates - Extra fields to update on the order (e.g. paymentStatus, razorpay details)
 * @param {string|ObjectId} options.performedBy - User ID if performed by staff/admin
 * @returns {Promise<{ order: Object, deducted: boolean, alreadyProcessed: boolean }>}
 */
export const confirmOrderAndDeduct = async (orderId, { additionalUpdates = {}, performedBy = null } = {}) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const error = new Error(`Order ${orderId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  // Idempotency: If already confirmed AND inventory was already processed, do nothing to inventory.
  const existingTx = await InventoryTransaction.findOne({
    orderId: order._id,
    type: 'order_consumption',
  }).lean();

  if (order.inventoryProcessed || existingTx) {
    console.log(`[Inventory] Order ${order.orderNumber} already processed for inventory — skipping deduction.`);
    order.orderStatus = 'confirmed';
    if (!order.inventoryProcessed) {
      order.inventoryProcessed = true;
      order.inventoryProcessedAt = existingTx?.createdAt || new Date();
    }
    if (additionalUpdates && Object.keys(additionalUpdates).length > 0) {
      Object.assign(order, additionalUpdates);
    }
    await order.save();
    return { order, deducted: false, alreadyProcessed: true };
  }

  if (order.orderStatus === 'cancelled') {
    const err = new Error('Cannot confirm an order that has already been cancelled.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Gather all required consumable items across all order items
  const requiredMap = new Map(); // key: inventoryItemId -> { invId, name, unit, qtyNeeded, orderItemIds: [] }

  const validProductIds = (order.items || []).map(i => i.product).filter(Boolean);
  const mappings = validProductIds.length > 0
    ? await MenuInventoryMapping.find({
        product: { $in: validProductIds },
        active: true,
      }).populate('inventoryItem').lean()
    : [];

  const mappingsByProduct = new Map();
  for (const m of mappings) {
    const pid = String(m.product);
    if (!mappingsByProduct.has(pid)) mappingsByProduct.set(pid, []);
    mappingsByProduct.get(pid).push(m);
  }

  for (const item of order.items) {
    if (!item.product) continue;
    const itemMappings = mappingsByProduct.get(String(item.product)) || [];

    for (const mapping of itemMappings) {
      const inv = mapping.inventoryItem;
      if (!inv || !inv.active) continue;
      const needed = Number((mapping.quantityRequired * item.quantity).toFixed(6));
      if (needed <= 0) continue;

      const key = String(inv._id);
      if (requiredMap.has(key)) {
        const existing = requiredMap.get(key);
        existing.qtyNeeded = Number((existing.qtyNeeded + needed).toFixed(6));
        existing.orderItemIds.push(item._id);
      } else {
        requiredMap.set(key, {
          invId: inv._id,
          name: inv.name,
          unit: inv.unit || 'units',
          qtyNeeded: needed,
          orderItemIds: [item._id],
        });
      }
    }
  }

  // 2. Pre-check stock: verify ALL required consumable items have sufficient stock
  for (const [invId, req] of requiredMap.entries()) {
    const inv = await InventoryItem.findById(invId).lean();
    if (!inv || !inv.active) {
      const error = new Error(`Inventory item "${req.name}" is no longer active.`);
      error.statusCode = 400;
      error.code = 'INVENTORY_UNAVAILABLE';
      throw error;
    }

    if (inv.currentQuantity < req.qtyNeeded) {
      const error = new Error(
        `Insufficient inventory for ${req.name}. Only ${inv.currentQuantity} units are currently available.`
      );
      error.statusCode = 400;
      error.code = 'INSUFFICIENT_STOCK';
      error.details = {
        inventoryItem: req.name,
        available: inv.currentQuantity,
        needed: req.qtyNeeded,
        unit: req.unit,
      };
      throw error;
    }
  }

  // If order has no mapped consumables, simply confirm order idempotently
  if (requiredMap.size === 0) {
    order.orderStatus = 'confirmed';
    order.inventoryProcessed = true;
    order.inventoryProcessedAt = new Date();
    if (additionalUpdates && Object.keys(additionalUpdates).length > 0) {
      Object.assign(order, additionalUpdates);
    }
    await order.save();
    return { order, deducted: false, alreadyProcessed: false };
  }

  // 3. Atomically deduct inventory and confirm order in a MongoDB Transaction
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [invId, req] of requiredMap.entries()) {
        const updated = await InventoryItem.findOneAndUpdate(
          {
            _id: invId,
            active: true,
            currentQuantity: { $gte: req.qtyNeeded },
          },
          {
            $inc: { currentQuantity: -req.qtyNeeded },
          },
          { new: true, session }
        );

        if (!updated) {
          const current = await InventoryItem.findById(invId).session(session);
          const avail = current ? current.currentQuantity : 0;
          const err = new Error(
            `Insufficient inventory for ${req.name}. Only ${avail} units are currently available.`
          );
          err.statusCode = 400;
          err.code = 'INSUFFICIENT_STOCK';
          throw err;
        }

        const balanceBefore = Number((updated.currentQuantity + req.qtyNeeded).toFixed(6));
        const balanceAfter = Number(updated.currentQuantity.toFixed(6));

        await InventoryTransaction.create([{
          inventoryItem: invId,
          type: 'order_consumption',
          quantity: -req.qtyNeeded,
          balanceBefore,
          balanceAfter,
          orderId: order._id,
          orderItemId: req.orderItemIds[0] || null,
          reference: order.orderNumber,
          reason: `Auto-deducted for confirmed order ${order.orderNumber}`,
          performedBy,
        }], { session });
      }

      // Mark order as confirmed and inventoryProcessed = true within the exact same transaction
      order.orderStatus = 'confirmed';
      order.inventoryProcessed = true;
      order.inventoryProcessedAt = new Date();
      if (additionalUpdates && Object.keys(additionalUpdates).length > 0) {
        Object.assign(order, additionalUpdates);
      }
      await order.save({ session });
    });
  } catch (txError) {
    if (txError.message && txError.message.includes('Transaction numbers are only allowed on a replica set')) {
      // Non-replica standalone fallback
      await executeNonReplicaFallback({ order, requiredMap, additionalUpdates, performedBy });
    } else {
      throw txError;
    }
  } finally {
    await session.endSession();
  }

  // Sync product availability based on latest inventory levels
  await syncProductAvailability(order.items.map(i => i.product).filter(Boolean));

  console.log(`[Inventory] Successfully confirmed order ${order.orderNumber} and deducted consumables.`);
  return { order, deducted: true, alreadyProcessed: false };
};

/**
 * Fallback atomic execution for local non-replica environments with manual rollback.
 */
async function executeNonReplicaFallback({ order, requiredMap, additionalUpdates, performedBy }) {
  const decremented = []; // { invId, qty, updated, req }
  try {
    for (const [invId, req] of requiredMap.entries()) {
      const updated = await InventoryItem.findOneAndUpdate(
        {
          _id: invId,
          active: true,
          currentQuantity: { $gte: req.qtyNeeded },
        },
        {
          $inc: { currentQuantity: -req.qtyNeeded },
        },
        { new: true }
      );

      if (!updated) {
        const current = await InventoryItem.findById(invId);
        const avail = current ? current.currentQuantity : 0;
        const err = new Error(
          `Insufficient inventory for ${req.name}. Only ${avail} units are currently available.`
        );
        err.statusCode = 400;
        err.code = 'INSUFFICIENT_STOCK';
        throw err;
      }

      decremented.push({ invId, qty: req.qtyNeeded, updated, req });
    }

    // Record transactions
    for (const item of decremented) {
      const balanceBefore = Number((item.updated.currentQuantity + item.qty).toFixed(6));
      const balanceAfter = Number(item.updated.currentQuantity.toFixed(6));
      await InventoryTransaction.create({
        inventoryItem: item.invId,
        type: 'order_consumption',
        quantity: -item.qty,
        balanceBefore,
        balanceAfter,
        orderId: order._id,
        orderItemId: item.req.orderItemIds[0] || null,
        reference: order.orderNumber,
        reason: `Auto-deducted for confirmed order ${order.orderNumber}`,
        performedBy,
      });
    }

    order.orderStatus = 'confirmed';
    order.inventoryProcessed = true;
    order.inventoryProcessedAt = new Date();
    if (additionalUpdates && Object.keys(additionalUpdates).length > 0) {
      Object.assign(order, additionalUpdates);
    }
    await order.save();
  } catch (error) {
    // Rollback any items that were already decremented
    for (const item of decremented) {
      await InventoryItem.findByIdAndUpdate(item.invId, {
        $inc: { currentQuantity: item.qty },
      }).catch(() => {});
    }
    throw error;
  }
}

/**
 * Backwards compatibility alias for confirmOrderAndDeduct.
 */
export const deductForOrder = async (orderId, options = {}) => {
  return confirmOrderAndDeduct(orderId, options);
};

/**
 * Restore inventory for a cancelled order.
 * If inventory was deducted for the order and the order is cancelled,
 * restores stock atomically and records an 'order_restoration' transaction.
 * Idempotent: Can be called multiple times without duplicate restoration.
 */
export const restoreForOrder = async (orderId, { performedBy = null, reason = 'Order cancelled' } = {}) => {
  const order = await Order.findById(orderId);
  if (!order) {
    const error = new Error(`Order ${orderId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  // If inventory was never deducted, or already restored, do nothing
  if (!order.inventoryProcessed) {
    return { order, restored: false, reason: 'Inventory was not deducted for this order.' };
  }

  if (order.inventoryRestored) {
    console.log(`[Inventory] Order ${order.orderNumber} inventory was already restored.`);
    return { order, restored: false, alreadyRestored: true };
  }

  // Check if an order_restoration transaction already exists for this order
  const existingRestoreTx = await InventoryTransaction.findOne({
    orderId: order._id,
    type: 'order_restoration',
  }).lean();

  if (existingRestoreTx) {
    order.inventoryRestored = true;
    order.inventoryRestoredAt = existingRestoreTx.createdAt || new Date();
    await order.save();
    return { order, restored: false, alreadyRestored: true };
  }

  // Find all consumption records for this order
  const consumptionTxs = await InventoryTransaction.find({
    orderId: order._id,
    type: 'order_consumption',
  }).lean();

  if (!consumptionTxs.length) {
    order.inventoryRestored = true;
    await order.save();
    return { order, restored: false, reason: 'No consumption records found.' };
  }

  for (const tx of consumptionTxs) {
    const qtyToRestore = Math.abs(tx.quantity);
    if (qtyToRestore <= 0) continue;

    const updated = await InventoryItem.findByIdAndUpdate(
      tx.inventoryItem,
      { $inc: { currentQuantity: qtyToRestore } },
      { new: true }
    );

    if (updated) {
      const balanceBefore = Number((updated.currentQuantity - qtyToRestore).toFixed(6));
      const balanceAfter = Number(updated.currentQuantity.toFixed(6));

      await InventoryTransaction.create({
        inventoryItem: tx.inventoryItem,
        type: 'order_restoration',
        quantity: qtyToRestore,
        balanceBefore,
        balanceAfter,
        orderId: order._id,
        orderItemId: tx.orderItemId || null,
        reference: order.orderNumber,
        reason: reason || `Restored for cancelled order ${order.orderNumber}`,
        performedBy,
      });
    }
  }

  order.inventoryRestored = true;
  order.inventoryRestoredAt = new Date();
  await order.save();

  // Sync availability
  await syncProductAvailability(order.items.map(i => i.product).filter(Boolean));
  console.log(`[Inventory] Successfully restored inventory for cancelled order ${order.orderNumber}.`);
  return { order, restored: true };
};

/**
 * Check how many units of each product can be ordered based on inventory.
 * Returns a map: { productId: maxOrderableQty }
 * If a product has no mappings, it returns Infinity (no inventory constraint).
 */
export const checkAvailability = async (productIds) => {
  const result = {};
  if (!productIds || productIds.length === 0) return result;

  // Single batched query for all products instead of N individual round-trips
  const mappings = await MenuInventoryMapping.find({
    product: { $in: productIds },
    active: true,
  }).populate('inventoryItem', 'currentQuantity active').lean();

  const mappingsByProduct = new Map();
  for (const m of mappings) {
    const pid = String(m.product);
    if (!mappingsByProduct.has(pid)) mappingsByProduct.set(pid, []);
    mappingsByProduct.get(pid).push(m);
  }

  for (const productId of productIds) {
    const pid = String(productId);
    const pMappings = mappingsByProduct.get(pid);

    if (!pMappings || pMappings.length === 0) {
      result[pid] = Infinity;
      continue;
    }

    let maxQty = Infinity;
    for (const mapping of pMappings) {
      if (!mapping.inventoryItem || !mapping.inventoryItem.active) {
        // If the mapped item is inactive, treat as zero
        maxQty = 0;
        break;
      }
      if (mapping.quantityRequired <= 0) continue;
      const canMake = Math.floor(mapping.inventoryItem.currentQuantity / mapping.quantityRequired);
      if (canMake < maxQty) maxQty = canMake;
    }

    result[pid] = maxQty === Infinity ? Infinity : Math.max(0, maxQty);
  }

  return result;
};

/**
 * Validate that sufficient inventory exists for a list of order items (pre-order check).
 * Returns an array of validation errors (empty = all good).
 */
export const validateInventoryForOrder = async (items) => {
  const errors = [];
  const validProductIds = (items || []).map(i => i.product).filter(Boolean);
  if (validProductIds.length === 0) return errors;

  // Single batched query
  const mappings = await MenuInventoryMapping.find({
    product: { $in: validProductIds },
    active: true,
  }).populate('inventoryItem', 'name currentQuantity unit active').lean();

  const mappingsByProduct = new Map();
  for (const m of mappings) {
    const pid = String(m.product);
    if (!mappingsByProduct.has(pid)) mappingsByProduct.set(pid, []);
    mappingsByProduct.get(pid).push(m);
  }

  for (const item of items) {
    if (!item.product) continue;
    const pMappings = mappingsByProduct.get(String(item.product)) || [];

    for (const mapping of pMappings) {
      if (!mapping.inventoryItem || !mapping.inventoryItem.active) continue;
      const needed = mapping.quantityRequired * item.quantity;
      if (mapping.inventoryItem.currentQuantity < needed) {
        errors.push({
          productId: item.product,
          inventoryItem: mapping.inventoryItem.name,
          needed,
          available: mapping.inventoryItem.currentQuantity,
          unit: mapping.inventoryItem.unit,
        });
      }
    }
  }

  return errors;
};

/**
 * Sync Product.available based on whether all mapped inventory items have stock.
 * Called after deductions and restorations.
 */
export const syncProductAvailability = async (productIds) => {
  const validIds = (productIds || []).filter(Boolean);
  if (validIds.length === 0) return;

  // Single batched query
  const mappings = await MenuInventoryMapping.find({
    product: { $in: validIds },
    active: true,
  }).populate('inventoryItem', 'currentQuantity active').lean();

  const mappingsByProduct = new Map();
  for (const m of mappings) {
    const pid = String(m.product);
    if (!mappingsByProduct.has(pid)) mappingsByProduct.set(pid, []);
    mappingsByProduct.get(pid).push(m);
  }

  const updates = [];
  for (const productId of validIds) {
    const pid = String(productId);
    const pMappings = mappingsByProduct.get(pid);
    if (!pMappings || pMappings.length === 0) continue;

    const hasStock = pMappings.every(m =>
      m.inventoryItem && m.inventoryItem.active && m.inventoryItem.currentQuantity >= m.quantityRequired
    );

    updates.push(Product.findByIdAndUpdate(productId, { available: hasStock }));
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }
};

/**
 * Admin dashboard stats.
 */
export const getInventoryStats = async () => {
  const [items, totalValue] = await Promise.all([
    InventoryItem.find({ active: true }).lean(),
    InventoryItem.aggregate([
      { $match: { active: true } },
      { $group: { _id: null, total: { $sum: { $multiply: ['$currentQuantity', '$costPerUnit'] } } } },
    ]),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayConsumption = await InventoryTransaction.aggregate([
    { $match: { type: 'order_consumption', createdAt: { $gte: today } } },
    { $group: { _id: '$inventoryItem', totalConsumed: { $sum: { $abs: '$quantity' } } } },
  ]);

  return {
    totalItems: items.length,
    totalUnits: items.reduce((acc, i) => acc + (i.currentQuantity || 0), 0),
    totalStockValue: Number((totalValue[0]?.total || 0).toFixed(2)),
    lowStockCount: items.filter(i => i.currentQuantity > 0 && i.minimumStock > 0 && i.currentQuantity <= i.minimumStock).length,
    outOfStockCount: items.filter(i => i.currentQuantity <= 0).length,
    todayConsumptionCount: todayConsumption.length,
  };
};
