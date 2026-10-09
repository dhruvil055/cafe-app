import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Plus, Filter, Calendar, Trash2, Edit, Loader2,
  TrendingDown, Receipt, Search, X, CheckCircle2, AlertCircle,
  ExternalLink, PieChart as PieChartIcon, ArrowUpRight
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import toast from 'react-hot-toast';
import api from '../services/api';
import { formatMoney } from '../utils/money';
import { useTenant } from '../context/TenantContext';
import PageHeader from '../components/common/PageHeader';
import Drawer from '../components/common/Drawer';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import KpiCard from '../components/common/KpiCard';

const CATEGORY_META = {
  raw_material: { label: 'Raw Ingredients / Groceries', icon: '🥛', color: '#10B981' },
  rent: { label: 'Rent & Lease', icon: '🏠', color: '#F59E0B' },
  electricity: { label: 'Electricity & Power', icon: '⚡', color: '#F97316' },
  water: { label: 'Water & Utility', icon: '💧', color: '#06B6D4' },
  salary: { label: 'Staff Salaries', icon: '👥', color: '#6366F1' },
  marketing: { label: 'Marketing & Ads', icon: '📢', color: '#EC4899' },
  maintenance: { label: 'Equipment Maintenance', icon: '🔧', color: '#8B5CF6' },
  internet: { label: 'Internet & Software', icon: '🌐', color: '#3B82F6' },
  transport: { label: 'Transport & Logistics', icon: '🚚', color: '#14B8A6' },
  other: { label: 'Miscellaneous Other', icon: '📦', color: '#64748B' },
};

const PAYMENT_METHOD_LABELS = {
  cash: { label: 'Cash', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  upi: { label: 'UPI / QR', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  bank_transfer: { label: 'Bank Transfer', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  card: { label: 'Card', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  other: { label: 'Other', color: 'bg-stone-100 text-stone-700 border-stone-200' },
};

export default function ExpensesPage() {
  const tenant = useTenant();
  const currency = tenant?.currency || tenant?.settings?.currency || '₹';

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSpend, setTotalSpend] = useState(0);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilterPreset, setDateFilterPreset] = useState('ALL'); // 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals & Form
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [saving, setSaving] = useState(false);

  // Delete Confirm Dialog
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
      if (data.categories && data.categories.length > 0) {
        setCategories(data.categories);
      } else {
        setCategories(Object.keys(CATEGORY_META));
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedCategory, startDate, endDate]);

  // Handle Preset Changes
  const applyPreset = (preset) => {
    setDateFilterPreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'WEEK') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      setStartDate(sevenDaysAgo.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

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
        toast.success('Expense recorded successfully');
      }

      setShowDrawer(false);
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
    setDate(exp.date ? new Date(exp.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setReceiptUrl(exp.receiptUrl || '');
    setShowDrawer(true);
  };

  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/expenses/${expenseToDelete._id}`);
      toast.success('Expense removed');
      setExpenseToDelete(null);
      fetchExpenses();
    } catch (error) {
      toast.error(error.message || 'Failed to delete expense');
    } finally {
      setDeleting(false);
    }
  };

  // Compute category breakdown for Recharts donut
  const categoryChartData = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      const cat = e.category || 'other';
      map[cat] = (map[cat] || 0) + Number(e.amount || 0);
    });

    const entries = Object.entries(map).map(([key, value]) => ({
      key,
      name: CATEGORY_META[key]?.label || key,
      value: Math.round(value),
      color: CATEGORY_META[key]?.color || '#94A3B8',
    }));

    return entries.sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Compute top category
  const topCategory = categoryChartData[0] || null;

  // Average daily burn (rough estimate based on records date range)
  const avgExpense = useMemo(() => {
    if (expenses.length === 0) return 0;
    return Math.round(totalSpend / expenses.length);
  }, [expenses, totalSpend]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header with primary action */}
      <PageHeader
        title="Operating Expenses"
        subtitle="Track day-to-day café overheads, ingredients, utilities, and vendor payouts with full GST compliance"
        breadcrumbs={[
          { label: 'Finance', to: '/expenses' },
          { label: 'Operating Expenses' },
        ]}
        actions={
          <button
            onClick={() => {
              resetForm();
              setEditingExpense(null);
              setShowDrawer(true);
            }}
            className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} />
            <span>Record Expense</span>
          </button>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total Operating Expenses"
          value={formatMoney(totalSpend)}
          subtext={`${expenses.length} record(s) matching selected filter`}
          trend={expenses.length > 0 ? { direction: 'down', text: 'Expenditure Recorded' } : null}
          icon={TrendingDown}
          iconColor="text-red-500 bg-red-50"
        />

        <KpiCard
          title="Average Ticket Spend"
          value={formatMoney(avgExpense)}
          subtext="Per recorded voucher / invoice"
          trend={{ direction: 'neutral', text: 'Avg per entry' }}
          icon={Receipt}
          iconColor="text-brew-600 bg-brew-50"
        />

        <KpiCard
          title="Top Expense Category"
          value={topCategory ? topCategory.name.split('/')[0] : 'None'}
          subtext={
            topCategory && totalSpend > 0
              ? `${formatMoney(topCategory.value)} (${Math.round((topCategory.value / totalSpend) * 100)}% of total)`
              : 'No entries'
          }
          icon={PieChartIcon}
          iconColor="text-amber-600 bg-amber-50"
        />
      </div>

      {/* Donut Chart & Breakdown Card */}
      {categoryChartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-soft">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Donut */}
            <div className="relative w-full md:w-64 h-56 flex items-center justify-center shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`${currency} ${Number(val).toLocaleString('en-IN')}`, 'Spend']}
                    contentStyle={{
                      backgroundColor: '#1C120C',
                      borderColor: '#43281C',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Total</span>
                <span className="text-sm font-bold font-mono text-espresso-950">{formatMoney(totalSpend)}</span>
              </div>
            </div>

            {/* Category Bars / Chips */}
            <div className="flex-1 w-full space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                <span>Category Distribution</span>
                <span>Share of Spend</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categoryChartData.slice(0, 8).map((cat) => {
                  const pct = totalSpend > 0 ? Math.round((cat.value / totalSpend) * 100) : 0;
                  return (
                    <div
                      key={cat.key}
                      className="flex items-center justify-between p-2 rounded-xl border border-stone-100 bg-stone-50/60 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="font-medium text-stone-800 truncate">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-semibold text-stone-900">{formatMoney(cat.value)}</span>
                        <span className="text-[10px] text-stone-400 w-8 text-right font-medium">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-soft flex flex-wrap items-center justify-between gap-3">
        {/* Date presets & category */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="inline-flex rounded-xl bg-stone-100 p-0.5 text-xs font-medium text-stone-600">
            <button
              onClick={() => applyPreset('ALL')}
              className={`px-3 py-1 rounded-lg transition ${
                dateFilterPreset === 'ALL' ? 'bg-white text-espresso-900 font-semibold shadow-xs' : 'hover:text-stone-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => applyPreset('TODAY')}
              className={`px-3 py-1 rounded-lg transition ${
                dateFilterPreset === 'TODAY' ? 'bg-white text-espresso-900 font-semibold shadow-xs' : 'hover:text-stone-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => applyPreset('WEEK')}
              className={`px-3 py-1 rounded-lg transition ${
                dateFilterPreset === 'WEEK' ? 'bg-white text-espresso-900 font-semibold shadow-xs' : 'hover:text-stone-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => applyPreset('MONTH')}
              className={`px-3 py-1 rounded-lg transition ${
                dateFilterPreset === 'MONTH' ? 'bg-white text-espresso-900 font-semibold shadow-xs' : 'hover:text-stone-900'
              }`}
            >
              This Month
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white focus:outline-none focus:border-brew-500"
          >
            <option value="ALL">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_META[cat]?.label || cat}
              </option>
            ))}
          </select>

          {/* Custom Date Inputs */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1 text-xs">
            <Calendar size={13} className="text-stone-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setDateFilterPreset('CUSTOM');
                setStartDate(e.target.value);
              }}
              className="bg-transparent text-xs text-stone-700 focus:outline-none"
              title="Start Date"
            />
            <span className="text-stone-400 text-[10px]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setDateFilterPreset('CUSTOM');
                setEndDate(e.target.value);
              }}
              className="bg-transparent text-xs text-stone-700 focus:outline-none"
              title="End Date"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => applyPreset('ALL')}
                className="text-[11px] text-red-500 hover:text-red-700 font-medium ml-1"
                title="Clear date range"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search vendor / description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brew-500 focus:bg-white transition"
            />
          </div>
          <button type="submit" className="btn-secondary rounded-xl px-3 py-1.5 text-xs font-semibold">
            Search
          </button>
        </form>
      </div>

      {/* Expenses List Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-soft overflow-hidden">
        {loading ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center text-stone-400 gap-2">
            <Loader2 className="animate-spin text-brew-500" size={28} />
            <span className="text-xs">Loading operating expense records...</span>
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={TrendingDown}
            title="No expense records found"
            description="Record day-to-day café overheads like ingredients, rent, salaries, and repair bills to monitor your net profit margin."
            actionText="Record First Expense"
            onAction={() => {
              resetForm();
              setEditingExpense(null);
              setShowDrawer(true);
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description / Vendor</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-center">Receipt</th>
                  <th className="py-3 px-4 text-right">Amount ({currency})</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-sans">
                {expenses.map((exp) => {
                  const catMeta = CATEGORY_META[exp.category] || { label: exp.category, color: '#71717A' };
                  const methodMeta = PAYMENT_METHOD_LABELS[exp.paymentMethod] || {
                    label: exp.paymentMethod || 'Cash',
                    color: 'bg-stone-100 text-stone-700 border-stone-200',
                  };

                  return (
                    <tr key={exp._id} className="hover:bg-stone-50/60 transition">
                      <td className="py-3 px-4 text-stone-600 whitespace-nowrap font-medium">
                        {new Date(exp.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-stone-100 text-stone-800 border border-stone-200/80">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catMeta.color }} />
                          {catMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-800 font-medium max-w-xs truncate">
                        {exp.description || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${methodMeta.color}`}
                        >
                          {methodMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {exp.receiptUrl ? (
                          <a
                            href={exp.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brew-600 hover:text-brew-700 hover:underline"
                          >
                            <span>View</span>
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span className="text-stone-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-600 text-sm whitespace-nowrap tabular-nums">
                        - {formatMoney(exp.amount)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditClick(exp)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                            title="Edit Expense"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => setExpenseToDelete(exp)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Delete Expense"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick-add Drawer (Fixes Bug #16: replaces modal with slide-over drawer) */}
      <Drawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        title={editingExpense ? 'Edit Operating Expense' : 'Record Operating Expense'}
        subtitle="Log café expenditures with category, receipt reference, and tax tracking"
        width="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowDrawer(false)}
              className="btn-secondary rounded-xl px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="expense-form"
              disabled={saving}
              className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              <span>{editingExpense ? 'Save Changes' : 'Record Expense'}</span>
            </button>
          </div>
        }
      >
        <form id="expense-form" onSubmit={handleSaveExpense} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-stone-700 uppercase tracking-wider">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none bg-stone-50"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_META[cat]?.label || cat}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-stone-700 uppercase tracking-wider">
                Amount ({currency}) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-stone-700 uppercase tracking-wider">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none bg-stone-50"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI / QR</option>
                <option value="bank_transfer">Bank Transfer / NEFT</option>
                <option value="card">Debit / Credit Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-stone-700 uppercase tracking-wider">
              Date *
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-stone-700 uppercase tracking-wider">
              Description / Vendor Details
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Milk & dairy weekly bill (Amul 20L), Electricity meter recharge"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-stone-700 uppercase tracking-wider">
              Receipt / Invoice URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/... or image link"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-stone-400">
              Attach bill image or GST invoice link for accountant reconciliation.
            </p>
          </div>
        </form>
      </Drawer>

      {/* Confirm Delete Dialog (replaces window.confirm) */}
      <ConfirmDialog
        isOpen={Boolean(expenseToDelete)}
        title="Delete Expense Entry?"
        message={`Are you sure you want to delete this expense of ${formatMoney(expenseToDelete?.amount || 0)} for "${expenseToDelete?.description || expenseToDelete?.category}"? This will update operating P&L.`}
        confirmText="Delete Expense"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setExpenseToDelete(null)}
      />
    </div>
  );
}
