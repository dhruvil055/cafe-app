import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, PackagePlus, SlidersHorizontal, Trash2, 
  RefreshCw, TrendingDown, AlertTriangle, CheckCircle2, 
  XCircle, Clock, Calendar, User, FileText, Loader2, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const UNIT_LABELS = {
  piece: 'pcs', cup: 'cups', glass: 'glasses', bottle: 'bottles',
  gram: 'g', kilogram: 'kg', millilitre: 'ml', litre: 'L',
  pack: 'packs', box: 'boxes', unit: 'units',
};

const TYPE_CONFIG = {
  purchase: { label: 'Purchase', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  manual_addition: { label: 'Manual Add', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  order_consumption: { label: 'Order Sale', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  order_restoration: { label: 'Order Cancel', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  waste: { label: 'Waste', bg: 'bg-red-50 text-red-700 border-red-200' },
  damaged: { label: 'Damaged', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  adjustment: { label: 'Adjustment', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  return: { label: 'Return', bg: 'bg-stone-100 text-stone-700 border-stone-200' },
  correction: { label: 'Correction', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

function StatusBadge({ item }) {
  if (item.currentQuantity <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-200">
        <XCircle size={14} /> Out of Stock
      </span>
    );
  }
  if (item.minimumStock > 0 && item.currentQuantity <= item.minimumStock) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
        <AlertTriangle size={14} /> Low Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
      <CheckCircle2 size={14} /> In Stock
    </span>
  );
}

const EMPTY_STOCK_FORM = { quantity: '', costPerUnit: '', supplier: '', reason: '', notes: '' };
const EMPTY_ADJUST_FORM = { adjustment: '', reason: '', notes: '' };
const EMPTY_WASTE_FORM = { quantity: '', type: 'waste', reason: 'Damaged', notes: '' };
const WASTE_REASONS = ['Damaged', 'Expired', 'Spilled', 'Broken', 'Incorrect preparation', 'Other'];

export default function InventoryItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockForm, setStockForm] = useState(EMPTY_STOCK_FORM);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState(EMPTY_ADJUST_FORM);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteForm, setWasteForm] = useState(EMPTY_WASTE_FORM);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/inventory/items/${id}`);
      setData(res.data);
    } catch (e) {
      toast.error(e.message || 'Failed to load item detail');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!stockForm.quantity || Number(stockForm.quantity) <= 0) {
      return toast.error('Enter a valid positive quantity');
    }
    setSaving(true);
    try {
      await api.post('/inventory/stock/add', {
        itemId: id,
        quantity: Number(stockForm.quantity),
        costPerUnit: stockForm.costPerUnit ? Number(stockForm.costPerUnit) : undefined,
        supplier: stockForm.supplier || undefined,
        notes: stockForm.notes || undefined,
      });
      toast.success('Stock added successfully');
      setShowStockModal(false);
      setStockForm(EMPTY_STOCK_FORM);
      fetchDetail();
    } catch (err) {
      toast.error(err.message || 'Failed to add stock');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!adjustForm.adjustment || Number(adjustForm.adjustment) === 0) {
      return toast.error('Adjustment amount cannot be zero');
    }
    if (!adjustForm.reason) {
      return toast.error('Please specify a reason for adjustment');
    }
    setSaving(true);
    try {
      await api.post('/inventory/stock/adjust', {
        itemId: id,
        adjustment: Number(adjustForm.adjustment),
        reason: adjustForm.reason,
        notes: adjustForm.notes || undefined,
      });
      toast.success('Stock adjusted');
      setShowAdjustModal(false);
      setAdjustForm(EMPTY_ADJUST_FORM);
      fetchDetail();
    } catch (err) {
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordWaste = async (e) => {
    e.preventDefault();
    if (!wasteForm.quantity || Number(wasteForm.quantity) <= 0) {
      return toast.error('Enter valid waste quantity');
    }
    setSaving(true);
    try {
      await api.post('/inventory/stock/waste', {
        itemId: id,
        quantity: Number(wasteForm.quantity),
        type: wasteForm.type,
        reason: wasteForm.reason,
        notes: wasteForm.notes || undefined,
      });
      toast.success('Waste recorded');
      setShowWasteModal(false);
      setWasteForm(EMPTY_WASTE_FORM);
      fetchDetail();
    } catch (err) {
      toast.error(err.message || 'Failed to record waste');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-espresso-600" />
      </div>
    );
  }

  if (!data?.item) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
        <p className="text-stone-500">Item not found.</p>
        <Link to="/inventory/items" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brew-600 hover:underline">
          <ArrowLeft size={16} /> Back to inventory
        </Link>
      </div>
    );
  }

  const { item, consumption, transactions } = data;
  const unitLabel = UNIT_LABELS[item.unit] || item.unit;
  const stockValue = (item.currentQuantity * (item.costPerUnit || 0)).toFixed(2);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/inventory/items"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{item.category?.icon || '📦'}</span>
              <h2 className="font-display text-2xl font-bold text-espresso-900">{item.name}</h2>
              <StatusBadge item={item} />
            </div>
            <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
              <span>Category: <strong className="text-stone-700">{item.category?.name || 'Uncategorized'}</strong></span>
              {item.sku && <span>• SKU: <span className="font-mono">{item.sku}</span></span>}
              {item.supplier && <span>• Supplier: <span className="text-stone-700">{item.supplier}</span></span>}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setStockForm({ ...EMPTY_STOCK_FORM, costPerUnit: item.costPerUnit || '' });
              setShowStockModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <PackagePlus size={15} /> Add Stock
          </button>
          <button
            onClick={() => setShowAdjustModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50 transition"
          >
            <SlidersHorizontal size={15} /> Adjust
          </button>
          <button
            onClick={() => setShowWasteModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-100 transition"
          >
            <Trash2 size={15} /> Record Waste
          </button>
          <button
            onClick={fetchDetail}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Main Stock & Inventory KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Current Stock</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold text-stone-900">
              {item.currentQuantity}
            </span>
            <span className="text-sm font-medium text-stone-500">{unitLabel}</span>
          </div>
          <div className="mt-2 text-xs text-stone-400">
            Min: {item.minimumStock || 0} {unitLabel} {item.maximumStock ? `• Max: ${item.maximumStock} ${unitLabel}` : ''}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Cost & Value</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold text-stone-900">
              ₹{stockValue}
            </span>
          </div>
          <div className="mt-2 text-xs text-stone-400">
            Unit Cost: ₹{item.costPerUnit || 0} / {unitLabel}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Reorder Threshold</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold text-amber-600">
              {item.reorderLevel || item.minimumStock || 0}
            </span>
            <span className="text-sm font-medium text-stone-500">{unitLabel}</span>
          </div>
          <div className="mt-2 text-xs text-stone-400">
            Triggers low-stock alert when quantity reaches this
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Consumption (Today)</div>
          <div className="mt-2 flex items-baseline gap-2 text-red-600">
            <TrendingDown size={24} />
            <span className="font-display text-3xl font-extrabold">
              {consumption?.today?.toFixed(1) || 0}
            </span>
            <span className="text-sm font-medium text-stone-500">{unitLabel}</span>
          </div>
          <div className="mt-2 text-xs text-stone-400">
            This Week: {consumption?.thisWeek?.toFixed(1) || 0} • This Month: {consumption?.thisMonth?.toFixed(1) || 0} {unitLabel}
          </div>
        </div>
      </div>

      {/* Description & Additional Info */}
      {item.description && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Item Notes & Description</h3>
          <p className="mt-2 text-sm text-stone-700 whitespace-pre-wrap">{item.description}</p>
        </div>
      )}

      {/* Transactions History Table */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-soft overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <h3 className="font-display text-base font-bold text-espresso-900">Transaction History</h3>
            <p className="text-xs text-stone-500">Recent audit log of stock movements for this item</p>
          </div>
          <span className="text-xs font-semibold text-stone-400">{transactions?.length || 0} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-6 py-3">Date & Time</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-6 py-3">Reference / Reason</th>
                <th className="px-4 py-3">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-sans">
              {!transactions?.length ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-stone-400">
                    No transactions recorded for this item yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isPositive = tx.quantity > 0;
                  const cfg = TYPE_CONFIG[tx.type] || { label: tx.type, bg: 'bg-stone-100 text-stone-700 border-stone-200' };
                  const txDate = new Date(tx.createdAt);

                  return (
                    <tr key={tx._id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs text-stone-600">
                        <div className="font-medium text-stone-900">{txDate.toLocaleDateString()}</div>
                        <div className="text-[10px] text-stone-400">{txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-semibold">
                        <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
                          {isPositive ? `+${tx.quantity}` : tx.quantity} {unitLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs text-stone-600">
                        {tx.balanceBefore} → <strong className="text-stone-900">{tx.balanceAfter}</strong>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-stone-700">
                        {tx.reference && <span className="font-mono font-medium text-indigo-700 mr-2">[{tx.reference}]</span>}
                        <span>{tx.reason || tx.notes || '—'}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-stone-500">
                        {tx.performedBy?.name ? (
                          <span className="inline-flex items-center gap-1">
                            <User size={12} /> {tx.performedBy.name}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">System</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD STOCK */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="font-display text-lg font-bold text-stone-900">Add Stock Purchase</h3>
            <p className="mt-1 text-xs text-stone-500">Receiving stock for <strong>{item.name}</strong></p>
            <form onSubmit={handleAddStock} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600">Quantity Added ({unitLabel}) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                  placeholder="e.g. 50"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600">Cost Per Unit (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={stockForm.costPerUnit}
                    onChange={(e) => setStockForm({ ...stockForm, costPerUnit: e.target.value })}
                    placeholder={String(item.costPerUnit || '0')}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600">Supplier</label>
                  <input
                    type="text"
                    value={stockForm.supplier}
                    onChange={(e) => setStockForm({ ...stockForm, supplier: e.target.value })}
                    placeholder={item.supplier || 'Supplier name'}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600">Notes / Invoice #</label>
                <input
                  type="text"
                  value={stockForm.notes}
                  onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
                  placeholder="Optional PO/Invoice reference"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Confirm Addition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADJUST STOCK */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="font-display text-lg font-bold text-stone-900">Manual Stock Adjustment</h3>
            <p className="mt-1 text-xs text-stone-500">
              Current quantity is <strong>{item.currentQuantity} {unitLabel}</strong>
            </p>
            <form onSubmit={handleAdjustStock} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600">Adjustment Amount ({unitLabel}) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={adjustForm.adjustment}
                  onChange={(e) => setAdjustForm({ ...adjustForm, adjustment: e.target.value })}
                  placeholder="e.g. +5 or -3"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-stone-400">Use positive numbers to add, negative numbers to reduce.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600">Reason for Adjustment *</label>
                <input
                  type="text"
                  required
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="e.g. Monthly stock audit discrepancy"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600">Additional Notes</label>
                <input
                  type="text"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  placeholder="Optional details"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD WASTE */}
      {showWasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="font-display text-lg font-bold text-red-600">Record Spoilage / Waste</h3>
            <p className="mt-1 text-xs text-stone-500">Deducts stock due to damage, expiration, or spoilage</p>
            <form onSubmit={handleRecordWaste} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600">Quantity Wasted ({unitLabel}) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  value={wasteForm.quantity}
                  onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })}
                  placeholder="e.g. 2"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600">Classification</label>
                  <select
                    value={wasteForm.type}
                    onChange={(e) => setWasteForm({ ...wasteForm, type: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                  >
                    <option value="waste">Waste</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600">Reason</label>
                  <select
                    value={wasteForm.reason}
                    onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                  >
                    {WASTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600">Notes / Details</label>
                <input
                  type="text"
                  value={wasteForm.notes}
                  onChange={(e) => setWasteForm({ ...wasteForm, notes: e.target.value })}
                  placeholder="e.g. Dropped jar / expired on 05/09"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWasteModal(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Confirm Deduction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
