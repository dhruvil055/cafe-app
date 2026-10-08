import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Plus, Filter, Calendar, Trash2, Edit, Loader2,
  TrendingDown, Receipt, Search, X, CheckCircle2, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { formatMoney } from '../utils/money';

const CATEGORY_LABELS = {
  rent: '🏠 Rent & Lease',
  electricity: '⚡ Electricity & Power',
  water: '💧 Water & Sewage',
  salary: '👥 Staff Salaries',
  raw_material: '🥛 Raw Ingredients / Groceries',
  marketing: '📢 Marketing & Ads',
  maintenance: '🔧 Equipment Maintenance',
  internet: '🌐 Internet & Software',
  transport: '🚚 Transport & Logistics',
  other: '📦 Miscellaneous Other',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSpend, setTotalSpend] = useState(0);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals & Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [category, setCategory] = useState('raw_material');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptUrl, setReceiptUrl] = useState('');

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const { data } = await api.get(`/expenses?${params.toString()}`);
      setExpenses(data.expenses || []);
      setTotalSpend(data.totalSpend || 0);
      if (data.categories) setCategories(data.categories);
    } catch (error) {
      toast.error(error.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedCategory, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchExpenses();
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        category,
        amount: numAmount,
        description: description.trim(),
        paymentMethod,
        date,
        receiptUrl: receiptUrl.trim(),
      };

      if (editingExpense) {
        await api.put(`/expenses/${editingExpense._id}`, payload);
        toast.success('Expense updated');
      } else {
        await api.post('/expenses', payload);
        toast.success('Expense recorded');
      }

      setShowAddModal(false);
      setEditingExpense(null);
      resetForm();
      fetchExpenses();
    } catch (error) {
      toast.error(error.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCategory('raw_material');
    setAmount('');
    setDescription('');
    setPaymentMethod('cash');
    setDate(new Date().toISOString().split('T')[0]);
    setReceiptUrl('');
  };

  const handleEditClick = (exp) => {
    setEditingExpense(exp);
    setCategory(exp.category);
    setAmount(String(exp.amount));
    setDescription(exp.description || '');
    setPaymentMethod(exp.paymentMethod || 'cash');
    setDate(exp.date ? new Date(exp.date).toISOString().split('T')[0] : '');
    setReceiptUrl(exp.receiptUrl || '');
    setShowAddModal(true);
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense entry?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Expense removed');
      fetchExpenses();
    } catch (error) {
      toast.error(error.message || 'Failed to delete expense');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Spend Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm bg-gradient-to-br from-red-50/20 to-transparent">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span>Total Expenses</span>
            <TrendingDown size={16} className="text-red-500" />
          </div>
          <div className="text-3xl font-bold font-display text-espresso-950 mt-2">
            {formatMoney(totalSpend)}
          </div>
          <div className="text-xs text-stone-400 mt-1">{expenses.length} record(s) matching filter</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span>Active Categories</span>
            <Filter size={16} className="text-stone-400" />
          </div>
          <div className="text-3xl font-bold font-display text-espresso-900 mt-2">
            {new Set(expenses.map(e => e.category)).size}
          </div>
          <div className="text-xs text-stone-400 mt-1">Across operating expenditure</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span>Quick Action</span>
            <Receipt size={16} className="text-brew-500" />
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingExpense(null);
              setShowAddModal(true);
            }}
            className="btn-primary rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm mt-3"
          >
            <Plus size={15} /> Record New Expense
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 focus:outline-none focus:border-brew-500"
          >
            <option value="ALL">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="rounded-xl border border-stone-200 px-2.5 py-1 text-xs text-stone-700 bg-stone-50 focus:outline-none"
            title="Start date"
          />
          <span className="text-xs text-stone-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="rounded-xl border border-stone-200 px-2.5 py-1 text-xs text-stone-700 bg-stone-50 focus:outline-none"
            title="End date"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Clear Dates
            </button>
          )}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search description..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brew-500"
            />
          </div>
          <button type="submit" className="btn-secondary rounded-xl px-3 py-1.5 text-xs font-semibold">
            Search
          </button>
        </form>
      </div>

      {/* Expenses List Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center text-stone-400">
            <Loader2 className="animate-spin text-brew-500" size={28} />
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-16 text-center text-stone-400 text-sm">
            No expenses found matching the criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {expenses.map(exp => (
                  <tr key={exp._id} className="hover:bg-stone-50/60 transition">
                    <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                      {new Date(exp.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-stone-100 text-stone-800 border border-stone-200">
                        {CATEGORY_LABELS[exp.category] || exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-800 font-medium max-w-xs truncate">
                      {exp.description || '—'}
                    </td>
                    <td className="py-3 px-4 text-stone-500 uppercase font-medium">
                      {exp.paymentMethod || 'cash'}
                    </td>
                    <td className="py-3 px-4 text-right font-display font-bold text-red-600 text-sm whitespace-nowrap">
                      - {formatMoney(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(exp)}
                          className="p-1 text-stone-400 hover:text-stone-700"
                          title="Edit Expense"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp._id)}
                          className="p-1 text-stone-400 hover:text-red-500"
                          title="Delete Expense"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record / Edit Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-espresso-900">
                {editingExpense ? 'Edit Expense' : 'Record Operating Expense'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="1"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / QR</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="card">Debit/Credit Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                  Description / Vendor / Item Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Milk & dairy weekly bill, Electricity meter recharge"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                  Receipt / Invoice URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={receiptUrl}
                  onChange={e => setReceiptUrl(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold flex items-center gap-1.5"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingExpense ? 'Save Changes' : 'Record Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
