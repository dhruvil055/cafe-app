import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Loader2, Search, ToggleLeft, ToggleRight, X, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/api';

const EMPTY_FORM = {
  name: '', description: '', price: '', category: '',
  isVeg: true, available: true, popular: false,
  image: '', prepTime: 10, addons: [], variants: [],
};

const PLACEHOLDER = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&q=70';

export default function AdminMenu() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  // Addon/variant input state
  const [addonInput, setAddonInput] = useState({ name: '', price: '' });
  const [variantInput, setVariantInput] = useState({ name: '', price: '' });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/menu'),
        api.get('/categories/all'),
      ]);
      setProducts(pRes.data.products);
      setCategories(cRes.data.categories);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: categories[0]?._id || '' });
    setImageFile(null);
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditing(product._id);
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      category: product.category?._id || product.category,
      isVeg: product.isVeg,
      available: product.available,
      popular: product.popular || false,
      image: product.image || '',
      prepTime: product.prepTime || 10,
      addons: product.addons || [],
      variants: product.variants || [],
    });
    setImageFile(null);
    setShowModal(true);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/upload/image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm(f => ({ ...f, image: res.data.url }));
      toast.success('Image uploaded');
    } catch { toast.error('Image upload failed'); }
    finally { setUploadingImg(false); }
  };

  const addAddon = () => {
    if (!addonInput.name || addonInput.price === '') return;
    setForm(f => ({ ...f, addons: [...f.addons, { name: addonInput.name, price: Number(addonInput.price) }] }));
    setAddonInput({ name: '', price: '' });
  };

  const addVariant = () => {
    if (!variantInput.name || variantInput.price === '') return;
    setForm(f => ({ ...f, variants: [...f.variants, { name: variantInput.name, price: Number(variantInput.price) }] }));
    setVariantInput({ name: '', price: '' });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price || !form.category) {
      toast.error('Name, price, and category are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price), prepTime: Number(form.prepTime) };
      if (editing) {
        const res = await api.put(`/menu/${editing}`, payload);
        setProducts(prev => prev.map(p => p._id === editing ? res.data.product : p));
        toast.success('Item updated');
      } else {
        const res = await api.post('/menu', payload);
        setProducts(prev => [res.data.product, ...prev]);
        toast.success('Item added');
      }
      setShowModal(false);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this item?')) return;
    setDeleting(id);
    try {
      await api.delete(`/menu/${id}`);
      setProducts(prev => prev.filter(p => p._id !== id));
      toast.success('Item deleted');
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(null); }
  };

  const toggleAvailable = async (product) => {
    try {
      const res = await api.put(`/menu/${product._id}`, { available: !product.available });
      setProducts(prev => prev.map(p => p._id === product._id ? res.data.product : p));
    } catch { toast.error('Update failed'); }
  };

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || (p.category?._id || p.category) === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <AdminLayout title="Menu Items">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brew-300"
          />
        </div>

        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>

        <button onClick={openAdd} className="btn-accent flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={16} /> Add Item
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-brew-500" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="font-medium">No items found</p>
          <button onClick={openAdd} className="mt-4 btn-primary text-sm py-2 px-5">Add First Item</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(product => (
            <motion.div
              key={product._id}
              layout
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={product.image || PLACEHOLDER}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={e => { e.target.src = PLACEHOLDER; }}
                />
                {!product.available && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-xs font-medium bg-black/60 px-2 py-1 rounded-full">Unavailable</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className={`w-4 h-4 rounded-sm border flex items-center justify-center bg-white
                    ${product.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${product.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                  </span>
                </div>
                {product.popular && (
                  <div className="absolute top-2 right-2">
                    <Star size={14} className="text-yellow-400 fill-yellow-400" />
                  </div>
                )}
              </div>

              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-espresso-900 text-sm truncate">{product.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{product.category?.name}</p>
                  </div>
                  <span className="font-display font-bold text-espresso-900 text-sm flex-shrink-0">₹{product.price}</span>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => toggleAvailable(product)}
                    className={`flex items-center gap-1 text-xs font-medium transition-colors
                      ${product.available ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    {product.available
                      ? <ToggleRight size={18} className="text-green-500" />
                      : <ToggleLeft size={18} />}
                    {product.available ? 'Available' : 'Hidden'}
                  </button>

                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(product)}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center
                                 text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      disabled={deleting === product._id}
                      className="w-7 h-7 rounded-lg border border-red-100 flex items-center justify-center
                                 text-red-400 hover:bg-red-50 transition-colors"
                    >
                      {deleting === product._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col shadow-2xl"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="font-display font-bold text-espresso-900">{editing ? 'Edit Item' : 'Add Menu Item'}</h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Image */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Image</label>
                  <div className="relative">
                    {form.image && (
                      <img src={form.image} alt="preview" className="w-full h-32 object-cover rounded-xl mb-2 bg-gray-100" onError={e => { e.target.src = PLACEHOLDER; }} />
                    )}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={form.image}
                        onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                        placeholder="Image URL (or upload below)"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brew-300"
                      />
                      <label className={`px-3 py-2 border border-gray-200 rounded-xl text-xs cursor-pointer
                        hover:bg-gray-50 transition-colors whitespace-nowrap flex items-center gap-1
                        ${uploadingImg ? 'opacity-60 pointer-events-none' : ''}`}>
                        {uploadingImg ? <Loader2 size={12} className="animate-spin" /> : '📁'}
                        Upload
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          if (e.target.files[0]) handleImageUpload(e.target.files[0]);
                        }} />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Basic fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Name *</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Item name"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brew-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="149"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brew-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Prep Time (min)</label>
                    <input
                      type="number"
                      value={form.prepTime}
                      onChange={e => setForm(f => ({ ...f, prepTime: e.target.value }))}
                      placeholder="10"
                      min="1"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brew-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white"
                  >
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Short description..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brew-300"
                  />
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'isVeg', label: 'Vegetarian', on: '🟢', off: '🔴' },
                    { key: 'available', label: 'Available', on: '✅', off: '❌' },
                    { key: 'popular', label: 'Popular', on: '⭐', off: '☆' },
                  ].map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, [t.key]: !f[t.key] }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all
                        ${form[t.key] ? 'bg-espresso-900 text-cream border-espresso-900' : 'bg-white border-gray-200 text-gray-600'}`}
                    >
                      {form[t.key] ? t.on : t.off} {t.label}
                    </button>
                  ))}
                </div>

                {/* Variants */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Variants (e.g. sizes)</label>
                  <div className="space-y-1.5 mb-2">
                    {form.variants.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                        <span className="text-sm flex-1">{v.name} — ₹{v.price}</span>
                        <button onClick={() => setForm(f => ({ ...f, variants: f.variants.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={variantInput.name}
                      onChange={e => setVariantInput(v => ({ ...v, name: e.target.value }))}
                      placeholder="e.g. Large (12&quot;)"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                    />
                    <input
                      type="number"
                      value={variantInput.price}
                      onChange={e => setVariantInput(v => ({ ...v, price: e.target.value }))}
                      placeholder="₹"
                      className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                    />
                    <button onClick={addVariant} className="px-3 py-2 bg-espresso-900 text-cream rounded-xl text-sm"><Plus size={14} /></button>
                  </div>
                </div>

                {/* Add-ons */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Add-ons</label>
                  <div className="space-y-1.5 mb-2">
                    {form.addons.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                        <span className="text-sm flex-1">{a.name} — {a.price === 0 ? 'Free' : `+₹${a.price}`}</span>
                        <button onClick={() => setForm(f => ({ ...f, addons: f.addons.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={addonInput.name}
                      onChange={e => setAddonInput(a => ({ ...a, name: e.target.value }))}
                      placeholder="e.g. Extra Cheese"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                    />
                    <input
                      type="number"
                      value={addonInput.price}
                      onChange={e => setAddonInput(a => ({ ...a, price: e.target.value }))}
                      placeholder="₹"
                      className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                    />
                    <button onClick={addAddon} className="px-3 py-2 bg-espresso-900 text-cream rounded-xl text-sm"><Plus size={14} /></button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 flex gap-3">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editing ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
