import mongoose from 'mongoose';
import { tenantIsolationPlugin, getTenantContext, requireTenantId } from '../utils/tenantContext.js';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, min: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
}, { versionKey: false });

counterSchema.pre(/^find|count|update|delete|replace|distinct/, function counterPrefixHook() {
  const context = getTenantContext();
  let tenantId = null;
  try {
    tenantId = requireTenantId();
  } catch {
    // Ignore tenant context missing error
  }
  if (!tenantId || context?.system) return;

  const tenantPrefix = `${tenantId}_`;
  const filter = this.getFilter();
  if (filter?._id && typeof filter._id === 'string' && !filter._id.startsWith(tenantPrefix)) {
    filter._id = `${tenantPrefix}${filter._id}`;
  }
  const update = this.getUpdate();
  if (update) {
    if (update.$setOnInsert?._id && typeof update.$setOnInsert._id === 'string' && !update.$setOnInsert._id.startsWith(tenantPrefix)) {
      update.$setOnInsert._id = `${tenantPrefix}${update.$setOnInsert._id}`;
    }
    if (update._id && typeof update._id === 'string' && !update._id.startsWith(tenantPrefix)) {
      update._id = `${tenantPrefix}${update._id}`;
    }
  }
});

counterSchema.plugin(tenantIsolationPlugin);
counterSchema.index({ tenantId: 1, _id: 1 }, { unique: true });

export default mongoose.model('Counter', counterSchema);
