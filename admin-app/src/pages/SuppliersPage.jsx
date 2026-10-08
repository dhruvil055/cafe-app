import { useState, useEffect } from 'react';
import {
  Truck, Plus, Search, Phone, Mail, MapPin, Building,
  FileText, Trash2, Edit, Loader2, X, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [saving, setSaving] = useState(false);

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
    e.preventDefault();
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

      setShowModal(false);
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
    setShowModal(true);
  };

  const handleDeleteSupplier = async (id, supName) => {
    if (!window.confirm(`Delete supplier "${supName}"?`)) return;
    try {
      await api.delete(`/suppliers/${id}`);
      toast.success('Supplier removed');
      fetchSuppliers();
    } catch (error) {
      toast.error(error.message || 'Failed to delete supplier');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search vendor name, contact person or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 text-stone-800 focus:outline-none focus:border-brew-500"
            />
          </div>
          <button type="submit" className="btn-secondary rounded-xl px-3 py-1.5 text-xs font-semibold">
            Search
          </button>
        </form>

        <button
          onClick={() => {
            resetForm();
            setEditingSupplier(null);
            setShowModal(true);
          }}
          className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Plus size={14} /> Add Supplier
        </button>
      </div>

      {/* Suppliers Grid */}
      {loading ? (
        <div className="flex min-h-[250px] items-center justify-center text-stone-400">
          <Loader2 className="animate-spin text-brew-500" size={30} />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white py-20 text-center text-stone-500">
          <Truck size={44} className="mx-auto text-stone-300 mb-3" />
          <p className="text-base font-semibold text-stone-700">No suppliers registered yet</p>
          <p className="text-xs text-stone-400 mt-1">Add milk, coffee bean, packaging, or bakery vendors</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(sup => (
            <div
              key={sup._id}
              className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-soft hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-brew-500/10 border border-brew-500/20 text-brew-700 font-bold flex items-center justify-center text-base">
                      {sup.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-stone-900 text-sm">
                        {sup.name}
                      </h3>
                      {sup.contactPerson && (
                        <p className="text-xs text-stone-500">{sup.contactPerson}</p>
                      )}
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>

                {/* Details */}
                <div className="mt-4 space-y-1.5 text-xs text-stone-600">
                  {sup.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-stone-400" />
                      <span>{sup.phone}</span>
                    </div>
                  )}
                  {sup.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-stone-400" />
                      <span className="truncate">{sup.email}</span>
                    </div>
                  )}
                  {sup.gstin && (
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-stone-400" />
                      <span className="font-mono text-[11px] font-semibold text-stone-800">GST: {sup.gstin}</span>
                    </div>
                  )}
                  {sup.address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-stone-400 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-stone-500 line-clamp-2">{sup.address}</span>
                    </div>
                  )}
                </div>

                {sup.notes && (
                  <p className="mt-3 text-[11px] text-stone-400 italic bg-stone-50 p-2 rounded-xl">
                    "{sup.notes}"
                  </p>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[11px] text-stone-400">
                  Terms: <strong className="text-stone-700 uppercase">{sup.paymentTerms || 'Net 30'}</strong>
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditClick(sup)}
                    className="p-1.5 text-stone-400 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition"
                    title="Edit Supplier"
                  >
                    <Edit size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(sup._id, sup.name)}
                    className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                    title="Delete Supplier"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-espresso-900">
                {editingSupplier ? 'Edit Supplier' : 'Register New Supplier'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                  Company / Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amul Dairy Distributors"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar"
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="vendor@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                    Vendor GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="24AAAAA0000A1Z5"
                    value={gstin}
                    onChange={e => setGstin(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono uppercase focus:border-brew-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                >
                  <option value="immediate">Immediate / Cash on Delivery</option>
                  <option value="net_7">Net 7 Days</option>
                  <option value="net_15">Net 15 Days</option>
                  <option value="net_30">Net 30 Days</option>
                  <option value="advance">100% Advance Payment</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                  Physical Address
                </label>
                <input
                  type="text"
                  placeholder="Plot No. 12, GIDC Estate, Ahmedabad"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Delivers every Tuesday and Friday morning"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold flex items-center gap-1.5"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingSupplier ? 'Save Changes' : 'Create Supplier'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
