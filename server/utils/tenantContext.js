import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';

const tenantStorage = new AsyncLocalStorage();

export const getTenantContext = () => tenantStorage.getStore() || null;

export const requireTenantId = () => {
  const context = getTenantContext();
  if (!context?.system && !context?.tenantId) {
    const error = new Error('A tenant context is required for this data access.');
    error.code = 'TENANT_CONTEXT_REQUIRED';
    error.status = 500;
    throw error;
  }
  return context?.tenantId || null;
};

export const runWithTenant = (tenantId, callback) => {
  if (!mongoose.isValidObjectId(tenantId)) throw new Error('A valid tenant ID is required.');
  return tenantStorage.run({ tenantId: new mongoose.Types.ObjectId(tenantId), system: false }, callback);
};

// Reserved for migrations and explicitly trusted platform jobs. Never use in HTTP handlers.
export const runWithSystemTenantAccess = (callback) => tenantStorage.run({ tenantId: null, system: true }, callback);

export const enterTenantContextForTests = (tenantId) => {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test tenant contexts are only available in NODE_ENV=test.');
  if (!mongoose.isValidObjectId(tenantId)) throw new Error('A valid tenant ID is required.');
  tenantStorage.enterWith({ tenantId: new mongoose.Types.ObjectId(tenantId), system: false });
};

const attachTenantToUpdate = (update, tenantId) => {
  if (!update || !tenantId) return;
  if (Array.isArray(update)) {
    const error = new Error('Update pipelines are not allowed for tenant-scoped writes.');
    error.code = 'TENANT_WRITE_REJECTED';
    error.status = 400;
    throw error;
  }
  const supplied = update.tenantId ?? update.$set?.tenantId ?? update.$setOnInsert?.tenantId;
  if (supplied && String(supplied) !== String(tenantId)) {
    const error = new Error('A write cannot change tenant ownership.');
    error.code = 'TENANT_MISMATCH';
    error.status = 404;
    throw error;
  }
  for (const [operator, values] of Object.entries(update)) {
    if (operator.startsWith('$') && operator !== '$setOnInsert' && values && Object.prototype.hasOwnProperty.call(values, 'tenantId')) {
      const error = new Error('A write cannot change tenant ownership.');
      error.code = 'TENANT_MISMATCH';
      error.status = 404;
      throw error;
    }
  }
  update.$setOnInsert ||= {};
  update.$setOnInsert.tenantId = tenantId;
  if (update.tenantId) delete update.tenantId;
}

export const tenantIsolationPlugin = (schema) => {
  schema.add({ tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true } });

  schema.pre(/^find|count|update|delete|replace|distinct/, function tenantQueryScope() {
    const context = getTenantContext();
    const tenantId = requireTenantId();
    if (context?.system) return;
    const requestedFilter = this.getFilter();
    this.setQuery({ $and: [requestedFilter, { tenantId }] });
    const operation = this.op;
    if (['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'].includes(operation)) {
      if (['replaceOne', 'findOneAndReplace'].includes(operation)) {
        const replacement = this.getUpdate();
        if (replacement?.tenantId && String(replacement.tenantId) !== String(tenantId)) throw Object.assign(new Error('A write cannot change tenant ownership.'), { code: 'TENANT_MISMATCH', status: 404 });
        replacement.tenantId = tenantId;
      } else attachTenantToUpdate(this.getUpdate(), tenantId);
    }
    if (this.getOptions().upsert && this.getUpdate()) attachTenantToUpdate(this.getUpdate(), tenantId);
  });

  schema.pre('aggregate', function tenantAggregateScope() {
    const context = getTenantContext();
    const tenantId = requireTenantId();
    if (!context?.system) this.pipeline().unshift({ $match: { tenantId } });
  });

  schema.pre('estimatedDocumentCount', function tenantEstimatedCountGuard(next) {
    try {
      requireTenantId();
      if (!getTenantContext()?.system) return next(Object.assign(new Error('Estimated collection counts are not available inside a tenant scope.'), { code: 'TENANT_SCOPE_REQUIRED', status: 400 }));
      next();
    } catch (error) { next(error); }
  });

  schema.pre('bulkWrite', function tenantBulkWriteScope(next, operations) {
    try {
      const tenantId = requireTenantId();
      if (tenantId) for (const operation of operations) {
        const [kind, value] = Object.entries(operation)[0] || [];
        if (!value) continue;
        if (kind === 'insertOne') {
          if (value.document.tenantId && String(value.document.tenantId) !== String(tenantId)) throw Object.assign(new Error('A write cannot change tenant ownership.'), { code: 'TENANT_MISMATCH', status: 404 });
          value.document.tenantId = tenantId;
        } else {
          value.filter ||= {};
          value.filter.tenantId = tenantId;
          if (kind === 'updateOne' || kind === 'updateMany') attachTenantToUpdate(value.update, tenantId);
          if (kind === 'replaceOne') {
            if (value.replacement.tenantId && String(value.replacement.tenantId) !== String(tenantId)) throw Object.assign(new Error('A write cannot change tenant ownership.'), { code: 'TENANT_MISMATCH', status: 404 });
            value.replacement.tenantId = tenantId;
          }
        }
      }
      next();
    } catch (error) { next(error); }
  });

  schema.pre('save', function tenantSaveScope(next) {
    try {
      const tenantId = requireTenantId();
      if (tenantId) {
        if (this.tenantId && String(this.tenantId) !== String(tenantId)) {
          const error = new Error('A write cannot change tenant ownership.');
          error.code = 'TENANT_MISMATCH';
          error.status = 404;
          return next(error);
        }
        this.tenantId = tenantId;
      }
      next();
    } catch (error) { next(error); }
  });

  schema.pre('validate', function tenantValidateScope(next) {
    try {
      const tenantId = requireTenantId();
      if (tenantId) {
        if (this.tenantId && String(this.tenantId) !== String(tenantId)) throw Object.assign(new Error('A write cannot change tenant ownership.'), { code: 'TENANT_MISMATCH', status: 404 });
        this.tenantId = tenantId;
      }
      next();
    } catch (error) { next(error); }
  });

  schema.pre('insertMany', function tenantInsertMany(next, docs) {
    try {
      const tenantId = requireTenantId();
      if (tenantId) for (const doc of docs) {
        if (doc.tenantId && String(doc.tenantId) !== String(tenantId)) throw Object.assign(new Error('A write cannot change tenant ownership.'), { code: 'TENANT_MISMATCH', status: 404 });
        doc.tenantId = tenantId;
      }
      next();
    } catch (error) { next(error); }
  });
};
