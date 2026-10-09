import { useEffect, useMemo, useState } from 'react';
import {
  Grid,
  List,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Package,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { formatMoney } from '../utils/money';
import PageHeader from '../components/common/PageHeader';
import ImageWithFallback from '../components/common/ImageWithFallback';
import ImageUploader from '../components/common/ImageUploader';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import Drawer from '../components/common/Drawer';

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  category: '',
  image: '',
  available: true,
  availableFrom: '',
  availableUntil: '',
  popular: false,
  prepTime: 10,
  addons: [],
  variants: []
};

const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function ProductsPage() {
  const tenant = useTenant();
  const currency = tenant.currency || tenant.settings?.currency || '₹';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [loading, setLoading] = useState(true);

  // Drawer / Form state
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Confirm delete dialog
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, product: null });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productResponse, categoryResponse] = await Promise.all([
        api.get('/menu'),
        api.get('/categories/all').catch(() => api.get('/categories')),
      ]);
      setProducts(productResponse.data.products || []);
      setCategories(categoryResponse.data.categories || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = !query || product.name?.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !selectedCategory || (product.category?._id || product.category) === selectedCategory;
    return matchesSearch && matchesCategory;
  }), [products, query, selectedCategory]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, category: categories[0]?._id || '' });
    setShowDrawer(true);
  };

  const openEdit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      category: product.category?._id || product.category || '',
      image: product.image || '',
      available: product.available,
      availableFrom: toLocalDateTime(product.availableFrom),
      availableUntil: toLocalDateTime(product.availableUntil),
      popular: product.popular || false,
      prepTime: product.prepTime || 10,
      addons: product.addons || [],
      variants: product.variants || [],
    });
    setShowDrawer(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!form.name.trim() || !form.category || !form.price) {
      toast.error('Name, category and price are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        prepTime: Number(form.prepTime),
        availableFrom: form.availableFrom ? new Date(form.availableFrom).toISOString() : null,
        availableUntil: form.availableUntil ? new Date(form.availableUntil).toISOString() : null,
      };

      if (editingId) {
        const { data } = await api.put(`/menu/${editingId}`, payload);
        setProducts((current) => current.map((p) => p._id === editingId ? data.product : p));
        toast.success('Product updated');
      } else {
        const { data } = await api.post('/menu', payload);
        setProducts((current) => [data.product, ...current]);
        toast.success('Product created');
      }

      setShowDrawer(false);
    } catch (error) {
      toast.error(error.message || 'Unable to save product');
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (product) => {
    try {
      const { data } = await api.put(`/menu/${product._id}`, { available: !product.available });
      setProducts((current) => current.map((item) => item._id === product._id ? data.product : item));
      toast.success(data.product.available ? `${product.name} is now Available` : `${product.name} is hidden`);
    } catch (error) {
      toast.error(error.message || 'Unable to update availability');
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm.product) return;
    try {
      await api.delete(`/menu/${deleteConfirm.product._id}`);
      setProducts((current) => current.filter((item) => item._id !== deleteConfirm.product._id));
      toast.success('Product removed');
      setDeleteConfirm({ isOpen: false, product: null });
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Menu & Products"
        subtitle="Manage food items, vegetarian tags, pricing, and live kitchen availability."
        breadcrumbs={[
          { label: 'Catalog', to: '/products' },
          { label: 'Products' }
        ]}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
          >
            <Plus size={15} />
            <span>Add Product</span>
          </button>
        }
      />

      {/* Search & Filter Bar */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes, drinks, bakery..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 py-2 pl-9.5 pr-8 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Dropdown & View Mode Switcher */}
          <div className="flex items-center gap-2.5">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 focus:border-amber-500 focus:outline-none"
            >
              <option value="">All Categories ({products.length})</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>

            <div className="flex items-center rounded-xl border border-stone-200 bg-stone-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1 ${
                  viewMode === 'grid'
                    ? 'bg-white text-espresso-950 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title="Grid View"
              >
                <Grid size={13} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1 ${
                  viewMode === 'table'
                    ? 'bg-white text-espresso-950 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title="Table View"
              >
                <List size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl bg-stone-100 border border-stone-200/60" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No menu items found"
          description={query ? `No items matched "${query}".` : "Start building your menu by adding dishes and drinks."}
          actionLabel="Add first product"
          onAction={openCreate}
        />
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const isAvailable = product.available;
            return (
              <div
                key={product._id}
                className={`flex flex-col justify-between overflow-hidden rounded-3xl border bg-white shadow-xs transition duration-200 hover:shadow-md ${
                  isAvailable ? 'border-stone-200/90' : 'border-stone-200 bg-stone-50/60 opacity-80'
                }`}
              >
                <div>
                  {/* Image with fallback */}
                  <div className="relative h-44 w-full bg-stone-100 overflow-hidden">
                    <ImageWithFallback
                      src={product.image}
                      alt={product.name}
                      fallbackText={product.name}
                      className={`h-full w-full object-cover transition-transform duration-300 hover:scale-105 ${
                        !isAvailable ? 'grayscale-[60%]' : ''
                      }`}
                    />

                    {/* Vegetarian green badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-lg bg-white/95 px-2 py-1 shadow-xs backdrop-blur-xs">
                      <span className="flex h-3 w-3 items-center justify-center rounded-[3px] border border-emerald-600 p-[1.5px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800">VEG</span>
                    </div>

                    {/* Popular badge */}
                    {product.popular && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                        <Star size={11} fill="currentColor" /> Bestseller
                      </div>
                    )}

                    {!isAvailable && (
                      <div className="absolute inset-0 bg-stone-900/40 flex items-center justify-center">
                        <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-md">
                          Out of Stock / Hidden
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-base font-bold text-espresso-950 leading-snug">
                          {product.name}
                        </h3>
                        <p className="text-xs text-stone-500 font-medium">
                          {product.category?.name || 'Unassigned'}
                        </p>
                      </div>
                      <span className="font-mono text-base font-bold text-espresso-950 tabular-nums">
                        {formatMoney(product.price, currency)}
                      </span>
                    </div>

                    {product.description && (
                      <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1 text-[11px] text-stone-400">
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> ~{product.prepTime || 10}m
                      </span>
                      {product.variants?.length > 0 && (
                        <span>• {product.variants.length} sizes</span>
                      )}
                      {product.addons?.length > 0 && (
                        <span>• {product.addons.length} add-ons</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t border-stone-100 p-3.5 flex items-center justify-between bg-stone-50/50">
                  <button
                    type="button"
                    onClick={() => toggleAvailability(product)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold transition text-stone-700 hover:text-stone-900"
                  >
                    {isAvailable ? (
                      <ToggleRight size={20} className="text-emerald-500" />
                    ) : (
                      <ToggleLeft size={20} className="text-stone-400" />
                    )}
                    <span>{isAvailable ? 'Available' : 'Unavailable'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                      className="rounded-lg border border-stone-200 bg-white p-1.5 text-stone-600 hover:bg-stone-50 shadow-2xs transition"
                      title="Edit Product"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ isOpen: true, product })}
                      className="rounded-lg border border-stone-200 bg-white p-1.5 text-rose-500 hover:bg-rose-50 shadow-2xs transition"
                      title="Delete Product"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 bg-stone-50/80 font-bold uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Prep Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredProducts.map((product) => (
                  <tr key={product._id} className="hover:bg-stone-50/50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                          <ImageWithFallback
                            src={product.image}
                            alt={product.name}
                            fallbackText={product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-2.5 w-2.5 items-center justify-center rounded-[2px] border border-emerald-600 p-[1px]">
                              <span className="h-1 w-1 rounded-full bg-emerald-600" />
                            </span>
                            <span className="font-bold text-stone-900">{product.name}</span>
                          </div>
                          {product.popular && (
                            <span className="text-[10px] text-amber-600 font-semibold">★ Bestseller</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-stone-600">
                      {product.category?.name || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 font-bold text-stone-900 tabular-nums font-mono">
                      {formatMoney(product.price, currency)}
                    </td>
                    <td className="py-3 px-4 text-stone-500">
                      ~{product.prepTime || 10} min
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleAvailability(product)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                          product.available
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-stone-100 text-stone-600 border-stone-200'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${product.available ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                        {product.available ? 'Available' : 'Hidden'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(product)}
                          className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ isOpen: true, product })}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT DRAWER */}
      <Drawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        title={editingId ? 'Edit Product' : 'Add New Product'}
        subtitle="Configure dish ingredients, pricing, image, and options."
        width="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowDrawer(false)}
              className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold shadow-xs"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Image Uploader */}
          <ImageUploader
            value={form.image}
            onChange={(val) => setForm((cur) => ({ ...cur, image: val }))}
            label="Product Photo (Veg)"
            fallbackText={form.name || 'Food'}
          />

          {/* Name & Category */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((cur) => ({ ...cur, name: e.target.value }))}
                placeholder="e.g. Classic Cappuccino, Paneer Tikka Croissant..."
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Category *
              </label>
              <select
                required
                value={form.category}
                onChange={(e) => setForm((cur) => ({ ...cur, category: e.target.value }))}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Price & Prep time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Base Price ({currency}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={form.price}
                  onChange={(e) => setForm((cur) => ({ ...cur, price: e.target.value }))}
                  placeholder="249"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Prep Time (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={form.prepTime}
                  onChange={(e) => setForm((cur) => ({ ...cur, prepTime: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((cur) => ({ ...cur, description: e.target.value }))}
                placeholder="Crispy artisan sourdough toast topped with spiced Hass avocado and pomegranate pearls..."
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Variants / Sizes */}
          <div className="rounded-2xl border border-stone-200 p-3.5 space-y-2 bg-stone-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Sizes & Portions
              </span>
              <button
                type="button"
                onClick={() => setForm((cur) => ({ ...cur, variants: [...cur.variants, { name: '', price: '' }] }))}
                className="text-xs font-semibold text-amber-800 hover:text-amber-900"
              >
                + Add size
              </button>
            </div>
            {form.variants.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Regular / Large"
                  value={v.name}
                  onChange={(e) => setForm((cur) => ({
                    ...cur,
                    variants: cur.variants.map((it, idx) => idx === i ? { ...it, name: e.target.value } : it)
                  }))}
                  className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={v.price}
                  onChange={(e) => setForm((cur) => ({
                    ...cur,
                    variants: cur.variants.map((it, idx) => idx === i ? { ...it, price: e.target.value } : it)
                  }))}
                  className="w-24 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setForm((cur) => ({ ...cur, variants: cur.variants.filter((_, idx) => idx !== i) }))}
                  className="p-1.5 text-stone-400 hover:text-red-500"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="rounded-2xl border border-stone-200 p-3.5 space-y-2 bg-stone-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Add-ons / Customizations
              </span>
              <button
                type="button"
                onClick={() => setForm((cur) => ({ ...cur, addons: [...cur.addons, { name: '', price: '' }] }))}
                className="text-xs font-semibold text-amber-800 hover:text-amber-900"
              >
                + Add add-on
              </button>
            </div>
            {form.addons.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Extra Cheese / Oat Milk"
                  value={a.name}
                  onChange={(e) => setForm((cur) => ({
                    ...cur,
                    addons: cur.addons.map((it, idx) => idx === i ? { ...it, name: e.target.value } : it)
                  }))}
                  className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={a.price}
                  onChange={(e) => setForm((cur) => ({
                    ...cur,
                    addons: cur.addons.map((it, idx) => idx === i ? { ...it, price: e.target.value } : it)
                  }))}
                  className="w-24 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setForm((cur) => ({ ...cur, addons: cur.addons.filter((_, idx) => idx !== i) }))}
                  className="p-1.5 text-stone-400 hover:text-red-500"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Flags */}
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.available}
                onChange={(e) => setForm((cur) => ({ ...cur, available: e.target.checked }))}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              Available for Ordering
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.popular}
                onChange={(e) => setForm((cur) => ({ ...cur, popular: e.target.checked }))}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              Mark as Bestseller
            </label>
          </div>
        </form>
      </Drawer>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={`Delete "${deleteConfirm.product?.name}"?`}
        message="This item will be removed from your active café menu and will no longer appear on QR ordering."
        confirmText="Delete Product"
        confirmVariant="danger"
        onConfirm={executeDelete}
        onClose={() => setDeleteConfirm({ isOpen: false, product: null })}
      />
    </div>
  );
}
