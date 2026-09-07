import { useEffect, useState, useMemo } from 'react';
import { 
  UtensilsCrossed, Plus, Search, Trash2, Edit2, CheckCircle2, 
  AlertTriangle, XCircle, Info, RefreshCw, Loader2, Sparkles, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const UNIT_LABELS = {
  piece: 'pcs', cup: 'cups', glass: 'glasses', bottle: 'bottles',
  gram: 'g', kilogram: 'kg', millilitre: 'ml', litre: 'L',
  pack: 'packs', box: 'boxes', unit: 'units',
};

export default function RecipeMappingPage() {
  const [products, setProducts] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'mapped' | 'unmapped'
  const [selectedProductId, setSelectedProductId] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [mappingForm, setMappingForm] = useState({
    inventoryItemId: '',
    quantityRequired: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, itemsRes, mapRes] = await Promise.all([
        api.get('/menu'),
        api.get('/inventory/items?limit=300'),
        api.get('/inventory/mappings'),
      ]);

      const prods = prodRes.data?.products || (Array.isArray(prodRes.data) ? prodRes.data : []);
      const invItems = itemsRes.data?.items || [];
      const maps = mapRes.data?.mappings || [];

      setProducts(prods);
      setInventoryItems(invItems);
      setMappings(maps);

      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0]._id);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load recipe mappings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Group mappings by product ID
  const mappingsByProduct = useMemo(() => {
    const map = {};
    mappings.forEach((m) => {
      const pId = typeof m.product === 'object' ? m.product?._id : m.product;
      if (!pId) return;
      if (!map[pId]) map[pId] = [];
      map[pId].push(m);
    });
    return map;
  }, [mappings]);

  // Filtered product list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const pMappings = mappingsByProduct[p._id] || [];
      const hasMappings = pMappings.length > 0;

      if (!matchesSearch) return false;
      if (filterType === 'mapped') return hasMappings;
      if (filterType === 'unmapped') return !hasMappings;
      return true;
    });
  }, [products, searchQuery, filterType, mappingsByProduct]);

  // Currently selected product
  const currentProduct = useMemo(() => {
    return products.find((p) => p._id === selectedProductId) || filteredProducts[0] || null;
  }, [products, selectedProductId, filteredProducts]);

  // Mappings for the currently selected product
  const currentProductMappings = useMemo(() => {
    if (!currentProduct) return [];
    return mappingsByProduct[currentProduct._id] || [];
  }, [currentProduct, mappingsByProduct]);

  // Calculate max servings possible for current product based on inventory stock
  const servingsAnalysis = useMemo(() => {
    if (!currentProductMappings.length) {
      return { maxServings: null, bottleneck: null };
    }

    let minServings = Infinity;
    let bottleneckItem = null;

    for (const m of currentProductMappings) {
      if (!m.active) continue;
      const inv = typeof m.inventoryItem === 'object' ? m.inventoryItem : inventoryItems.find((i) => i._id === m.inventoryItem);
      if (!inv) continue;

      const available = inv.currentQuantity ?? 0;
      const required = m.quantityRequired || 1;
      const servings = Math.floor(available / required);

      if (servings < minServings) {
        minServings = servings;
        bottleneckItem = { ...inv, required, available };
      }
    }

    return {
      maxServings: minServings === Infinity ? 0 : Math.max(0, minServings),
      bottleneck: bottleneckItem,
    };
  }, [currentProductMappings, inventoryItems]);

  const handleSaveMapping = async (e) => {
    e.preventDefault();
    if (!currentProduct) return;
    if (!mappingForm.inventoryItemId && !editingMapping) {
      return toast.error('Please select an inventory item');
    }
    const qty = Number(mappingForm.quantityRequired);
    if (!qty || qty <= 0) {
      return toast.error('Enter a valid required quantity greater than 0');
    }

    setSaving(true);
    try {
      if (editingMapping) {
        // Edit existing mapping
        await api.put(`/inventory/mappings/${editingMapping._id}`, {
          quantityRequired: qty,
          notes: mappingForm.notes,
        });
        toast.success('Recipe updated');
      } else {
        // Create new mapping
        await api.post('/inventory/mappings', {
          productId: currentProduct._id,
          inventoryItemId: mappingForm.inventoryItemId,
          quantityRequired: qty,
          notes: mappingForm.notes,
        });
        toast.success('Ingredient added to recipe');
      }

      setShowAddModal(false);
      setEditingMapping(null);
      setMappingForm({ inventoryItemId: '', quantityRequired: '', notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save recipe mapping');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    if (!window.confirm('Remove this ingredient from the recipe?')) return;
    try {
      await api.delete(`/inventory/mappings/${mappingId}`);
      toast.success('Ingredient removed');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to remove ingredient');
    }
  };

  const handleToggleActive = async (mapping) => {
    try {
      await api.put(`/inventory/mappings/${mapping._id}`, {
        active: !mapping.active,
      });
      toast.success(mapping.active ? 'Ingredient mapping disabled' : 'Ingredient mapping enabled');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to toggle status');
    }
  };

  // Available items to add to current product (exclude already mapped ones)
  const availableItemsForProduct = useMemo(() => {
    const existingIds = new Set(
      currentProductMappings.map((m) => (typeof m.inventoryItem === 'object' ? m.inventoryItem?._id : m.inventoryItem))
    );
    return inventoryItems.filter((i) => !existingIds.has(i._id));
  }, [currentProductMappings, inventoryItems]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-espresso-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-espresso-900">Recipe / Bill of Materials (BOM)</h2>
          <p className="mt-1 text-xs text-stone-500">
            Map menu items to raw ingredients, cups, and packaging. Customer orders automatically deduct mapped quantities.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Main 2-Column Split: Menu Products List (Left) & Recipe Details (Right) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Menu Items Picker (5 cols) */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-stone-400" size={16} />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-stone-200 py-2 pl-9 pr-3 text-xs focus:border-brew-500 focus:outline-none"
              />
            </div>

            {/* Filter Pills */}
            <div className="mt-3 flex gap-1.5">
              {[
                { key: 'all', label: 'All' },
                { key: 'mapped', label: 'Has Recipe' },
                { key: 'unmapped', label: 'Unmapped' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFilterType(t.key)}
                  className={`flex-1 rounded-lg py-1 text-[11px] font-semibold transition ${
                    filterType === t.key
                      ? 'bg-espresso-900 text-white shadow-sm'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Products */}
          <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
            {filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center text-xs text-stone-400">
                No menu items found.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const count = (mappingsByProduct[p._id] || []).length;
                const isSelected = currentProduct?._id === p._id;

                return (
                  <button
                    key={p._id}
                    onClick={() => setSelectedProductId(p._id)}
                    className={`w-full flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-brew-600 bg-brew-50/50 shadow-sm ring-1 ring-brew-600'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-400">
                          <UtensilsCrossed size={18} />
                        </div>
                      )}
                      <div className="truncate">
                        <div className="truncate text-xs font-semibold text-stone-900">{p.name}</div>
                        <div className="text-[11px] text-stone-500">₹{p.price}</div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {count > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          {count} item{count > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-400">
                          No recipe
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Recipe Details for Selected Product (8 cols) */}
        <div className="lg:col-span-8 xl:col-span-8">
          {!currentProduct ? (
            <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center">
              <UtensilsCrossed size={36} className="text-stone-300 mb-2" />
              <p className="text-sm text-stone-500">Select a menu item to configure its recipe</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Product Info Banner */}
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {currentProduct.image ? (
                      <img
                        src={currentProduct.image}
                        alt={currentProduct.name}
                        className="h-14 w-14 rounded-xl object-cover border border-stone-200 shadow-sm"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brew-50 text-brew-700 border border-brew-200">
                        <UtensilsCrossed size={24} />
                      </div>
                    )}
                    <div>
                      <h3 className="font-display text-lg font-bold text-espresso-900">{currentProduct.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5">
                        <span>Price: <strong className="text-stone-700">₹{currentProduct.price}</strong></span>
                        <span>• Status: {currentProduct.available ? (
                          <span className="font-medium text-emerald-600">Active</span>
                        ) : (
                          <span className="font-medium text-stone-400">Disabled</span>
                        )}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEditingMapping(null);
                      setMappingForm({ inventoryItemId: availableItemsForProduct[0]?._id || '', quantityRequired: '', notes: '' });
                      setShowAddModal(true);
                    }}
                    disabled={availableItemsForProduct.length === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-espresso-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-espresso-800 transition disabled:opacity-50"
                  >
                    <Plus size={15} /> Add Ingredient / Packaging
                  </button>
                </div>

                {/* Stock Servings Estimator */}
                {currentProductMappings.length > 0 && (
                  <div className="mt-4 border-t border-stone-100 pt-4">
                    <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3.5 border border-stone-200">
                      <div className="flex items-center gap-2.5">
                        {servingsAnalysis.maxServings === 0 ? (
                          <XCircle className="text-red-500 shrink-0" size={18} />
                        ) : servingsAnalysis.maxServings <= 5 ? (
                          <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                        ) : (
                          <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
                        )}
                        <div>
                          <div className="text-xs font-semibold text-stone-900">
                            Available Servings Estimate: {' '}
                            <span className={servingsAnalysis.maxServings === 0 ? 'text-red-600 font-bold' : 'text-stone-900 font-bold'}>
                              {servingsAnalysis.maxServings} portion{servingsAnalysis.maxServings === 1 ? '' : 's'}
                            </span>
                          </div>
                          {servingsAnalysis.bottleneck && (
                            <div className="text-[11px] text-stone-500">
                              Bottleneck ingredient: <strong className="text-stone-700">{servingsAnalysis.bottleneck.name}</strong>{' '}
                              ({servingsAnalysis.bottleneck.available} {UNIT_LABELS[servingsAnalysis.bottleneck.unit] || servingsAnalysis.bottleneck.unit} in stock, needs {servingsAnalysis.bottleneck.required}/serving)
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-stone-400 hidden sm:inline">Auto-calculated</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mappings Table */}
              <div className="rounded-2xl border border-stone-200 bg-white shadow-soft overflow-hidden">
                <div className="border-b border-stone-200 px-5 py-3.5 flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Recipe Ingredients ({currentProductMappings.length})
                  </div>
                  <span className="text-[11px] text-stone-400">Deducted per 1 unit ordered</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                      <tr>
                        <th className="px-5 py-3">Ingredient / Item</th>
                        <th className="px-4 py-3 text-right">Required Qty</th>
                        <th className="px-4 py-3 text-right">In Stock</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-sans">
                      {currentProductMappings.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-xs text-stone-400">
                            No ingredients or packaging items linked yet.<br />
                            Click <strong>"Add Ingredient / Packaging"</strong> above to link inventory.
                          </td>
                        </tr>
                      ) : (
                        currentProductMappings.map((m) => {
                          const inv = typeof m.inventoryItem === 'object' ? m.inventoryItem : inventoryItems.find((i) => i._id === m.inventoryItem);
                          const unit = inv?.unit || 'unit';
                          const unitLabel = UNIT_LABELS[unit] || unit;
                          const inStock = inv?.currentQuantity ?? 0;
                          const isLowOrOut = inStock <= (m.quantityRequired || 1);

                          return (
                            <tr key={m._id} className="hover:bg-stone-50/70 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="font-medium text-stone-900">{inv?.name || 'Unknown Item'}</div>
                                {m.notes && <div className="text-[11px] text-stone-400">{m.notes}</div>}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-semibold text-stone-800">
                                {m.quantityRequired} <span className="text-xs font-normal text-stone-500">{unitLabel}</span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs">
                                <span className={inStock <= 0 ? 'text-red-600 font-bold' : isLowOrOut ? 'text-amber-600 font-semibold' : 'text-stone-700'}>
                                  {inStock} {unitLabel}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(m)}
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border transition ${
                                    m.active
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-stone-100 text-stone-500 border-stone-200'
                                  }`}
                                >
                                  {m.active ? 'Active' : 'Disabled'}
                                </button>
                              </td>
                              <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingMapping(m);
                                      setMappingForm({
                                        inventoryItemId: inv?._id || '',
                                        quantityRequired: m.quantityRequired,
                                        notes: m.notes || '',
                                      });
                                      setShowAddModal(true);
                                    }}
                                    className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                                    title="Edit required quantity"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMapping(m._id)}
                                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                                    title="Remove ingredient"
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
        </div>
      </div>

      {/* MODAL: ADD / EDIT RECIPE MAPPING */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="font-display text-lg font-bold text-stone-900">
              {editingMapping ? 'Edit Recipe Ingredient' : 'Link Ingredient / Material'}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              For menu item: <strong>{currentProduct?.name}</strong>
            </p>

            <form onSubmit={handleSaveMapping} className="mt-4 space-y-4">
              {!editingMapping ? (
                <div>
                  <label className="block text-xs font-semibold text-stone-600">Select Inventory Item *</label>
                  <select
                    required
                    value={mappingForm.inventoryItemId}
                    onChange={(e) => setMappingForm({ ...mappingForm, inventoryItemId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brew-500 focus:outline-none"
                  >
                    <option value="">-- Choose Item --</option>
                    {availableItemsForProduct.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name} ({item.currentQuantity} {UNIT_LABELS[item.unit] || item.unit} in stock)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-xs text-stone-600">
                  Item: <strong className="text-stone-900">{typeof editingMapping.inventoryItem === 'object' ? editingMapping.inventoryItem.name : ''}</strong>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-600">Required Quantity Per Portion *</label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  placeholder="e.g. 1 (cup) or 50 (grams) or 1 (straw)"
                  value={mappingForm.quantityRequired}
                  onChange={(e) => setMappingForm({ ...mappingForm, quantityRequired: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-stone-400">Amount automatically deducted each time 1 of this dish is ordered.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Medium size cup or 1 scoop"
                  value={mappingForm.notes}
                  onChange={(e) => setMappingForm({ ...mappingForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm focus:border-brew-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
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
                  {editingMapping ? 'Update Recipe' : 'Add to Recipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
