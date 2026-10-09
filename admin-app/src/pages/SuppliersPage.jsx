import { useState, useEffect } from 'react';
import {
  Truck, Plus, Search, Phone, Mail, MapPin, Building,
  FileText, Trash2, Edit, Loader2, X, CheckCircle2,
  RefreshCw, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import Drawer from '../components/common/Drawer';
import ConfirmDialog from '../components/common/ConfirmDialog';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer & Form State
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, supplier: null });

  // Form Fields
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [notes, setNotes] = useState('');

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const { data } = await api.get(`/suppliers?${params.toString()}`);
      setSuppliers(data.suppliers || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSuppliers();
  };

  const handleSaveSupplier = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        gstin: gstin.trim().toUpperCase(),
        paymentTerms,
        notes: notes.trim(),
      };

      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier._id}`, payload);
        toast.success('Supplier updated');
      } else {
        await api.post('/suppliers', payload);
        toast.success('Supplier created');
      }

      setShowDrawer(false);
      setEditingSupplier(null);
      resetForm();
      fetchSuppliers();
    } catch (error) {
      toast.error(error.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setPaymentTerms('net_30');
    setNotes('');
  };

  const handleEditClick = (sup) => {
    setEditingSupplier(sup);
    setName(sup.name || '');
    setContactPerson(sup.contactPerson || '');
    setPhone(sup.phone || '');
    setEmail(sup.email || '');
    setAddress(sup.address || '');
    setGstin(sup.gstin || '');
    setPaymentTerms(sup.paymentTerms || 'net_30');
    setNotes(sup.notes || '');
    setShowDrawer(true);
  };

  const executeDelete = async () => {
    if (!deleteConfirm.supplier) return;
    try {
      await api.delete(`/suppliers/${deleteConfirm.supplier._id}`);
      toast.success('Supplier removed');
      setDeleteConfirm({ isOpen: false, supplier: null });
      fetchSuppliers();
    } catch (error) {
      toast.error(error.message || 'Failed to delete supplier');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Suppliers & Vendors"
        subtitle="Manage coffee roasters, dairy farms, bakery suppliers, and procurement payment terms."
        breadcrumbs={[
          { label: 'Finance', to: '/dashboard' },
          { label: 'Suppliers' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setEditingSupplier(null);
                setShowDrawer(true);
              }}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
            >
              <Plus size={15} />
              <span>Add Supplier</span>
            </button>
            <button
              type="button"
              onClick={fetchSuppliers}
              className="p-2 rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition"
              title="Refresh suppliers"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {/* Search Bar */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search vendor name, contact person or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 py-2 pl-9.5 pr-8 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); fetchSuppliers(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Suppliers Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl bg-stone-100 border border-stone-200/60" />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers registered yet"
          description="Register dairy, coffee bean roasters, and bakery vendors to generate Purchase Orders."
          actionLabel="Add first supplier"
          onAction={() => { resetForm(); setShowDrawer(true); }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((sup) => (
            <div
              key={sup._id}
              className="flex flex-col justify-between rounded-3xl border border-stone-200/90 bg-white p-5 shadow-xs hover:shadow-md transition duration-200"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 font-display text-base font-bold text-amber-900 border border-amber-200/60">
                      {sup.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-espresso-950 truncate">
                        {sup.name}
                      </h3>
                      {sup.contactPerson && (
                        <p className="text-xs text-stone-500">{sup.contactPerson}</p>
                      )}
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                    Active
                  </span>
                </div>

                {/* Contact and tax details */}
                <div className="mt-4 space-y-1.5 text-xs text-stone-600">
                  {sup.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-stone-400 shrink-0" />
                      <span className="font-mono">{sup.phone}</span>
                    </div>
                  )}
                  {sup.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-stone-400 shrink-0" />
                      <span className="truncate">{sup.email}</span>
                    </div>
                  )}
                  {sup.gstin && (
                    <div className="flex items-center gap-2 text-[11px] font-mono text-stone-500">
                      <Building size={13} className="text-stone-400 shrink-0" />
                      <span>GSTIN: {sup.gstin}</span>
                    </div>
                  )}
                  {sup.address && (
                    <div className="flex items-center gap-2 text-[11px] text-stone-500">
                      <MapPin size={13} className="text-stone-400 shrink-0" />
                      <span className="truncate">{sup.address}</span>
                    </div>
                  )}
                </div>

                {sup.notes && (
                  <p className="mt-2 text-[11px] text-stone-500 italic bg-stone-50 p-2 rounded-xl border border-stone-100">
                    "{sup.notes}"
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  {sup.paymentTerms ? sup.paymentTerms.replace('_', ' ').toUpperCase() : 'NET 30'}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleEditClick(sup)}
                    className="rounded-lg p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition"
                    title="Edit Supplier"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ isOpen: true, supplier: sup })}
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition"
                    title="Delete Supplier"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QUICK-ADD SUPPLIER DRAWER */}
      <Drawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        title={editingSupplier ? `Edit ${editingSupplier.name}` : 'Register New Vendor'}
        subtitle="Save contact details, GSTIN, and credit terms for inventory purchase orders."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowDrawer(false)}
              className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSupplier}
              disabled={saving}
              className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold shadow-xs"
            >
              {saving ? 'Saving...' : editingSupplier ? 'Save Changes' : 'Create Supplier'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveSupplier} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Vendor / Business Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blue Tokai Roasters, Amul Dairy Supply..."
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Manager / Rep"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="orders@vendor.com"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                GSTIN
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="24ABCDE1234F1Z5"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono uppercase focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Payment Terms
            </label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            >
              <option value="immediate">Immediate / Cash on Delivery</option>
              <option value="net_15">Net 15 Days</option>
              <option value="net_30">Net 30 Days</option>
              <option value="net_60">Net 60 Days</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Delivery / Warehouse Address
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Warehouse address, city, pin code..."
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Internal Procurement Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Deliveries before 9 AM on Tuesdays"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>
        </form>
      </Drawer>

      {/* Universal Confirm Dialog for Delete */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={`Delete Supplier "${deleteConfirm.supplier?.name}"?`}
        message="This supplier will be removed from your active vendor list. Existing purchase order records will be retained."
        confirmText="Delete Supplier"
        confirmVariant="danger"
        onConfirm={executeDelete}
        onClose={() => setDeleteConfirm({ isOpen: false, supplier: null })}
      />
    </div>
  );
}
