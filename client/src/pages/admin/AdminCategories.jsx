import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Loader2, X, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/api';

const ICONS = ['☕','🍵','🧊','🥤','🥪','🍔','🍕','🍰','⭐','🍜','🥗','🍹','🧁','🥐','🍱'];
const EMPTY = { name: '', icon: '☕', active: true, sortOrder: 0 };

export default function AdminCategories() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const fetchCats = () => {
    setLoading(true);
    api.get('/categories/all')
      .then(res => setCats(res.data.categories))
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCats(); }, []);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (cat) => { setEditing(cat._id); setForm({ name: cat.name, icon: cat.icon, active: cat.active, sortOrder: cat.sortOrder || 0 }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Category name is required.'); return; }
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put(`/categories/${editing}`, form);
        setCats(prev => prev.map(c => c._id === editing ? res.data.category : c));
        toast.success('Category updated');
      } else {
        const res = await api.post('/categories', form);
        setCats(prev => [...prev, res.data.category]);
        toast.success('Category added');
      }
      setShowModal(false);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this category? Items in it won\'t be deleted.')) return;
    setDeleting(id);
    try {
      await api.delete(`/categories/${id}`);
      setCats(prev => prev.filter(c => c._id !== id));
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(null); }
  };

  const toggleActive = async (cat) => {
    try {
      const res = await api.put(`/categories/${cat._id}`, { active: !cat.active });
      setCats(prev => prev.map(c => c._id === cat._id ? res.data.category : c));
    } catch { toast.error('Update failed'); }
  };

  return (
    <AdminLayout title="Categories">
      <div className="flex justify-end mb-5">
        <button onClick={openAdd} className="btn-accent flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={16} /> Add Category
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-brew-500" size={28} /></div>
      ) : cats.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🏷️</p>
          <p className="font-medium">No categories yet</p>
          <button onClick={openAdd} className="mt-4 btn-primary text-sm py-2 px-5">Add First Category</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cats.map(cat => (
            <motion.div
              key={cat._id}
              layout
              className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4
                ${cat.active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}
            >
              <div className="w-14 h-14 bg-brew-50 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-espresso-900 truncate">{cat.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Order: {cat.sortOrder ?? 0}</p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <div className="flex gap-1">
                  <button onClick={() => openEdit(cat)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(cat._id)} disabled={deleting === cat._id} className="w-7 h-7 rounded-lg border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-50">
                    {deleting === cat._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
                <button onClick={() => toggleActive(cat)} className={`flex items-center gap-1 text-xs font-medium ${cat.active ? 'text-green-600' : 'text-gray-400'}`}>
                  {cat.active ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                  {cat.active ? 'Active' : 'Hidden'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
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
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-espresso-900">{editing ? 'Edit Category' : 'Add Category'}</h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50">
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Coffee"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brew-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Icon</label>
                <div className="grid grid-cols-8 gap-1.5">
                  {ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setForm(f => ({ ...f, icon }))}
                      className={`w-9 h-9 text-xl rounded-xl flex items-center justify-center transition-all
                        ${form.icon === icon ? 'bg-espresso-900 shadow-md' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Sort Order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                  min="0"
                />
              </div>

              <button
                onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all
                  ${form.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
              >
                {form.active ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                {form.active ? 'Active — visible to customers' : 'Hidden from customers'}
              </button>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editing ? 'Save' : 'Add'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
