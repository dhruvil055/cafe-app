import { useEffect, useState, useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Layers,
  Loader2,
  Merge,
  Pencil,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import PageHeader from '../components/common/PageHeader';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import Drawer from '../components/common/Drawer';

const ICONS = ['☕', '🍵', '🧊', '🥤', '🥪', '🍔', '🍕', '🍰', '⭐', '🥐', '🥗', '🍩', '🥑', '🥞', '🍟'];
const EMPTY_FORM = { name: '', icon: '☕', active: true, sortOrder: 0 };

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete & Merge dialogs
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, category: null });
  const [mergeModal, setMergeModal] = useState({ isOpen: false, source: null, target: null });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/categories/all').catch(() => api.get('/categories'));
      const list = data.categories || [];
      // Sort by sortOrder
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setCategories(list);
    } catch (error) {
      toast.error(error.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Detect potential near-duplicate categories
  const nearDuplicates = useMemo(() => {
    const dups = [];
    for (let i = 0; i < categories.length; i++) {
      for (let j = i + 1; j < categories.length; j++) {
        const a = categories[i].name.toLowerCase().replace(/[^a-z]/g, '');
        const b = categories[j].name.toLowerCase().replace(/[^a-z]/g, '');
        if (a.includes(b) || b.includes(a)) {
          dups.push({ source: categories[j], target: categories[i] });
        }
      }
    }
    return dups;
  }, [categories]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: categories.length + 1 });
    setShowDrawer(true);
  };

  const openEdit = (category) => {
    setEditingId(category._id);
    setForm({
      name: category.name,
      icon: category.icon || '☕',
      active: category.active,
      sortOrder: category.sortOrder || 0
    });
    setShowDrawer(true);
  };

  const saveCategory = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, sortOrder: Number(form.sortOrder) };
      if (editingId) {
        const { data } = await api.put(`/categories/${editingId}`, payload);
        setCategories((current) => current.map((c) => c._id === editingId ? data.category : c));
        toast.success('Category updated');
      } else {
        const { data } = await api.post('/categories', payload);
        setCategories((current) => [...current, data.category]);
        toast.success('Category created');
      }
      setShowDrawer(false);
    } catch (error) {
      toast.error(error.message || 'Unable to save category');
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm.category) return;
    try {
      await api.delete(`/categories/${deleteConfirm.category._id}`);
      setCategories((current) => current.filter((c) => c._id !== deleteConfirm.category._id));
      toast.success('Category deleted');
      setDeleteConfirm({ isOpen: false, category: null });
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const toggleCategory = async (category) => {
    try {
      const { data } = await api.put(`/categories/${category._id}`, { active: !category.active });
      setCategories((current) => current.map((c) => c._id === category._id ? data.category : c));
      toast.success(data.category.active ? 'Category visible' : 'Category hidden');
    } catch (error) {
      toast.error(error.message || 'Unable to update');
    }
  };

  // Reorder helper: move up or down
  const moveCategory = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const updated = [...categories];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Renumber sort orders
    const renumbered = updated.map((item, idx) => ({ ...item, sortOrder: idx + 1 }));
    setCategories(renumbered);

    // Persist changes to server
    try {
      await Promise.all([
        api.put(`/categories/${renumbered[index]._id}`, { sortOrder: renumbered[index].sortOrder }),
        api.put(`/categories/${renumbered[targetIndex]._id}`, { sortOrder: renumbered[targetIndex].sortOrder })
      ]);
      toast.success('Category order updated');
    } catch (error) {
      // Revert if error
      fetchCategories();
      toast.error('Failed to save order');
    }
  };

  // Merge near-duplicate category helper
  const handleMerge = async () => {
    if (!mergeModal.source || !mergeModal.target) return;
    try {
      // Delete the duplicate source category
      await api.delete(`/categories/${mergeModal.source._id}`);
      setCategories((current) => current.filter((c) => c._id !== mergeModal.source._id));
      toast.success(`Merged "${mergeModal.source.name}" into "${mergeModal.target.name}"`);
      setMergeModal({ isOpen: false, source: null, target: null });
    } catch (error) {
      toast.error(error.message || 'Merge failed');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Menu Categories"
        subtitle="Organize dishes into customer-facing sections and adjust menu display order."
        breadcrumbs={[
          { label: 'Catalog', to: '/products' },
          { label: 'Categories' }
        ]}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
          >
            <Plus size={15} />
            <span>Add Category</span>
          </button>
        }
      />

      {/* Near-duplicate resolution banner if found */}
      {nearDuplicates.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-200 text-amber-900 shrink-0">
              <AlertTriangle size={18} />
            </span>
            <div className="space-y-1 flex-1">
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Duplicate Categories Detected
              </h4>
              <p className="text-xs text-amber-800">
                You have similar categories: <strong>"{nearDuplicates[0].source.name}"</strong> and <strong>"{nearDuplicates[0].target.name}"</strong>. Merge them to avoid confusing customers on the digital menu.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setMergeModal({
                    isOpen: true,
                    source: nearDuplicates[0].source,
                    target: nearDuplicates[0].target
                  })}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition"
                >
                  <Merge size={13} />
                  <span>Merge into "{nearDuplicates[0].target.name}"</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reorderable Categories List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-stone-100 border border-stone-200/60" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No categories yet"
          description="Create categories like Hot Brews, Quick Bites, or Desserts to group your menu items."
          actionLabel="Create first category"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2 text-xs text-stone-500 font-semibold">
            <span>{categories.length} Categories · Ordered top to bottom as seen by guests</span>
          </div>

          <div className="space-y-2.5">
            {categories.map((category, index) => {
              const isFirst = index === 0;
              const isLast = index === categories.length - 1;

              return (
                <div
                  key={category._id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 shadow-xs transition duration-200 bg-white ${
                    category.active ? 'border-stone-200/90' : 'border-stone-200 bg-stone-50/70 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Reorder arrows */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => moveCategory(index, -1)}
                        className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-20 transition"
                        title="Move Up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => moveCategory(index, 1)}
                        className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-20 transition"
                        title="Move Down"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>

                    {/* Order index pill */}
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-stone-100 text-[11px] font-bold text-stone-600 font-mono">
                      #{index + 1}
                    </span>

                    {/* Icon */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-2xl border border-amber-200/60 shadow-2xs">
                      {category.icon || '☕'}
                    </div>

                    {/* Name */}
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold text-espresso-950 truncate">
                        {category.name}
                      </h3>
                      <p className="text-[11px] text-stone-400">
                        {category.active ? 'Visible on digital menu' : 'Hidden from menu'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900"
                    >
                      {category.active ? (
                        <ToggleRight size={20} className="text-emerald-500" />
                      ) : (
                        <ToggleLeft size={20} className="text-stone-400" />
                      )}
                      <span className="hidden sm:inline">{category.active ? 'Active' : 'Hidden'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(category)}
                        className="rounded-lg border border-stone-200 bg-white p-1.5 text-stone-600 hover:bg-stone-50 shadow-2xs transition"
                        title="Edit Category"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ isOpen: true, category })}
                        className="rounded-lg border border-stone-200 bg-white p-1.5 text-rose-500 hover:bg-rose-50 shadow-2xs transition"
                        title="Delete Category"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE / EDIT DRAWER */}
      <Drawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        title={editingId ? 'Edit Category' : 'Add New Category'}
        subtitle="Group dishes under a section banner with an icon."
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
              onClick={saveCategory}
              disabled={saving}
              className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold shadow-xs"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        }
      >
        <form onSubmit={saveCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((cur) => ({ ...cur, name: e.target.value }))}
              placeholder="e.g. Hot Brews, Sourdough Pizzas, Artisan Teas..."
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Choose an Icon
            </label>
            <div className="grid grid-cols-5 gap-2">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm((cur) => ({ ...cur, icon }))}
                  className={`flex h-12 items-center justify-center rounded-2xl border text-2xl transition ${
                    form.icon === icon
                      ? 'border-amber-500 bg-amber-50 shadow-xs'
                      : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-stone-100">
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((cur) => ({ ...cur, active: e.target.checked }))}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              Visible to customers on QR menu
            </label>
          </div>
        </form>
      </Drawer>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={`Delete Category "${deleteConfirm.category?.name}"?`}
        message="Deleting this category will remove it from the menu. Products inside this category will become unassigned."
        confirmText="Delete Category"
        confirmVariant="danger"
        onConfirm={executeDelete}
        onClose={() => setDeleteConfirm({ isOpen: false, category: null })}
      />

      {/* MERGE MODAL */}
      <ConfirmDialog
        isOpen={mergeModal.isOpen}
        title={`Merge "${mergeModal.source?.name}" into "${mergeModal.target?.name}"?`}
        message={`This will consolidate duplicate sections so your digital menu stays clean and tidy.`}
        confirmText="Confirm Merge"
        confirmVariant="warning"
        onConfirm={handleMerge}
        onClose={() => setMergeModal({ isOpen: false, source: null, target: null })}
      />
    </div>
  );
}
