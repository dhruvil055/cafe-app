import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const ICONS = ['☕', '🍵', '🧊', '🥤', '🥪', '🍔', '🍕', '🍰', '⭐'];
const EMPTY_FORM = { name: '', icon: '☕', active: true, sortOrder: 0 };

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/categories/all');
      setCategories(data.categories || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (category) => {
    setEditingId(category._id);
    setForm({ name: category.name, icon: category.icon || '☕', active: category.active, sortOrder: category.sortOrder || 0 });
    setShowForm(true);
  };

  const saveCategory = async () => {
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, sortOrder: Number(form.sortOrder) };
      if (editingId) {
        const { data } = await api.put(`/categories/${editingId}`, payload);
        setCategories((current) => current.map((item) => item._id === editingId ? data.category : item));
        toast.success('Category updated');
      } else {
        const { data } = await api.post('/categories', payload);
        setCategories((current) => [...current, data.category]);
        toast.success('Category created');
      }
      setShowForm(false);
    } catch (error) {
      toast.error(error.message || 'Unable to save category');
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      setCategories((current) => current.filter((item) => item._id !== id));
      toast.success('Category deleted');
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const toggleCategory = async (category) => {
    try {
      const { data } = await api.put(`/categories/${category._id}`, { active: !category.active });
      setCategories((current) => current.map((item) => item._id === category._id ? data.category : item));
    } catch (error) {
      toast.error(error.message || 'Unable to update');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary rounded-xl px-4 py-2.5 text-sm">
          <span className="inline-flex items-center gap-2"><Plus size={15} /> Add category</span>
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center text-stone-500"><Loader2 className="animate-spin" size={28} /></div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center text-stone-500">No categories yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <div key={category._id} className={`rounded-2xl border bg-white p-4 shadow-soft ${category.active ? 'border-stone-200' : 'border-stone-200 opacity-70'}`}>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brew-50 text-3xl">{category.icon || '☕'}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-stone-900">{category.name}</div>
                  <div className="text-xs text-stone-500">Sort order: {category.sortOrder ?? 0}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button onClick={() => toggleCategory(category)} className="inline-flex items-center gap-2 text-sm font-medium text-stone-600">
                  {category.active ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} className="text-stone-400" />}
                  {category.active ? 'Active' : 'Hidden'}
                </button>

                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(category)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"><Pencil size={14} /></button>
                  <button onClick={() => deleteCategory(category._id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[26px] bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-espresso-900">{editingId ? 'Edit category' : 'Add category'}</h2>
              <button onClick={() => setShowForm(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Name</label>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:border-espresso-400 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Icon</label>
                <div className="grid grid-cols-5 gap-2">
                  {ICONS.map((icon) => (
                    <button key={icon} type="button" onClick={() => setForm((current) => ({ ...current, icon }))} className={`flex h-10 items-center justify-center rounded-xl border text-xl ${form.icon === icon ? 'border-espresso-900 bg-espresso-900 text-white' : 'border-stone-200 bg-stone-50 text-stone-600'}`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Sort order</label>
                <input type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:border-espresso-400 focus:outline-none" />
              </div>

              <button onClick={() => setForm((current) => ({ ...current, active: !current.active }))} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${form.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-stone-200 bg-stone-100 text-stone-600'}`}>
                {form.active ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
                {form.active ? 'Visible to customers' : 'Hidden from customers'}
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary rounded-xl px-4 py-2.5 text-sm">Cancel</button>
              <button onClick={saveCategory} disabled={saving} className="btn-primary rounded-xl px-4 py-2.5 text-sm">
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
