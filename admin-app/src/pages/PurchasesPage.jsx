import { useState, useEffect } from 'react';
import {
  ShoppingBag, Plus, Search, Filter, CheckCircle2, AlertCircle,
  Clock, PackageCheck, Trash2, Eye, Loader2, X, PlusCircle,
  MinusCircle, Check, ArrowRight, RefreshCw, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { formatMoney } from '../utils/money';
import PageHeader from '../components/common/PageHeader';
import StatusPill from '../components/common/StatusPill';
import EmptyState from '../components/common/EmptyState';
import Drawer from '../components/common/Drawer';
import ConfirmDialog from '../components/common/ConfirmDialog';

const PO_STEPS = [
  { id: 'draft', label: 'Draft' },
  { id: 'ordered', label: 'Ordered' },
  { id: 'received', label: 'Received & Stocked' }
];

export default function PurchasesPage() {
  const tenant = useTenant();
  const currency = tenant?.currency || tenant?.settings?.currency || '₹';

  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Drawers & Modals
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [saving, setSaving] = useState(false);
  const [receiveConfirm, setReceiveConfirm] = useState({ isOpen: false, purchase: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, poId: null });

  // Form Fields
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([
    { inventoryItemId: '', quantity: 1, unitCost: 0, taxPercent: 5 },
  ]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== 'ALL') params.set('status', selectedStatus);
      if (selectedSupplier !== 'ALL') params.set('supplierId', selectedSupplier);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const [pRes, sRes, invRes] = await Promise.all([
        api.get(`/purchases?${params.toString()}`),
        api.get('/suppliers?active=true').catch(() => ({ data: { suppliers: [] } })),
        api.get('/inventory/items').catch(() => ({ data: { items: [] } })),
      ]);

      setPurchases(pRes.data.purchases || []);
      setSuppliers(sRes.data.suppliers || []);
      setInventoryItems(invRes.data.items || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedStatus, selectedSupplier]);

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { inventoryItemId: '', quantity: 1, unitCost: 0, taxPercent: 5 },
    ]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateLineItem = (index, field, value) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      if (field === 'inventoryItemId') {
        const item = inventoryItems.find((i) => i._id === value);
        if (item && item.costPerUnit) {
          updated[index].unitCost = item.costPerUnit;
        }
      }
      return updated;
    });
  };

  const calculatedTotals = () => {
    let subtotal = 0;
    let tax = 0;
    for (const item of lineItems) {
      const base = Number(item.quantity || 0) * Number(item.unitCost || 0);
      const itemTax = (base * Number(item.taxPercent || 0)) / 100;
      subtotal += base;
      tax += itemTax;
    }
    return {
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number((subtotal + tax).toFixed(2)),
    };
  };

  const handleCreatePO = async (e) => {
    e?.preventDefault();
    if (!supplierId) {
      toast.error('Select a vendor supplier');
      return;
    }

    const invalidItem = lineItems.find((i) => !i.inventoryItemId || Number(i.quantity) <= 0);
    if (invalidItem) {
      toast.error('Select an inventory item and enter valid quantity for all rows');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        supplierId,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        paymentMethod,
        notes: notes.trim(),
        items: lineItems.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          taxPercent: Number(i.taxPercent),
        })),
      };

      await api.post('/purchases', payload);
      toast.success('Purchase Order created');
      setShowCreateDrawer(false);
      resetPOForm();
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  const resetPOForm = () => {
    setSupplierId('');
    setInvoiceNumber('');
    setPaymentMethod('bank_transfer');
    setNotes('');
    setLineItems([{ inventoryItemId: '', quantity: 1, unitCost: 0, taxPercent: 5 }]);
  };

  const executeMarkReceived = async () => {
    if (!receiveConfirm.purchase) return;
    try {
      const { data } = await api.patch(`/purchases/${receiveConfirm.purchase._id}/status`, { status: 'received' });
      toast.success('Stock received and inventory quantities replenished!');
      setReceiveConfirm({ isOpen: false, purchase: null });
      fetchData();
      if (viewingPurchase?._id === receiveConfirm.purchase._id) {
        setViewingPurchase(data.purchase);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to mark received');
    }
  };

  const executeDeletePO = async () => {
    if (!deleteConfirm.poId) return;
    try {
      await api.delete(`/purchases/${deleteConfirm.poId}`);
      toast.success('Purchase order removed');
      setDeleteConfirm({ isOpen: false, poId: null });
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const totals = calculatedTotals();

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Purchase Orders & Procurement"
        subtitle="Manage coffee beans, milk, syrups, and ingredient replenishment orders."
        breadcrumbs={[
          { label: 'Finance', to: '/dashboard' },
          { label: 'Purchases' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { resetPOForm(); setShowCreateDrawer(true); }}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
            >
              <Plus size={15} />
              <span>New Purchase Order</span>
            </button>
            <button
              type="button"
              onClick={fetchData}
              className="p-2 rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition"
              title="Refresh purchase orders"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-50 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received & Stocked</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-50 focus:outline-none"
          >
            <option value="ALL">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Purchase Orders Table with Status Stepper */}
      <div className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-stone-400">Loading procurement orders...</div>
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No purchase orders found"
            description="Create purchase orders to procure roasted beans, dairy, and food supplies from vendors."
            actionLabel="Create first purchase order"
            onAction={() => { resetPOForm(); setShowCreateDrawer(true); }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 bg-stone-50/70 font-bold uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4">Status & Stepper</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {purchases.map((po) => {
                  const status = po.status || 'draft';
                  const stepIndex = status === 'received' ? 2 : status === 'ordered' ? 1 : 0;

                  return (
                    <tr key={po._id} className="hover:bg-stone-50/50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-900">
                        {po.poNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-stone-900">{po.supplier?.name || 'Unassigned'}</span>
                        {po.invoiceNumber && <p className="text-[10px] text-stone-400 font-mono">Inv: {po.invoiceNumber}</p>}
                      </td>
                      <td className="py-3.5 px-4 text-stone-600">
                        {new Date(po.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>

                      {/* PO Status Stepper (Draft → Ordered → Received) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {PO_STEPS.map((step, idx) => {
                            const isCompleted = idx <= stepIndex;
                            const isCurrent = idx === stepIndex;

                            return (
                              <div key={step.id} className="flex items-center gap-1">
                                <span
                                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                                    isCompleted
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-stone-200 text-stone-600'
                                  }`}
                                >
                                  {isCompleted ? '✓' : idx + 1}
                                </span>
                                <span className={`text-[10px] ${isCurrent ? 'font-bold text-stone-900' : 'text-stone-400'}`}>
                                  {step.label}
                                </span>
                                {idx < PO_STEPS.length - 1 && (
                                  <ArrowRight size={10} className="text-stone-300 mx-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-espresso-950 tabular-nums">
                        {formatMoney(po.total, currency)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {po.status !== 'received' && (
                            <button
                              type="button"
                              onClick={() => setReceiveConfirm({ isOpen: true, purchase: po })}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs transition"
                            >
                              Receive Stock
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewingPurchase(po)}
                            className="rounded-lg p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100"
                            title="View PO Breakdown"
                          >
                            <Eye size={14} />
                          </button>
                          {po.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm({ isOpen: true, poId: po._id })}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                              title="Delete Draft"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE PO DRAWER */}
      <Drawer
        isOpen={showCreateDrawer}
        onClose={() => setShowCreateDrawer(false)}
        title="Create Purchase Order"
        subtitle="Order consumables and ingredients from registered vendors."
        width="max-w-xl"
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <span className="text-stone-400">Total PO Value: </span>
              <span className="font-mono font-bold text-espresso-950 text-sm">
                {formatMoney(totals.total, currency)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateDrawer(false)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePO}
                disabled={saving}
                className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold shadow-xs"
              >
                {saving ? 'Creating...' : 'Issue Purchase Order'}
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleCreatePO} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Vendor / Supplier *
              </label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              >
                <option value="">Select supplier...</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Invoice / Ref Number
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-9042"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Line items table */}
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Procurement Items
              </span>
              <button
                type="button"
                onClick={addLineItem}
                className="text-xs font-semibold text-amber-800 hover:text-amber-900"
              >
                + Add item row
              </button>
            </div>

            <div className="space-y-2">
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-xl border border-stone-200 p-2.5 bg-stone-50/50">
                  <select
                    value={item.inventoryItemId}
                    onChange={(e) => updateLineItem(idx, 'inventoryItemId', e.target.value)}
                    className="flex-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="">Select inventory item...</option>
                    {inventoryItems.map((inv) => (
                      <option key={inv._id} value={inv._id}>
                        {inv.name} ({inv.unit || 'unit'})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                    className="w-16 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-center"
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Cost"
                    value={item.unitCost}
                    onChange={(e) => updateLineItem(idx, 'unitCost', e.target.value)}
                    className="w-20 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-right"
                  />

                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className="p-1 text-stone-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Drawer>

      {/* CONFIRM RECEIVE STOCK DIALOG */}
      <ConfirmDialog
        isOpen={receiveConfirm.isOpen}
        title={`Receive Stock for ${receiveConfirm.purchase?.poNumber}?`}
        message="This will mark the PO as fulfilled and automatically replenish your café's live inventory quantities."
        confirmText="Confirm Stock Received"
        confirmVariant="primary"
        onConfirm={executeMarkReceived}
        onClose={() => setReceiveConfirm({ isOpen: false, purchase: null })}
      />

      {/* CONFIRM DELETE PO DIALOG */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Draft Purchase Order?"
        message="This will remove the draft PO permanently."
        confirmText="Delete PO"
        confirmVariant="danger"
        onConfirm={executeDeletePO}
        onClose={() => setDeleteConfirm({ isOpen: false, poId: null })}
      />

      {/* PO DETAIL DRAWER */}
      <Drawer
        isOpen={Boolean(viewingPurchase)}
        onClose={() => setViewingPurchase(null)}
        title={viewingPurchase?.poNumber || 'Purchase Order'}
        subtitle={`Vendor: ${viewingPurchase?.supplier?.name || 'Unassigned'}`}
        width="max-w-md"
      >
        {viewingPurchase && (
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-400">Status:</span>
                <StatusPill status={viewingPurchase.status || 'draft'} size="xs" />
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Order Total:</span>
                <span className="font-mono font-bold text-stone-900">{formatMoney(viewingPurchase.total, currency)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">Ordered Items</h4>
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl bg-white p-3">
                {viewingPurchase.items?.map((it, idx) => (
                  <div key={idx} className="py-2 flex justify-between">
                    <span>{it.quantity}× {it.inventoryItem?.name || 'Item'}</span>
                    <span className="font-mono font-bold">{formatMoney(it.itemTotal || (it.quantity * it.unitCost), currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
