import { useState, useEffect } from 'react';
import {
  ShoppingBag, Plus, Search, Filter, CheckCircle2, AlertCircle,
  Clock, PackageCheck, Trash2, Eye, Loader2, X, PlusCircle, MinusCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { formatMoney } from '../utils/money';

const PO_STATUS_CONFIG = {
  draft: { label: 'Draft', bg: 'bg-stone-100 text-stone-700 border-stone-200' },
  ordered: { label: 'Ordered', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  received: { label: 'Received & Stocked', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50 text-red-700 border-red-200' },
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [saving, setSaving] = useState(false);

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
        api.get('/suppliers?active=true'),
        api.get('/inventory/items'),
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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  // Add line item row
  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { inventoryItemId: '', quantity: 1, unitCost: 0, taxPercent: 5 },
    ]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateLineItem = (index, field, value) => {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      // If inventoryItem changed, auto-fill unitCost from inventory item
      if (field === 'inventoryItemId') {
        const item = inventoryItems.find(i => i._id === value);
        if (item && item.costPerUnit) {
          updated[index].unitCost = item.costPerUnit;
        }
      }
      return updated;
    });
  };

  // Calculate live PO totals
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
    e.preventDefault();
    if (!supplierId) {
      toast.error('Select a supplier');
      return;
    }

    const invalidItem = lineItems.find(i => !i.inventoryItemId || Number(i.quantity) <= 0);
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
        items: lineItems.map(i => ({
          inventoryItemId: i.inventoryItemId,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          taxPercent: Number(i.taxPercent),
        })),
      };

      await api.post('/purchases', payload);
      toast.success('Purchase Order created');
      setShowCreateModal(false);
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

  // Mark PO Received & Replenish Stock
  const handleMarkReceived = async (purchase) => {
    if (!window.confirm(`Receive stock for ${purchase.poNumber}? This will automatically add quantities to your live inventory.`)) return;

    try {
      const { data } = await api.patch(`/purchases/${purchase._id}/status`, { status: 'received' });
      toast.success('Stock received and inventory quantities updated!');
      fetchData();
      if (viewingPurchase?._id === purchase._id) {
        setViewingPurchase(data.purchase);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to mark received');
    }
  };

  const handleDeletePO = async (id) => {
    if (!window.confirm('Delete this draft purchase order?')) return;
    try {
      await api.delete(`/purchases/${id}`);
      toast.success('Purchase order removed');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const totals = calculatedTotals();

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 focus:outline-none focus:border-brew-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received & Stocked</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Supplier Filter */}
          <select
            value={selectedSupplier}
            onChange={e => setSelectedSupplier(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 focus:outline-none focus:border-brew-500"
          >
            <option value="ALL">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            resetPOForm();
            setShowCreateModal(true);
          }}
          className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Plus size={14} /> Create Purchase Order
        </button>
      </div>

      {/* PO List Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex min-h-[250px] items-center justify-center text-stone-400">
            <Loader2 className="animate-spin text-brew-500" size={30} />
          </div>
        ) : purchases.length === 0 ? (
          <div className="py-20 text-center text-stone-400 text-sm">
            <ShoppingBag size={40} className="mx-auto text-stone-300 mb-2" />
            <p>No purchase orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">PO Number</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Items Count</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {purchases.map(po => {
                  const cfg = PO_STATUS_CONFIG[po.status] || PO_STATUS_CONFIG.draft;
                  return (
                    <tr key={po._id} className="hover:bg-stone-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                        {po.poNumber}
                        {po.invoiceNumber && (
                          <div className="text-[10px] text-stone-400 font-sans font-normal">Inv: {po.invoiceNumber}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-stone-800 whitespace-nowrap">
                        {po.supplier?.name || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-stone-600 whitespace-nowrap">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-stone-600 whitespace-nowrap">
                        {po.items?.length || 0} line item(s)
                      </td>
                      <td className="py-3.5 px-4 text-right font-display font-bold text-stone-900 text-sm whitespace-nowrap">
                        {formatMoney(po.total)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {po.status !== 'received' && (
                            <button
                              onClick={() => handleMarkReceived(po)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 shadow-sm"
                              title="Receive stock & update inventory quantities"
                            >
                              <PackageCheck size={12} /> Receive
                            </button>
                          )}
                          <button
                            onClick={() => setViewingPurchase(po)}
                            className="p-1 text-stone-400 hover:text-stone-700"
                            title="View PO Details"
                          >
                            <Eye size={14} />
                          </button>
                          {po.status === 'draft' && (
                            <button
                              onClick={() => handleDeletePO(po._id)}
                              className="p-1 text-stone-400 hover:text-red-500"
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

      {/* Create Purchase Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="mb-5 flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="font-display text-xl font-bold text-espresso-900">
                Create Purchase Order (PO)
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                    Vendor / Supplier *
                  </label>
                  <select
                    required
                    value={supplierId}
                    onChange={e => setSupplierId(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s._id} value={s._id}>{s.name} ({s.phone || 'No phone'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                    Supplier Invoice No. (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-98124"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-semibold text-stone-700 uppercase tracking-wider">
                    Procurement Line Items *
                  </label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="text-brew-600 hover:text-brew-800 font-semibold flex items-center gap-1 text-[11px]"
                  >
                    <PlusCircle size={13} /> Add Item Row
                  </button>
                </div>

                <div className="space-y-2 border border-stone-200 rounded-2xl p-3 bg-stone-50/50 max-h-60 overflow-y-auto">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs">
                      {/* Inventory Item Selection */}
                      <div className="flex-1 min-w-[140px]">
                        <select
                          required
                          value={item.inventoryItemId}
                          onChange={e => updateLineItem(idx, 'inventoryItemId', e.target.value)}
                          className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-xs focus:border-brew-500 focus:outline-none"
                        >
                          <option value="">-- Select Item --</option>
                          {inventoryItems.map(inv => (
                            <option key={inv._id} value={inv._id}>
                              {inv.name} ({inv.unit} · Stock: {inv.currentQuantity})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="w-20">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={e => updateLineItem(idx, 'quantity', e.target.value)}
                          className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-center focus:border-brew-500 focus:outline-none"
                        />
                      </div>

                      {/* Unit Cost */}
                      <div className="w-24">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="Rate ₹"
                          value={item.unitCost}
                          onChange={e => updateLineItem(idx, 'unitCost', e.target.value)}
                          className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-right focus:border-brew-500 focus:outline-none"
                        />
                      </div>

                      {/* Tax % */}
                      <div className="w-16">
                        <select
                          value={item.taxPercent}
                          onChange={e => updateLineItem(idx, 'taxPercent', e.target.value)}
                          className="w-full rounded-lg border border-stone-200 px-1 py-1.5 text-xs text-center focus:border-brew-500 focus:outline-none"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                        </select>
                      </div>

                      {/* Remove Row */}
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="text-stone-400 hover:text-red-500 p-1"
                        >
                          <MinusCircle size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Total Preview Box */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex justify-between text-stone-500">
                  <span>Subtotal (Base Cost):</span>
                  <span>{formatMoney(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Estimated GST / Tax:</span>
                  <span>{formatMoney(totals.tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-stone-900 border-t border-stone-200 pt-1.5 text-sm">
                  <span>Total Purchase Cost:</span>
                  <span className="font-display text-base text-brew-700">{formatMoney(totals.total)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                  >
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash on Delivery</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-stone-600 uppercase tracking-wider">
                    Notes / Delivery Instructions
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Inspect seal before unloading"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  <span>Generate Purchase Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO View Detail Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-espresso-950">
                  {viewingPurchase.poNumber}
                </h3>
                <p className="text-xs text-stone-500">
                  Vendor: <strong>{viewingPurchase.supplier?.name}</strong> · {new Date(viewingPurchase.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setViewingPurchase(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Line Items Table */}
            <div className="border border-stone-200 rounded-2xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Unit Rate</th>
                    <th className="p-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {viewingPurchase.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-medium text-stone-800">{item.name}</td>
                      <td className="p-2.5 text-center text-stone-600">{item.quantity} {item.unit}</td>
                      <td className="p-2.5 text-right text-stone-600">{formatMoney(item.unitCost)}</td>
                      <td className="p-2.5 text-right font-bold text-stone-900">{formatMoney(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-stone-50 rounded-xl p-3 text-xs flex justify-between items-center font-bold">
              <span>Total PO Value:</span>
              <span className="text-sm font-display text-brew-700">{formatMoney(viewingPurchase.total)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {viewingPurchase.status !== 'received' && (
                <button
                  onClick={() => handleMarkReceived(viewingPurchase)}
                  className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
                >
                  <PackageCheck size={14} /> Receive Stock Now
                </button>
              )}
              <button
                onClick={() => setViewingPurchase(null)}
                className="btn-secondary rounded-xl px-4 py-2 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
