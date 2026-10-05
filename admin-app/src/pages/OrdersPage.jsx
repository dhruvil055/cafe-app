import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, ChevronDown, Loader2, Printer, RefreshCw, Search, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { formatMoney } from '../utils/money';
import { subscribeToLiveStream } from '../utils/liveStream';
import { useAuth } from '../context/AuthContext';
import { effectiveRole } from '../utils/roles';

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'previous', label: 'Previous' },
  { value: 'all', label: 'All' },
];
const NEXT_STATUS = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'completed' };
const STATUS_LABEL = { pending: 'Received', confirmed: 'Received', preparing: 'Preparing', ready: 'Ready', completed: 'Served', cancelled: 'Cancelled' };

export default function OrdersPage() {
  const tenant = useTenant();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState({});
  const [viewMode, setViewMode] = useState('orders');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const { user } = useAuth();
  const canEditOrRefund = ['owner', 'manager'].includes(effectiveRole(user?.role));
  const audioContext = useRef(null);

  const playNewOrderAlert = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext.current ||= new AudioContextClass();
      if (audioContext.current.state === 'suspended') audioContext.current.resume();
      const oscillator = audioContext.current.createOscillator();
      const gain = audioContext.current.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.16, audioContext.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.current.currentTime + 0.45);
      oscillator.connect(gain);
      gain.connect(audioContext.current.destination);
      oscillator.start();
      oscillator.stop(audioContext.current.currentTime + 0.45);
    } catch { /* Audio may be unavailable or blocked by browser policy. */ }
  };

  const mergeOrder = (incoming) => setOrders((current) => {
    const exists = current.some((order) => String(order._id) === String(incoming._id));
    return exists
      ? current.map((order) => String(order._id) === String(incoming._id) ? { ...order, ...incoming } : order)
      : [incoming, ...current];
  });

  const loadServiceRequests = async () => {
    try {
      const { data } = await api.get('/session/requests');
      setServiceRequests(data.requests || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load table requests');
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('date', dateFilter);
      params.set('page', String(page));
      params.set('limit', '100');
      const { data } = await api.get(`/orders?${params.toString()}`);
      setOrders(data.orders || []);
      setTotalOrders(data.pagination?.total || 0);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [status, dateFilter, page]);

  useEffect(() => { setPage(1); }, [status, dateFilter]);

  useEffect(() => {
    loadServiceRequests();
    return subscribeToLiveStream('/orders/events/admin', {
      onEvent: (type, payload) => {
        if (type === 'connected') {
          fetchOrders();
          loadServiceRequests();
        } else if ((type === 'new-order' || type === 'order-update') && payload.order) {
          mergeOrder(payload.order);
          if (type === 'new-order') {
            toast.success(`New order ${payload.order.orderNumber} · Table ${payload.order.tableNumber}`);
            if (audioEnabled) playNewOrderAlert();
          }
        } else if (type === 'service-request' && payload.request) {
          setServiceRequests((current) => current.some((request) => request._id === payload.request._id)
            ? current
            : [payload.request, ...current]);
          toast(`Table ${payload.request.tableNumber} ${payload.request.type === 'bill' ? 'requested the bill' : 'called a waiter'}`, { icon: '🔔' });
          if (audioEnabled) playNewOrderAlert();
        } else if (type === 'service-request-served' && payload.request) {
          setServiceRequests((current) => current.filter((request) => request._id !== payload.request._id));
        } else if (type === 'bill-updated') {
          fetchOrders();
        }
      },
    });
  }, [status, dateFilter, audioEnabled]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(q) ||
      order.customer?.name?.toLowerCase().includes(q) ||
      String(order.tableNumber).includes(q)
    );
  }), [orders, query]);

  const updateStatus = async (orderId, newStatus) => {
    setUpdating((current) => ({ ...current, [orderId]: true }));
    try {
      const { data } = await api.put(`/orders/${orderId}/status`, { orderStatus: newStatus });
      setOrders((current) => current.map((order) => order._id === orderId ? data.order : order));
      toast.success(`Order marked as ${newStatus}`);
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    } finally {
      setUpdating((current) => ({ ...current, [orderId]: false }));
    }
  };

  const verifyCashOrder = async (orderId, decision) => {
    setUpdating((current) => ({ ...current, [orderId]: true }));
    try {
      const { data } = await api.put(`/orders/${orderId}/cash-confirmation`, { decision });
      setOrders((current) => current.map((order) => order._id === orderId ? data.order : order));
      toast.success(decision === 'confirm' ? 'Cash order confirmed for preparation' : 'Cash order rejected');
    } catch (error) {
      toast.error(error.message || 'Failed to verify cash order');
    } finally {
      setUpdating((current) => ({ ...current, [orderId]: false }));
    }
  };

  const settleCashPayment = async (orderId) => {
    setUpdating((current) => ({ ...current, [orderId]: true }));
    try {
      const { data } = await api.put(`/orders/${orderId}/cash-payment`, { paymentStatus: 'paid' });
      setOrders((current) => current.map((order) => order._id === orderId ? data.order : order));
      toast.success('Cash payment marked as paid');
    } catch (error) {
      toast.error(error.message || 'Failed to update cash payment');
    } finally {
      setUpdating((current) => ({ ...current, [orderId]: false }));
    }
  };

  const printReceipt = async (orderId) => {
    try {
      const response = await api.get(`/orders/admin/${orderId}/receipt`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast.error(error.message || 'Unable to generate receipt');
    }
  };

  const openEdit = (order) => {
    setEditingOrder(order);
    setEditItems(order.items.map((item) => ({ quantity: item.quantity, specialInstructions: item.specialInstructions || '' })));
  };

  const saveEdit = async () => {
    if (!editingOrder) return;
    try {
      const { data } = await api.put(`/orders/${editingOrder._id}/edit`, {
        items: editItems.map((item, itemIndex) => ({ ...item, itemIndex })),
      });
      mergeOrder(data.order);
      setEditingOrder(null);
      toast.success('Order updated');
    } catch (error) {
      toast.error(error.message || 'Unable to edit order');
    }
  };

  const refundOrder = async (order) => {
    const confirmCashRefund = order.paymentMethod === 'cash'
      ? window.confirm('Confirm that the cash was physically returned to the customer?')
      : window.confirm('Submit a full refund for this paid order?');
    if (!confirmCashRefund) return;
    try {
      const { data } = await api.post(`/orders/${order._id}/refund`, order.paymentMethod === 'cash' ? { confirmCashRefund: true } : {});
      mergeOrder(data.order);
      toast.success(data.pending ? 'Refund submitted; waiting for Razorpay confirmation.' : 'Refund recorded.');
    } catch (error) {
      toast.error(error.message || 'Unable to refund order');
    }
  };

  const serveRequest = async (requestId) => {
    try {
      await api.put(`/session/requests/${requestId}/served`);
      setServiceRequests((current) => current.filter((request) => request._id !== requestId));
    } catch (error) {
      toast.error(error.message || 'Unable to close table request');
    }
  };

  const displayedOrders = viewMode === 'kitchen'
    ? filteredOrders.filter((order) => ['pending', 'confirmed', 'preparing', 'ready'].includes(order.orderStatus))
    : filteredOrders;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by order, customer, table"
            className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-espresso-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {DATE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setDateFilter(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${dateFilter === value ? 'border-espresso-900 bg-espresso-900 text-white' : 'border-stone-200 bg-white text-stone-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {['', ...STATUSES].map((value) => (
            <button
              key={value || 'all-status'}
              onClick={() => setStatus(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${status === value ? 'border-espresso-900 bg-espresso-900 text-white' : 'border-stone-200 bg-white text-stone-600'}`}
            >
              {value || 'All Status'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setViewMode((current) => current === 'kitchen' ? 'orders' : 'kitchen')} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${viewMode === 'kitchen' ? 'border-espresso-900 bg-espresso-900 text-white' : 'border-stone-200 bg-white text-stone-700'}`}>
            <BellRing size={15} /> {viewMode === 'kitchen' ? 'Kitchen display on' : 'Kitchen display'}
          </button>
          <a href="/orders/kitchen" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-50/10 px-3 text-sm font-medium text-amber-800 hover:bg-amber-50/20">
            <span className="inline-flex items-center gap-1"><span className="text-xl">🍳</span> Full Kitchen Display</span>
          </a>
          <button onClick={() => {
            if (!audioContext.current) {
              const AudioContextClass = window.AudioContext || window.webkitAudioContext;
              if (AudioContextClass) audioContext.current = new AudioContextClass();
            }
            audioContext.current?.resume();
            setAudioEnabled((enabled) => !enabled);
          }} aria-label={audioEnabled ? 'Mute order alerts' : 'Enable order alert sound'} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600">
            {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button onClick={() => { fetchOrders(); loadServiceRequests(); }} aria-label="Refresh orders" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {serviceRequests.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-amber-950">Table service requests</h2>
          <div className="flex flex-wrap gap-2">
            {serviceRequests.map((request) => (
              <div key={request._id} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm">
                <span className="font-medium text-stone-800">Table {request.tableNumber} · {request.type === 'bill' ? 'Bill requested' : 'Waiter requested'}</span>
                <button onClick={() => serveRequest(request._id)} className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white">Done</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center text-stone-500"><Loader2 size={28} className="animate-spin" /></div>
      ) : displayedOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center text-stone-500">No orders found.</div>
      ) : (
        viewMode === 'kitchen' ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {displayedOrders.map((order) => (
              <article key={order._id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold text-stone-900">{order.orderNumber} · Table {order.tableNumber}</p><p className="mt-1 text-xs text-stone-500">{new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {STATUS_LABEL[order.orderStatus]}</p></div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase status-${order.orderStatus}`}>{STATUS_LABEL[order.orderStatus]}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {order.items?.map((item, index) => <div key={`${item.name}-${index}`} className="border-t border-stone-100 pt-2 text-sm"><p className="font-medium text-stone-800">{item.quantity} × {item.name}{item.variant?.name ? ` · ${item.variant.name}` : ''}</p>{item.addons?.length > 0 && <p className="text-xs text-stone-500">Add-ons: {item.addons.map((addon) => addon.name).join(', ')}</p>}{item.specialInstructions && <p className="text-xs font-medium text-amber-800">Note: {item.specialInstructions}</p>}</div>)}
                </div>
                {NEXT_STATUS[order.orderStatus] && <button onClick={() => updateStatus(order._id, NEXT_STATUS[order.orderStatus])} disabled={updating[order._id]} className="btn-primary mt-4 w-full rounded-xl py-3">{updating[order._id] ? 'Saving…' : `Mark ${STATUS_LABEL[NEXT_STATUS[order.orderStatus]]}`}</button>}
              </article>
            ))}
          </div>
        ) : (
        <div className="space-y-3">
          {displayedOrders.map((order) => (
            <div key={order._id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
              <div onClick={() => setExpanded((current) => current === order._id ? null : order._id)} className="flex cursor-pointer items-start gap-3 p-3 sm:items-center sm:p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-espresso-900 font-display text-sm font-bold text-white">
                  {String(order.tableNumber).padStart(2, '0')}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">{order.orderNumber}</span>
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] status-${order.orderStatus}`}>
                      {STATUS_LABEL[order.orderStatus]}
                    </span>
                    {order.paymentStatus === 'paid' && <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">PAID</span>}
                    {order.paymentMethod === 'cash' && order.paymentStatus !== 'paid' && <span className="inline-flex rounded-full bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">CASH NOT PAID</span>}
                    {order.paymentMethod === 'cash' && order.cashVerificationStatus === 'pending' && <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">CASH VERIFY</span>}
                  </div>
                  <div className="mt-1 text-xs text-stone-500">{order.customer?.name || 'Walk-in guest'} • {order.items?.length || 0} items • {formatMoney(order.total, tenant.currency)}</div>
                </div>

                <div className="hidden items-center gap-2 text-xs text-stone-400 sm:flex">
                  <span>{new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <ChevronDown size={16} className={`transition ${expanded === order._id ? 'rotate-180' : ''}`} />
                </div>
              </div>

              <AnimatePresence>
                {expanded === order._id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-stone-200 bg-stone-50">
                    <div className="space-y-4 p-4">
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Items</div>
                        <div className="space-y-2">
                          {order.items?.map((item) => (
                            <div key={`${item.name}-${item.quantity}`} className="flex items-center justify-between gap-3 text-sm text-stone-600">
                              <span>{item.name} × {item.quantity}</span>
                              <span className="font-medium text-stone-900">{formatMoney(item.itemTotal, tenant.currency)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3 text-sm font-semibold text-stone-900">
                          <span>Total</span>
                          <span>{formatMoney(order.total, tenant.currency)}</span>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Customer</div>
                          <div className="mt-1 text-sm text-stone-700">{order.customer?.name || 'Walk-in'} • {order.customer?.phone || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Payment</div>
                          <div className="mt-1 text-sm text-stone-700">{order.paymentMethod} • {order.paymentStatus}</div>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Status actions</div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={(event) => { event.stopPropagation(); printReceipt(order._id); }} className="btn-secondary inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs">
                            <Printer size={13} /> Print receipt
                          </button>
                          {canEditOrRefund && order.orderStatus === 'pending' && order.paymentStatus === 'pending' && !order.razorpayOrderId && <button onClick={() => openEdit(order)} className="btn-secondary rounded-full px-3 py-2 text-xs">Edit order</button>}
                          {canEditOrRefund && order.paymentStatus === 'paid' && <button onClick={() => refundOrder(order)} className="btn-secondary rounded-full px-3 py-2 text-xs text-red-600">Refund</button>}
                          {order.paymentMethod === 'cash' && order.cashVerificationStatus === 'pending' && (
                            <>
                              <button onClick={() => verifyCashOrder(order._id, 'confirm')} disabled={updating[order._id]} className="btn-primary rounded-full px-3 py-2 text-xs">Verify & Confirm</button>
                              <button onClick={() => verifyCashOrder(order._id, 'reject')} disabled={updating[order._id]} className="btn-secondary rounded-full px-3 py-2 text-xs text-red-600">Reject Cash Order</button>
                            </>
                          )}
                          {order.paymentMethod === 'cash' && order.paymentStatus !== 'paid' && order.cashVerificationStatus === 'confirmed' && (
                            <button onClick={() => settleCashPayment(order._id)} disabled={updating[order._id]} className="btn-primary rounded-full px-3 py-2 text-xs">
                              {updating[order._id] ? <Loader2 size={12} className="animate-spin" /> : 'Confirm Cash Paid'}
                            </button>
                          )}
                          {NEXT_STATUS[order.orderStatus] && (
                            <button onClick={() => updateStatus(order._id, NEXT_STATUS[order.orderStatus])} disabled={updating[order._id]} className="btn-primary rounded-full px-3 py-2 text-xs">
                              {updating[order._id] ? <Loader2 size={12} className="animate-spin" /> : `Mark as ${STATUS_LABEL[NEXT_STATUS[order.orderStatus]]}`}
                            </button>
                          )}

                          {order.orderStatus !== 'cancelled' && order.orderStatus !== 'completed' && (
                            <button onClick={() => updateStatus(order._id, 'cancelled')} disabled={updating[order._id]} className="btn-secondary rounded-full px-3 py-2 text-xs text-red-600">
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
        )
      )}
      {!loading && totalPages > 1 && <nav aria-label="Order pages" className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-3"><p className="text-xs text-stone-500">{totalOrders} orders · page {page} of {totalPages}</p><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="btn-secondary min-h-10 rounded-full px-4 text-xs disabled:opacity-50">Previous</button><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="btn-secondary min-h-10 rounded-full px-4 text-xs disabled:opacity-50">Next</button></div></nav>}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="edit-order-title" className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div><h2 id="edit-order-title" className="font-display text-xl font-bold text-espresso-900">Edit {editingOrder.orderNumber}</h2><p className="mt-1 text-xs text-stone-500">Change quantities or kitchen instructions before the order is confirmed. Set quantity to zero to remove a line.</p></div>
            {editItems.map((item, index) => <div key={`${editingOrder._id}-${index}`} className="rounded-xl border border-stone-200 p-3"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-stone-800">{editingOrder.items[index].name}</p><p className="text-xs text-stone-500">{formatMoney(editingOrder.items[index].price, tenant.currency)} each</p></div><label className="text-xs text-stone-500">Qty<input aria-label={`Quantity for ${editingOrder.items[index].name}`} type="number" min="0" max="99" value={item.quantity} onChange={(event) => setEditItems((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, quantity: event.target.value } : value))} className="ml-2 w-20 rounded-lg border border-stone-200 px-2 py-1.5 text-sm text-stone-900" /></label></div><label className="mt-3 block text-xs text-stone-500">Special instructions<input maxLength={120} value={item.specialInstructions} onChange={(event) => setEditItems((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, specialInstructions: event.target.value } : value))} className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900" /></label></div>)}
            <div className="flex justify-end gap-2"><button onClick={() => setEditingOrder(null)} className="btn-secondary rounded-xl px-4 py-2.5 text-sm">Cancel</button><button onClick={saveEdit} className="btn-primary rounded-xl px-4 py-2.5 text-sm">Save order</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
