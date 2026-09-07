import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Package, AlertTriangle, XCircle, CheckCircle2, Plus, 
  Search, RefreshCw, ArrowUpRight, ArrowDownLeft, Trash2, 
  Edit2, PackagePlus, MinusCircle, UtensilsCrossed, History, 
  Download, Loader2, Info, Layers, ChevronRight, SlidersHorizontal
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const COMMON_UNITS = [
  'Can', 'Bottle', 'Piece', 'Cup', 'Glass', 
  'Packet', 'Box', 'Bag', 'Container', 'Lid', 'Straw'
];

const COMMON_CATEGORIES = [
  'Beverage', 'Disposable', 'Packaging', 'Cutlery', 'Takeaway', 'Condiments'
];

const REMOVAL_REASONS = [
  'Damaged',
  'Lost',
  'Expired',
  'Manual correction',
  'Other'
];

const TYPE_CONFIG = {
  order_consumption: { label: 'Order Consumption', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  stock_added: { label: 'Stock Added', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  purchase: { label: 'Stock Added', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  manual_addition: { label: 'Stock Added', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  manual_removal: { label: 'Manual Removal', bg: 'bg-stone-100 text-stone-700 border-stone-200' },
  damaged: { label: 'Damaged', bg: 'bg-red-50 text-red-700 border-red-200' },
  lost: { label: 'Lost', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Expired', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  waste: { label: 'Waste / Damaged', bg: 'bg-red-50 text-red-700 border-red-200' },
  adjustment: { label: 'Adjustment', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
};

function StatusBadge({ item }) {
  if (item.currentQuantity <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> Out of Stock
      </span>
    );
  }
  if (item.minimumStock > 0 && item.currentQuantity <= item.minimumStock) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Low Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> In Stock
    </span>
  );
}

const EMPTY_ITEM_FORM = {
  name: '',
  category: 'Beverage',
  customCategory: '',
  unit: 'Can',
  customUnit: '',
  quantity: '',
  minimumStock: '5',
  description: '',
};

export default function InventoryDashboardPage() {
  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'mappings' | 'history'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data
  const [stats, setStats] = useState({ totalItems: 0, totalUnits: 0, lowStockCount: 0, outOfStockCount: 0 });
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Filters for items table
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals state
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);

  const [showAddStockModal, setShowAddStockModal] = useState(null); // item
  const [addStockQty, setAddStockQty] = useState('');
  const [addStockNotes, setAddStockNotes] = useState('');

  const [showRemoveStockModal, setShowRemoveStockModal] = useState(null); // item
  const [removeStockQty, setRemoveStockQty] = useState('');
  const [removeStockReason, setRemoveStockReason] = useState('Damaged');
  const [removeStockNotes, setRemoveStockNotes] = useState('');

  const [showMappingModal, setShowMappingModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [mappingForm, setMappingForm] = useState({ productId: '', inventoryItemId: '', quantityRequired: '1' });

  // Fetch all inventory data
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, itemsRes, catRes, mapRes, prodRes, txnRes] = await Promise.all([
        api.get('/inventory/dashboard').catch(() => ({ data: {} })),
        api.get('/inventory/items?limit=200'),
        api.get('/inventory/categories'),
        api.get('/inventory/mappings'),
        api.get('/menu'),
        api.get('/inventory/transactions?limit=100'),
      ]);

      const itemList = itemsRes.data?.items || [];
      setItems(itemList);
      setCategories(catRes.data?.categories || []);
      setMappings(mapRes.data?.mappings || []);
      setProducts(prodRes.data?.products || []);
      setTransactions(txnRes.data?.transactions || []);

      // Calculate stats
      const totalUnits = itemList.reduce((acc, i) => acc + (i.currentQuantity || 0), 0);
      const lowStockCount = itemList.filter(i => i.currentQuantity > 0 && i.minimumStock > 0 && i.currentQuantity <= i.minimumStock).length;
      const outOfStockCount = itemList.filter(i => i.currentQuantity <= 0).length;

      setStats({
        totalItems: itemList.length,
        totalUnits,
        lowStockCount,
        outOfStockCount,
      });
    } catch (err) {
      toast.error(err.message || 'Failed to load consumable inventory data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Filtered items list
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || (item.category?.name && item.category.name.toLowerCase().includes(q));
      const catId = item.category?._id || item.category;
      const matchesCat = !selectedCategory || catId === selectedCategory || item.category?.name === selectedCategory;
      
      let matchesStatus = true;
      if (selectedStatus === 'in_stock') matchesStatus = item.currentQuantity > (item.minimumStock || 0);
      else if (selectedStatus === 'low_stock') matchesStatus = item.currentQuantity > 0 && item.minimumStock > 0 && item.currentQuantity <= item.minimumStock;
      else if (selectedStatus === 'out_of_stock') matchesStatus = item.currentQuantity <= 0;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [items, searchQuery, selectedCategory, selectedStatus]);

  // Low stock & Out of stock items for alerts
  const outOfStockAlerts = useMemo(() => items.filter(i => i.currentQuantity <= 0), [items]);
  const lowStockAlerts = useMemo(() => items.filter(i => i.currentQuantity > 0 && i.minimumStock > 0 && i.currentQuantity <= i.minimumStock), [items]);

  // Open Add Item modal
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setItemForm(EMPTY_ITEM_FORM);
    setShowItemModal(true);
  };

  // Open Edit Item modal
  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    const catName = item.category?.name || 'Disposable';
    const isStandardCat = COMMON_CATEGORIES.includes(catName);
    const isStandardUnit = COMMON_UNITS.includes(item.unit);

    setItemForm({
      name: item.name,
      category: isStandardCat ? catName : 'Custom',
      customCategory: isStandardCat ? '' : catName,
      unit: isStandardUnit ? item.unit : 'Custom',
      customUnit: isStandardUnit ? '' : item.unit,
      quantity: String(item.currentQuantity),
      minimumStock: String(item.minimumStock ?? 0),
      description: item.description || '',
    });
    setShowItemModal(true);
  };

  // Save Item (Create or Update)
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name.trim()) return toast.error('Item name is required');

    const resolvedCategory = itemForm.category === 'Custom' ? itemForm.customCategory.trim() : itemForm.category;
    if (!resolvedCategory) return toast.error('Category is required');

    const resolvedUnit = itemForm.unit === 'Custom' ? itemForm.customUnit.trim() : itemForm.unit;
    if (!resolvedUnit) return toast.error('Unit is required');

    setSaving(true);
    try {
      if (editingItem) {
        // Update existing item
        await api.put(`/inventory/items/${editingItem._id}`, {
          name: itemForm.name.trim(),
          category: resolvedCategory,
          unit: resolvedUnit,
          minimumStock: Number(itemForm.minimumStock) || 0,
          description: itemForm.description.trim(),
        });
        toast.success(`Updated ${itemForm.name}`);
      } else {
        // Create new item
        await api.post('/inventory/items', {
          name: itemForm.name.trim(),
          category: resolvedCategory,
          unit: resolvedUnit,
          currentQuantity: Number(itemForm.quantity) || 0,
          minimumStock: Number(itemForm.minimumStock) || 0,
          description: itemForm.description.trim(),
        });
        toast.success(`Created consumable: ${itemForm.name}`);
      }

      setShowItemModal(false);
      loadAllData();
    } catch (err) {
      toast.error(err.message || 'Failed to save inventory item');
    } finally {
      setSaving(false);
    }
  };

  // Delete/Deactivate Item
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to remove "${item.name}" from inventory?`)) return;
    try {
      await api.delete(`/inventory/items/${item._id}`);
      toast.success(`${item.name} removed`);
      loadAllData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete item');
    }
  };

  // Submit Add Stock
  const handleAddStockSubmit = async (e) => {
    e.preventDefault();
    const qty = Number(addStockQty);
    if (!qty || qty <= 0) return toast.error('Please enter a valid positive quantity to add');

    setSaving(true);
    try {
      await api.post('/inventory/stock/add', {
        itemId: showAddStockModal._id,
        quantity: qty,
        reason: 'Manual stock addition',
        notes: addStockNotes.trim() || undefined,
      });
      toast.success(`Added +${qty} ${showAddStockModal.unit} to ${showAddStockModal.name}`);
      setShowAddStockModal(null);
      setAddStockQty('');
      setAddStockNotes('');
      loadAllData();
    } catch (err) {
      toast.error(err.message || 'Failed to add stock');
    } finally {
      setSaving(false);
    }
  };

  // Submit Remove Stock
  const handleRemoveStockSubmit = async (e) => {
    e.preventDefault();
    const qty = Number(removeStockQty);
    if (!qty || qty <= 0) return toast.error('Please enter a valid quantity to remove');
    if (qty > showRemoveStockModal.currentQuantity) {
      return toast.error(`Cannot remove ${qty}. Current stock is only ${showRemoveStockModal.currentQuantity}.`);
    }

    setSaving(true);
    try {
      await api.post('/inventory/stock/remove', {
        itemId: showRemoveStockModal._id,
        quantity: qty,
        reason: removeStockReason,
        notes: removeStockNotes.trim() || undefined,
      });
      toast.success(`Deducted -${qty} ${showRemoveStockModal.unit} (${removeStockReason})`);
      setShowRemoveStockModal(null);
      setRemoveStockQty('');
      setRemoveStockNotes('');
      loadAllData();
    } catch (err) {
      toast.error(err.message || 'Failed to remove stock');
    } finally {
      setSaving(false);
    }
  };

  // Save Mapping (Add or Edit Menu Consumable Mapping)
  const handleSaveMapping = async (e) => {
    e.preventDefault();
    if (!mappingForm.productId) return toast.error('Select a menu item');
    if (!mappingForm.inventoryItemId) return toast.error('Select a consumable inventory item');
    const qty = Number(mappingForm.quantityRequired);
    if (!qty || qty <= 0) return toast.error('Quantity used must be greater than 0');

    setSaving(true);
    try {
      if (editingMapping) {
        await api.put(`/inventory/mappings/${editingMapping._id}`, {
          quantityRequired: qty,
        });
        toast.success('Mapping updated');
      } else {
        await api.post('/inventory/mappings', {
          productId: mappingForm.productId,
          inventoryItemId: mappingForm.inventoryItemId,
          quantityRequired: qty,
        });
        toast.success('Menu consumable mapped');
      }
      setShowMappingModal(false);
      setEditingMapping(null);
      setMappingForm({ productId: '', inventoryItemId: '', quantityRequired: '1' });
      loadAllData();
    } catch (err) {
      toast.error(err.message || 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  // Delete Mapping
  const handleDeleteMapping = async (mappingId) => {
    if (!window.confirm('Delete this consumable mapping?')) return;
    try {
      await api.delete(`/inventory/mappings/${mappingId}`);
      toast.success('Mapping removed');
      loadAllData();
    } catch (err) {
      toast.error(err.message || 'Failed to remove mapping');
    }
  };

  // Export Transactions CSV
  const handleExportCSV = () => {
    if (!transactions.length) return toast.error('No transactions available');
    const headers = ['Date', 'Time', 'Item', 'Type', 'Quantity Change', 'Reference', 'Reason', 'Balance After', 'User'];
    const rows = transactions.map((t) => {
      const d = new Date(t.createdAt);
      return [
        `"${d.toLocaleDateString()}"`,
        `"${d.toLocaleTimeString()}"`,
        `"${t.inventoryItem?.name || 'Item'}"`,
        `"${t.type}"`,
        t.quantity,
        `"${t.reference || ''}"`,
        `"${(t.reason || t.notes || '').replace(/"/g, '""')}"`,
        t.balanceAfter,
        `"${t.performedBy?.name || 'System'}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `consumables_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brew-500 text-white font-bold text-sm shadow-sm">
              📦
            </span>
            <h2 className="font-display text-2xl font-bold text-espresso-900">
              Non-Reusable Consumables Inventory
            </h2>
          </div>
          <p className="mt-1 text-xs text-stone-500 max-w-2xl">
            Physical one-time-use items given to customers (beverage cans, bottles, cups, spoons, containers, bags). Automatically deducted upon order confirmation and never restored once consumed.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50"
            title="Refresh inventory"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 rounded-xl bg-espresso-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-espresso-800 transition"
          >
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Total Items</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Package size={14} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">
            {loading ? '—' : stats.totalItems}
          </div>
          <p className="text-[11px] text-stone-400 mt-0.5">Consumable products</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Total Units</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Layers size={14} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">
            {loading ? '—' : stats.totalUnits.toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-400 mt-0.5">Physical items in stock</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Low Stock</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle size={14} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 sm:text-3xl">
            {loading ? '—' : stats.lowStockCount}
          </div>
          <p className="text-[11px] text-stone-400 mt-0.5">At or below minimum</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-red-600">Out of Stock</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <XCircle size={14} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-red-600 sm:text-3xl">
            {loading ? '—' : stats.outOfStockCount}
          </div>
          <p className="text-[11px] text-stone-400 mt-0.5">Disables menu items</p>
        </div>
      </div>

      {/* Stock Alerts Banners */}
      {(outOfStockAlerts.length > 0 || lowStockAlerts.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {outOfStockAlerts.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-red-800 font-semibold text-xs uppercase tracking-wider">
                <XCircle size={16} className="text-red-600" />
                <span>🔴 Out of Stock ({outOfStockAlerts.length}) — Customer Menu Unavailable</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {outOfStockAlerts.map(item => (
                  <span
                    key={item._id}
                    onClick={() => {
                      setShowAddStockModal(item);
                      setAddStockQty('');
                    }}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 shadow-2xs hover:bg-red-100 transition"
                    title="Click to add stock"
                  >
                    {item.name}: 0 {item.unit}s <span className="text-[10px] text-red-500 underline ml-1">+ Restock</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {lowStockAlerts.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs uppercase tracking-wider">
                <AlertTriangle size={16} className="text-amber-600" />
                <span>⚠️ Low Stock Alerts ({lowStockAlerts.length})</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {lowStockAlerts.map(item => (
                  <span
                    key={item._id}
                    onClick={() => {
                      setShowAddStockModal(item);
                      setAddStockQty('');
                    }}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 shadow-2xs hover:bg-amber-100 transition"
                    title="Click to add stock"
                  >
                    {item.name}: <strong>{item.currentQuantity}</strong> {item.unit}s (min {item.minimumStock}) <span className="text-[10px] text-amber-600 underline ml-1">+ Add</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-stone-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-semibold transition ${
              activeTab === 'items'
                ? 'border-brew-600 text-espresso-900'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            <Package size={16} />
            Consumable Items ({items.length})
          </button>

          <button
            onClick={() => setActiveTab('mappings')}
            className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-semibold transition ${
              activeTab === 'mappings'
                ? 'border-brew-600 text-espresso-900'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            <UtensilsCrossed size={16} />
            Menu Consumables ({mappings.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-semibold transition ${
              activeTab === 'history'
                ? 'border-brew-600 text-espresso-900'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            <History size={16} />
            Stock History ({transactions.length})
          </button>
        </div>
      </div>

      {/* ─── TAB 1: CONSUMABLE ITEMS TABLE ─── */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-soft">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-2.5 text-stone-400" size={15} />
              <input
                type="text"
                placeholder="Search consumables (e.g. Coca-Cola, Cup, Spoon, Bottle)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-stone-200 py-1.5 pl-9 pr-3 text-xs focus:border-brew-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs text-stone-700 focus:border-brew-500 focus:outline-none bg-white"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs text-stone-700 focus:border-brew-500 focus:outline-none bg-white"
              >
                <option value="">All Statuses</option>
                <option value="in_stock">🟢 In Stock</option>
                <option value="low_stock">🟡 Low Stock</option>
                <option value="out_of_stock">🔴 Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Main Inventory Table */}
          <div className="rounded-2xl border border-stone-200 bg-white shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="px-5 py-3.5">Item</th>
                    <th className="px-4 py-3.5">Category</th>
                    <th className="px-4 py-3.5 text-right">Physical Stock</th>
                    <th className="px-4 py-3.5">Unit</th>
                    <th className="px-4 py-3.5 text-right">Minimum</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-400">
                        <Loader2 size={24} className="mx-auto animate-spin text-espresso-600 mb-2" />
                        Loading physical inventory...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-400">
                        <Package size={32} className="mx-auto mb-2 text-stone-300" />
                        <p className="text-xs">No consumable items found.</p>
                        <button
                          onClick={handleOpenCreateModal}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-espresso-900 px-3.5 py-1.5 text-xs font-semibold text-white"
                        >
                          <Plus size={13} /> Add First Consumable
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item._id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-stone-900">{item.name}</div>
                          {item.description && (
                            <div className="text-[11px] text-stone-400 truncate max-w-xs">{item.description}</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-stone-600">
                          <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 font-medium text-stone-700">
                            {item.category?.name || 'Disposable'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-base font-bold text-stone-900">
                          {item.currentQuantity}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-stone-500 font-medium">
                          {item.unit}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs text-stone-500">
                          {item.minimumStock ?? 0}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-center">
                          <StatusBadge item={item} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Add Stock Button */}
                            <button
                              onClick={() => {
                                setShowAddStockModal(item);
                                setAddStockQty('');
                                setAddStockNotes('');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                              title="Add stock"
                            >
                              <PackagePlus size={13} /> +Add
                            </button>

                            {/* Remove Stock Button */}
                            <button
                              onClick={() => {
                                setShowRemoveStockModal(item);
                                setRemoveStockQty('');
                                setRemoveStockReason('Damaged');
                                setRemoveStockNotes('');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                              title="Remove stock (damaged/lost/expired)"
                            >
                              <MinusCircle size={13} /> -Remove
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
                              title="Edit item"
                            >
                              <Edit2 size={14} />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 transition"
                              title="Delete item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: MENU CONSUMABLES (MAPPINGS) ─── */}
      {activeTab === 'mappings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
            <div>
              <h3 className="font-display text-sm font-bold text-espresso-900">Menu Consumables Mapping</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Connect each menu item to the physical consumable items it uses. When an order is confirmed, stock is deducted automatically.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingMapping(null);
                setMappingForm({
                  productId: products[0]?._id || '',
                  inventoryItemId: items[0]?._id || '',
                  quantityRequired: '1',
                });
                setShowMappingModal(true);
              }}
              disabled={products.length === 0 || items.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-espresso-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-espresso-800 disabled:opacity-50 transition"
            >
              <Plus size={14} /> Add Mapping
            </button>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="px-5 py-3.5">Menu Item</th>
                    <th className="px-5 py-3.5">Consumable Inventory Item</th>
                    <th className="px-4 py-3.5 text-right">Qty Used</th>
                    <th className="px-4 py-3.5 text-center">Available Servings</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {mappings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-stone-400">
                        No menu consumable mappings configured yet.<br />
                        Click <strong>"+ Add Mapping"</strong> to link a menu item to a can, cup, bottle, or packaging item.
                      </td>
                    </tr>
                  ) : (
                    mappings.map((m) => {
                      const prod = typeof m.product === 'object' ? m.product : products.find(p => p._id === m.product);
                      const inv = typeof m.inventoryItem === 'object' ? m.inventoryItem : items.find(i => i._id === m.inventoryItem);
                      const inStock = inv?.currentQuantity ?? 0;
                      const servings = Math.floor(inStock / (m.quantityRequired || 1));
                      const isOutOfStock = servings <= 0;

                      return (
                        <tr key={m._id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-stone-900">
                            <div className="flex items-center gap-2.5">
                              {prod?.image && (
                                <img src={prod.image} alt={prod.name} className="h-8 w-8 rounded-lg object-cover border border-stone-200" />
                              )}
                              <div>
                                <div>{prod?.name || 'Menu Item'}</div>
                                <div className="text-[11px] text-stone-400 font-normal">₹{prod?.price || 0}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-stone-800">
                            <div>{inv?.name || 'Inventory Item'}</div>
                            <div className="text-[11px] text-stone-400 font-normal">
                              In Stock: <strong className={inStock <= 0 ? 'text-red-600' : 'text-stone-700'}>{inStock} {inv?.unit || ''}</strong>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-bold text-stone-800">
                            {m.quantityRequired} <span className="text-xs font-normal text-stone-400">{inv?.unit || 'unit'}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-center">
                            {isOutOfStock ? (
                              <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 border border-red-200">
                                🔴 Out of Stock
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                {servings} portion{servings === 1 ? '' : 's'}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingMapping(m);
                                  setMappingForm({
                                    productId: prod?._id || '',
                                    inventoryItemId: inv?._id || '',
                                    quantityRequired: String(m.quantityRequired || 1),
                                  });
                                  setShowMappingModal(true);
                                }}
                                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                                title="Edit mapping"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteMapping(m._id)}
                                className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                                title="Delete mapping"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: TRANSACTION AUDIT LOG ─── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
            <div>
              <h3 className="font-display text-sm font-bold text-espresso-900">Consumable Stock Movement Audit Log</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Every automatic deduction, manual purchase addition, damage, and adjustment is recorded with remaining balance.
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50 transition"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="px-5 py-3.5">Date & Time</th>
                    <th className="px-4 py-3.5">Consumable Item</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5 text-right">Qty Change</th>
                    <th className="px-4 py-3.5 text-right">Remaining Stock</th>
                    <th className="px-5 py-3.5">Reference / Reason</th>
                    <th className="px-4 py-3.5">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-stone-400">
                        No transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const isPositive = tx.quantity > 0;
                      const cfg = TYPE_CONFIG[tx.type] || { label: tx.type, bg: 'bg-stone-100 text-stone-700 border-stone-200' };
                      const txDate = new Date(tx.createdAt);
                      const unit = tx.inventoryItem?.unit || 'unit';

                      return (
                        <tr key={tx._id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="whitespace-nowrap px-5 py-3.5 text-xs text-stone-600">
                            <div className="font-medium text-stone-900">{txDate.toLocaleDateString()}</div>
                            <div className="text-[10px] text-stone-400">{txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-stone-900">
                            {tx.inventoryItem?.name || 'Deleted item'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${cfg.bg}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-bold">
                            <span className={`inline-flex items-center gap-0.5 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                              {isPositive ? `+${tx.quantity}` : tx.quantity} {unit}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs font-bold text-stone-900">
                            {tx.balanceAfter} <span className="font-normal text-stone-400">{unit}</span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-stone-700">
                            {tx.reference && (
                              <span className="font-mono font-semibold text-indigo-700 mr-2 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                {tx.reference}
                              </span>
                            )}
                            <span>{tx.reason || tx.notes || '—'}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-xs text-stone-500">
                            {tx.performedBy?.name || 'System (Order)'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD / EDIT CONSUMABLE ITEM ─── */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="font-display text-lg font-bold text-stone-900">
              {editingItem ? 'Edit Consumable Item' : 'Add Consumable Inventory Item'}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              Track physical single-use items (cans, bottles, cups, spoons, takeaway boxes, bags).
            </p>

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Coca-Cola Can, Water Bottle, Ice Cream Cup"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-stone-700">Category *</label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brew-500 focus:outline-none bg-white"
                  >
                    {COMMON_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Custom">+ Other Custom Category</option>
                  </select>
                </div>
                {itemForm.category === 'Custom' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom category name..."
                    value={itemForm.customCategory}
                    onChange={(e) => setItemForm({ ...itemForm, customCategory: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Unit */}
              <div>
                <label className="block text-xs font-semibold text-stone-700">Unit of Measure *</label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brew-500 focus:outline-none bg-white"
                  >
                    {COMMON_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="Custom">+ Custom Unit</option>
                  </select>
                </div>
                {itemForm.unit === 'Custom' && (
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sachet, Tub, Wrapper..."
                    value={itemForm.customUnit}
                    onChange={(e) => setItemForm({ ...itemForm, customUnit: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Quantity & Minimum Stock */}
              <div className="grid grid-cols-2 gap-3">
                {!editingItem ? (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">Initial Quantity *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="e.g. 20"
                      value={itemForm.quantity}
                      onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-stone-500">Current Stock</label>
                    <div className="mt-1 rounded-xl bg-stone-100 px-3.5 py-2 text-sm font-bold text-stone-800">
                      {editingItem.currentQuantity} {editingItem.unit}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-700">Minimum Stock *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 5"
                    value={itemForm.minimumStock}
                    onChange={(e) => setItemForm({ ...itemForm, minimumStock: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-stone-700">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 300ml red aluminum can"
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-espresso-900 px-4 py-2 text-xs font-semibold text-white hover:bg-espresso-800 disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {editingItem ? 'Save Changes' : 'Create Consumable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD STOCK (+30) ─── */}
      {showAddStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="font-display text-lg font-bold text-emerald-800 flex items-center gap-2">
              <PackagePlus size={20} className="text-emerald-600" />
              Add Stock
            </h3>
            <p className="mt-1 text-xs text-stone-600">
              Restock <strong>{showAddStockModal.name}</strong>.<br />
              Current: <strong>{showAddStockModal.currentQuantity} {showAddStockModal.unit}s</strong>
            </p>

            <form onSubmit={handleAddStockSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Quantity to Add ({showAddStockModal.unit}s) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  autoFocus
                  placeholder="e.g. 30"
                  value={addStockQty}
                  onChange={(e) => setAddStockQty(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-base font-mono font-bold focus:border-emerald-500 focus:outline-none"
                />
                {addStockQty && Number(addStockQty) > 0 && (
                  <p className="mt-1 text-[11px] text-emerald-600 font-medium">
                    New total: {showAddStockModal.currentQuantity} + {Number(addStockQty)} = <strong>{showAddStockModal.currentQuantity + Number(addStockQty)} {showAddStockModal.unit}s</strong>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Notes / Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Purchased 24-can carton"
                  value={addStockNotes}
                  onChange={(e) => setAddStockNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddStockModal(null)}
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

      {/* ─── MODAL: REMOVE STOCK (-5) ─── */}
      {showRemoveStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="font-display text-lg font-bold text-red-700 flex items-center gap-2">
              <MinusCircle size={20} className="text-red-600" />
              Remove Stock
            </h3>
            <p className="mt-1 text-xs text-stone-600">
              Manual removal for <strong>{showRemoveStockModal.name}</strong>.<br />
              Current: <strong>{showRemoveStockModal.currentQuantity} {showRemoveStockModal.unit}s</strong>
            </p>

            <form onSubmit={handleRemoveStockSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Quantity to Remove ({showRemoveStockModal.unit}s) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={showRemoveStockModal.currentQuantity}
                  step="1"
                  required
                  autoFocus
                  placeholder="e.g. 5"
                  value={removeStockQty}
                  onChange={(e) => setRemoveStockQty(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-base font-mono font-bold focus:border-red-500 focus:outline-none"
                />
                {removeStockQty && Number(removeStockQty) > 0 && (
                  <p className="mt-1 text-[11px] text-stone-600 font-medium">
                    Remaining: {showRemoveStockModal.currentQuantity} - {Number(removeStockQty)} = <strong>{Math.max(0, showRemoveStockModal.currentQuantity - Number(removeStockQty))} {showRemoveStockModal.unit}s</strong>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Reason for Removal *</label>
                <select
                  value={removeStockReason}
                  onChange={(e) => setRemoveStockReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none bg-white"
                >
                  {REMOVAL_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Crushed during delivery"
                  value={removeStockNotes}
                  onChange={(e) => setRemoveStockNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-xs focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowRemoveStockModal(null)}
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
                  Confirm Removal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD / EDIT MAPPING ─── */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="font-display text-lg font-bold text-stone-900">
              {editingMapping ? 'Edit Menu Consumable Mapping' : 'Connect Menu Item to Consumable'}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              Specify which physical item is used when a customer orders this menu item.
            </p>

            <form onSubmit={handleSaveMapping} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Menu Item *</label>
                <select
                  required
                  disabled={Boolean(editingMapping)}
                  value={mappingForm.productId}
                  onChange={(e) => setMappingForm({ ...mappingForm, productId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brew-500 focus:outline-none bg-white disabled:bg-stone-100"
                >
                  <option value="">-- Choose Menu Item --</option>
                  {products.map(p => (
                    <option key={p._id} value={p._id}>{p.name} (₹{p.price})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Consumable Inventory Item *</label>
                <select
                  required
                  disabled={Boolean(editingMapping)}
                  value={mappingForm.inventoryItemId}
                  onChange={(e) => setMappingForm({ ...mappingForm, inventoryItemId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brew-500 focus:outline-none bg-white disabled:bg-stone-100"
                >
                  <option value="">-- Choose Consumable Item --</option>
                  {items.map(i => (
                    <option key={i._id} value={i._id}>
                      {i.name} ({i.currentQuantity} {i.unit}s in stock)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Quantity Used Per Order *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 1"
                  value={mappingForm.quantityRequired}
                  onChange={(e) => setMappingForm({ ...mappingForm, quantityRequired: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none font-mono"
                />
                <p className="mt-1 text-[11px] text-stone-400">
                  Example: 1 Coca-Cola Can per Coca-Cola order.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowMappingModal(false);
                    setEditingMapping(null);
                  }}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-espresso-900 px-4 py-2 text-xs font-semibold text-white hover:bg-espresso-800 disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {editingMapping ? 'Update Mapping' : 'Save Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
