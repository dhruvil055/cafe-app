import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil, Eye, PackagePlus, Loader2, Trash2, ChevronDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const UNIT_LABELS = {
  piece: 'pcs', cup: 'cups', glass: 'glasses', bottle: 'bottles',
  gram: 'g', kilogram: 'kg', millilitre: 'ml', litre: 'L',
  pack: 'packs', box: 'boxes', unit: 'units',
};

const INVENTORY_UNITS = ['piece','cup','glass','bottle','gram','kilogram','millilitre','litre','pack','box','unit'];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'in_stock', label: '🟢 In Stock' },
  { value: 'low_stock', label: '🟡 Low Stock' },
  { value: 'out_of_stock', label: '🔴 Out of Stock' },
];

function StatusBadge({ item }) {
  if (item.currentQuantity <= 0)
    return <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 border border-red-200">🔴 Out of Stock</span>;
  if (item.minimumStock > 0 && item.currentQuantity <= item.minimumStock)
    return <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">🟡 Low Stock</span>;
  return <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">🟢 In Stock</span>;
}

const EMPTY_FORM = {
  name: '', sku: '', category: '', unit: 'piece', currentQuantity: 0,
  minimumStock: 0, maximumStock: '', reorderLevel: 0, costPerUnit: 0, supplier: '', description: '',
};
const EMPTY_STOCK_FORM = { quantity: '', costPerUnit: '', supplier: '', reason: '', notes: '' };
const EMPTY_ADJUST_FORM = { adjustment: '', reason: '', notes: '' };
const EMPTY_WASTE_FORM = { quantity: '', type: 'waste', reason: '', notes: '' };
const WASTE_REASONS = ['Damaged', 'Expired', 'Spilled', 'Broken', 'Incorrect preparation', 'Other'];

export default function InventoryItemsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');

  // Modals
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_FORM);
  const [showStockModal, setShowStockModal] = useState(null); // item
  const [stockForm, setStockForm] = useState(EMPTY_STOCK_FORM);
  const [showAdjustModal, setShowAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState(EMPTY_ADJUST_FORM);
  const [showWasteModal, setShowWasteModal] = useState(null);
  const [wasteForm, setWasteForm] = useState(EMPTY_WASTE_FORM);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '200');
      const [itemsRes, catRes] = await Promise.all([
        api.get(`/inventory/items?${params}`),
        api.get('/inventory/categories'),
      ]);
      setItems(itemsRes.data.items || []);
      setTotal(itemsRes.data.total || 0);
      setCategories(catRes.data.categories || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() =>
    items.filter(i => !query || i.name?.toLowerCase().includes(query.toLowerCase()))
  , [items, query]);

  // ── Create / Edit Item ──
  const openCreate = () => {
    setEditingItem(null);
    setItemForm({ ...EMPTY_FORM, category: categories[0]?._id || '' });
    setShowItemForm(true);
  };
  const openEdit = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name, sku: item.sku || '', category: item.category?._id || item.category || '',
      unit: item.unit, currentQuantity: item.currentQuantity, minimumStock: item.minimumStock,
      maximumStock: item.maximumStock ?? '', reorderLevel: item.reorderLevel, costPerUnit: item.costPerUnit,
      supplier: item.supplier || '', description: item.description || '',
    });
    setShowItemForm(true);
  };
  const saveItem = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...itemForm, maximumStock: itemForm.maximumStock === '' ? null : Number(itemForm.maximumStock) };
      if (editingItem) {
        await api.put(`/inventory/items/${editingItem._id}`, payload);
        toast.success('Item updated');
      } else {
        await api.post('/inventory/items', payload);
        toast.success('Item created');
      }
      setShowItemForm(false);
      fetchData();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Add Stock ──
  const submitAddStock = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/inventory/stock/add', { itemId: showStockModal._id, ...stockForm, quantity: Number(stockForm.quantity) });
      toast.success('Stock added');
      setShowStockModal(null);
      setStockForm(EMPTY_STOCK_FORM);
      fetchData();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  // ── Adjust Stock ──
  const submitAdjust = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/inventory/stock/adjust', { itemId: showAdjustModal._id, ...adjustForm, adjustment: Number(adjustForm.adjustment) });
      toast.success('Stock adjusted');
      setShowAdjustModal(null);
      setAdjustForm(EMPTY_ADJUST_FORM);
      fetchData();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  // ── Waste ──
  const submitWaste = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/inventory/stock/waste', { itemId: showWasteModal._id, ...wasteForm, quantity: Number(wasteForm.quantity) });
      toast.success('Waste recorded');
      setShowWasteModal(null);
      setWasteForm(EMPTY_WASTE_FORM);
      fetchData();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  // ── Deactivate ──
  const deactivateItem = async (item) => {
    if (!confirm(`Deactivate "${item.name}"? It won't appear in inventory but won't be deleted.`)) return;
    try {
      await api.delete(`/inventory/items/${item._id}`);
      toast.success('Item deactivated');
      fetchData();
    } catch (e) { toast.error(e.message); }
  };

  const totalValue = filtered.reduce((s, i) => s + (i.currentQuantity * i.costPerUnit), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-espresso-900">Inventory Items</h2>
          <p className="text-sm text-stone-500">{total} items · Total Value: ₹{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <button onClick={openCreate} className="btn-primary gap-2 px-4 py-2.5 text-sm">
          <Plus size={16} /> New Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search items..."
            className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-8 pr-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-espresso-300" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-soft">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-stone-400 gap-2">
            <Loader2 size={18} className="animate-spin" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-stone-400">
            <Package size={32} className="mb-2 opacity-40" />
            <p className="text-sm">No inventory items found.</p>
            <button onClick={openCreate} className="mt-3 text-sm text-espresso-700 hover:underline">+ Add your first item</button>
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-left">
              <tr>
                {['Item', 'Category', 'Current Stock', 'Min Stock', 'Status', 'Cost', 'Stock Value', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map(item => (
                <tr key={item._id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-900">{item.name}</div>
                    {item.sku && <div className="text-xs text-stone-400">{item.sku}</div>}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    <span>{item.category?.icon} {item.category?.name || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${item.currentQuantity <= 0 ? 'text-red-600' : item.minimumStock > 0 && item.currentQuantity <= item.minimumStock ? 'text-amber-600' : 'text-stone-900'}`}>
                      {item.currentQuantity}
                    </span>
                    <span className="ml-1 text-xs text-stone-400">{UNIT_LABELS[item.unit] || item.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-500">{item.minimumStock || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge item={item} /></td>
                  <td className="px-4 py-3 text-stone-600">₹{item.costPerUnit || 0}</td>
                  <td className="px-4 py-3 font-medium text-stone-900">
                    ₹{(item.currentQuantity * item.costPerUnit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link to={`/inventory/items/${item._id}`} title="View detail"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100">
                        <Eye size={13} />
                      </Link>
                      <button onClick={() => openEdit(item)} title="Edit"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => { setShowStockModal(item); setStockForm(EMPTY_STOCK_FORM); }} title="Add Stock"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                        <PackagePlus size={13} />
                      </button>
                      <button onClick={() => { setShowAdjustModal(item); setAdjustForm(EMPTY_ADJUST_FORM); }} title="Adjust"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sky-200 text-sky-600 hover:bg-sky-50">
                        <ChevronDown size={13} />
                      </button>
                      <button onClick={() => { setShowWasteModal(item); setWasteForm(EMPTY_WASTE_FORM); }} title="Record Waste"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50">
                        <AlertTriangle size={13} />
                      </button>
                      <button onClick={() => deactivateItem(item)} title="Deactivate"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Item Form Modal ── */}
      {showItemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowItemForm(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-xl font-bold text-espresso-900 mb-5">{editingItem ? 'Edit Item' : 'New Inventory Item'}</h3>
            <form onSubmit={saveItem} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-stone-600 mb-1 block">Item Name *</label>
                  <input required value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 mb-1 block">SKU / Code</label>
                  <input value={itemForm.sku} onChange={e => setItemForm(f => ({ ...f, sku: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 mb-1 block">Category *</label>
                  <select required value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300">
                    <option value="">— Select —</option>
                    {categories.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 mb-1 block">Unit *</label>
                  <select required value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300">
                    {INVENTORY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                {!editingItem && (
                  <div>
                    <label className="text-xs font-medium text-stone-600 mb-1 block">Opening Stock</label>
                    <input type="number" min="0" step="any" value={itemForm.currentQuantity} onChange={e => setItemForm(f => ({ ...f, currentQuantity: e.target.value }))}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-stone-600 mb-1 block">Minimum Stock</label>
                  <input type="number" min="0" value={itemForm.minimumStock} onChange={e => setItemForm(f => ({ ...f, minimumStock: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 mb-1 block">Reorder Level</label>
                  <input type="number" min="0" value={itemForm.reorderLevel} onChange={e => setItemForm(f => ({ ...f, reorderLevel: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 mb-1 block">Cost per Unit (₹)</label>
                  <input type="number" min="0" step="0.01" value={itemForm.costPerUnit} onChange={e => setItemForm(f => ({ ...f, costPerUnit: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-stone-600 mb-1 block">Supplier</label>
                  <input value={itemForm.supplier} onChange={e => setItemForm(f => ({ ...f, supplier: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-stone-600 mb-1 block">Description</label>
                  <textarea rows={2} value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowItemForm(false)} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2 text-sm gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editingItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Stock Modal ── */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowStockModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-espresso-900 mb-1">Add Stock</h3>
            <p className="text-sm text-stone-500 mb-4">{showStockModal.name} · Current: {showStockModal.currentQuantity} {UNIT_LABELS[showStockModal.unit]}</p>
            <form onSubmit={submitAddStock} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Quantity to Add *</label>
                <input required type="number" min="0.001" step="any" value={stockForm.quantity} onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Cost per Unit (₹)</label>
                <input type="number" min="0" step="0.01" value={stockForm.costPerUnit} onChange={e => setStockForm(f => ({ ...f, costPerUnit: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Supplier</label>
                <input value={stockForm.supplier} onChange={e => setStockForm(f => ({ ...f, supplier: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Notes</label>
                <input value={stockForm.notes} onChange={e => setStockForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowStockModal(null)} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2 text-sm gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />} Add Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Adjust Modal ── */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAdjustModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-espresso-900 mb-1">Adjust Stock</h3>
            <p className="text-sm text-stone-500 mb-4">{showAdjustModal.name} · Current: {showAdjustModal.currentQuantity} {UNIT_LABELS[showAdjustModal.unit]}</p>
            <form onSubmit={submitAdjust} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Adjustment (use - for decrease) *</label>
                <input required type="number" step="any" value={adjustForm.adjustment} onChange={e => setAdjustForm(f => ({ ...f, adjustment: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Reason {Number(adjustForm.adjustment) < 0 ? '*' : ''}</label>
                <input value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdjustModal(null)} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2 text-sm gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />} Adjust
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Waste Modal ── */}
      {showWasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowWasteModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-espresso-900 mb-1">Record Waste / Damage</h3>
            <p className="text-sm text-stone-500 mb-4">{showWasteModal.name} · Current: {showWasteModal.currentQuantity} {UNIT_LABELS[showWasteModal.unit]}</p>
            <form onSubmit={submitWaste} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Quantity *</label>
                <input required type="number" min="0.001" step="any" value={wasteForm.quantity} onChange={e => setWasteForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-espresso-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Type</label>
                <select value={wasteForm.type} onChange={e => setWasteForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none">
                  <option value="waste">Waste</option>
                  <option value="damaged">Damaged</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Reason *</label>
                <select value={wasteForm.reason} onChange={e => setWasteForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none">
                  <option value="">— Select reason —</option>
                  {WASTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowWasteModal(null)} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2 text-sm gap-2 bg-amber-600 hover:bg-amber-700">
                  {saving && <Loader2 size={14} className="animate-spin" />} Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
