import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Star, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const EMPTY_FORM = { name: '', description: '', price: '', category: '', image: '', available: true, popular: false, prepTime: 10, addons: [], variants: [] };

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productResponse, categoryResponse] = await Promise.all([
        api.get('/menu'),
        api.get('/categories/all'),
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
    setShowForm(true);
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
      popular: product.popular || false,
      prepTime: product.prepTime || 10,
      addons: product.addons || [],
      variants: product.variants || [],
    });
    setShowForm(true);
  };

  const handleSave = async () => {
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
      };

      if (editingId) {
        const { data } = await api.put(`/menu/${editingId}`, payload);
        setProducts((current) => current.map((product) => product._id === editingId ? data.product : product));
        toast.success('Product updated');
      } else {
        const { data } = await api.post('/menu', payload);
        setProducts((current) => [data.product, ...current]);
        toast.success('Product created');
      }

      setShowForm(false);
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
    } catch (error) {
      toast.error(error.message || 'Unable to update availability');
    }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await api.delete(`/menu/${productId}`);
      setProducts((current) => current.filter((item) => item._id !== productId));
      toast.success('Product removed');
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-espresso-400 focus:outline-none" />
        </div>

        <div className="flex items-center gap-3">
          <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm focus:border-espresso-400 focus:outline-none">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>{category.name}</option>
            ))}
          </select>

          <button onClick={openCreate} className="btn-primary rounded-xl px-4 py-2.5 text-sm">
            <span className="inline-flex items-center gap-2"><Plus size={15} /> Add product</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center text-stone-500"><Loader2 className="animate-spin" size={28} /></div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center text-stone-500">No products found.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <div key={product._id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
              <div className="relative h-48 bg-stone-100">
                <img src={product.image || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93'} alt={product.name} className="h-full w-full object-cover" />
                {!product.available && <div className="absolute inset-0 bg-black/40" />}
                {product.popular && <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-amber-600"><Star size={12} fill="currentColor" /> Popular</div>}
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-stone-900">{product.name}</div>
                    <div className="text-xs text-stone-500">{product.category?.name || 'Category'}</div>
                  </div>
                  <div className="text-lg font-bold text-stone-900">₹{product.price}</div>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => toggleAvailability(product)} className="inline-flex items-center gap-2 text-sm font-medium text-stone-600">
                    {product.available ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} className="text-stone-400" />}
                    {product.available ? 'Available' : 'Hidden'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"><Pencil size={14} /></button>
                    <button onClick={() => deleteProduct(product._id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[26px] bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-espresso-900">{editingId ? 'Edit product' : 'Add product'}</h2>
              <button onClick={() => setShowForm(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500">×</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Name</label>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:border-espresso-400 focus:outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Description</label>
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="h-24 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:border-espresso-400 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Price</label>
                <input type="number" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:border-espresso-400 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Preptime (min)</label>
                <input type="number" value={form.prepTime} onChange={(event) => setForm((current) => ({ ...current, prepTime: event.target.value }))} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:border-espresso-400 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Category</label>
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:border-espresso-400 focus:outline-none">
                  <option value="">Select category</option>
                  {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Image URL</label>
                <input value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:border-espresso-400 focus:outline-none" />
              </div>

              <div className="md:col-span-2 flex items-center gap-4">
                <button type="button" onClick={() => setForm((current) => ({ ...current, available: !current.available }))} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${form.available ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-stone-200 bg-stone-100 text-stone-600'}`}>
                  {form.available ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
                  {form.available ? 'Available' : 'Unavailable'}
                </button>
                <button type="button" onClick={() => setForm((current) => ({ ...current, popular: !current.popular }))} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${form.popular ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-stone-200 bg-stone-100 text-stone-600'}`}>
                  <Star size={14} fill={form.popular ? 'currentColor' : 'none'} />
                  {form.popular ? 'Featured' : 'Not featured'}
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary rounded-xl px-4 py-2.5 text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary rounded-xl px-4 py-2.5 text-sm">
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
