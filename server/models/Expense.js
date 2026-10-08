import mongoose from 'mongoose';
import { tenantIsolationPlugin } from '../utils/tenantContext.js';

export const EXPENSE_CATEGORIES = [
  'rent',
  'electricity',
  'water',
  'salary',
  'raw_material',
  'marketing',
  'maintenance',
  'internet',
  'transport',
  'other',
];

const expenseSchema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  category: {
    type: String,
    required: true,
    enum: EXPENSE_CATEGORIES,
    default: 'other',
  },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now, index: true },
  description: { type: String, default: '', trim: true },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'card', 'other'],
    default: 'cash',
  },
  receiptUrl: { type: String, default: '', trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

expenseSchema.index({ tenantId: 1, date: -1 });
expenseSchema.index({ tenantId: 1, category: 1, date: -1 });
expenseSchema.index({ tenantId: 1, branchId: 1, date: -1 });

expenseSchema.plugin(tenantIsolationPlugin);
export default mongoose.model('Expense', expenseSchema);
