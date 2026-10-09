import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BellRing,
  ChevronDown,
  Clock,
  ExternalLink,
  Kanban,
  List,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
  X,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { formatMoney } from '../utils/money';
import { subscribeToLiveStream } from '../utils/liveStream';
import { useAuth } from '../context/AuthContext';
import { effectiveRole } from '../utils/roles';
import PageHeader from '../components/common/PageHeader';
import StatusPill from '../components/common/StatusPill';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'previous', label: 'Previous' },
  { value: 'all', label: 'All Orders' },
];
const NEXT_STATUS = {
  pending: 'preparing',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'completed'
};
const STATUS_LABELS = {
  pending: 'Received',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready to Serve',
  completed: 'Served',
  cancelled: 'Cancelled'
};

export default function OrdersPage() {
  const tenant = useTenant();
  const currency = tenant.currency || tenant.settings?.currency || '₹';
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
  const [layoutMode, setLayoutMode] = useState('list'); // 'list' | 'board'
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editItems, setEditItems] = useState([]);

  // Confirm dialog state for refunds & cancellations
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmVariant: 'danger',
    action: null
  });

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
      gain.gain.setValueAtTime(0.18, audioContext.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.current.currentTime + 0.5);
      oscillator.connect(gain);
      gain.connect(audioContext.current.destination);
      oscillator.start();
      oscillator.stop(audioContext.current.currentTime + 0.5);
    } catch {
      // Audio policy restricted
    }
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

  useEffect(() => {
    setPage(1);
  }, [status, dateFilter]);

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
          setServiceRequests((current) => current.some((req) => req._id === payload.request._id)
            ? current
            : [payload.request, ...current]);
          toast(`Table ${payload.request.tableNumber} ${payload.request.type === 'bill' ? 'requested the bill' : 'called a waiter'}`, { icon: '🔔' });
          if (audioEnabled) playNewOrderAlert();
        } else if (type === 'service-request-served' && payload.request) {
          setServiceRequests((current) => current.filter((req) => req._id !== payload.request._id));
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
      order.customer?.phone?.includes(q) ||
      String(order.tableNumber).includes(q)
    );
  }), [orders, query]);

  const updateStatus = async (orderId, newStatus) => {
    setUpdating((current) => ({ ...current, [orderId]: true }));
    try {
      const { data } = await api.put(`/orders/${orderId}/status`, { orderStatus: newStatus });
      setOrders((current) => current.map((order) => order._id === orderId ? data.order : order));
      toast.success(`Order marked as ${STATUS_LABELS[newStatus] || newStatus}`);
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
      toast.success(decision === 'confirm' ? 'Cash order confirmed for kitchen' : 'Cash order rejected');
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
    setEditItems(order.items.map((item) => ({
      quantity: item.quantity,
      specialInstructions: item.specialInstructions || ''
    })));
  };

  const saveEdit = async () => {
    if (!editingOrder) return;
    try {
      const { data } = await api.put(`/orders/${editingOrder._id}/edit`, {
        items: editItems.map((item, itemIndex) => ({ ...item, itemIndex })),
      });
      mergeOrder(data.order);
      setEditingOrder(null);
      toast.success('Order items updated');
    } catch (error) {
      toast.error(error.message || 'Unable to edit order');
    }
  };

  const promptRefund = (order) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Refund Order ' + order.orderNumber,
      message: order.paymentMethod === 'cash'
        ? `Confirm that ${formatMoney(order.total, currency)} was physically handed back to the customer?`
        : `Submit a full online refund of ${formatMoney(order.total, currency)} via Razorpay?`,
      confirmText: 'Issue Refund',
      confirmVariant: 'danger',
      action: async () => {
        try {
          const { data } = await api.post(`/orders/${order._id}/refund`,
            order.paymentMethod === 'cash' ? { confirmCashRefund: true } : {}
          );
          mergeOrder(data.order);
          toast.success(data.pending ? 'Refund submitted; awaiting gateway confirmation.' : 'Refund completed.');
        } catch (error) {
          toast.error(error.message || 'Unable to refund order');
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const promptCancel = (order) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Order ' + order.orderNumber,
      message: 'Are you sure you want to cancel this order? This cannot be undone.',
      confirmText: 'Cancel Order',
      confirmVariant: 'danger',
      action: async () => {
        await updateStatus(order._id, 'cancelled');
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const serveRequest = async (requestId) => {
    try {
      await api.put(`/session/requests/${requestId}/served`);
      setServiceRequests((current) => current.filter((req) => req._id !== requestId));
      toast.success('Service request completed');
    } catch (error) {
      toast.error(error.message || 'Unable to close table request');
    }
  };

  // Group orders for board view
  const boardColumns = useMemo(() => [
    { id: 'pending', title: 'Received', color: 'border-amber-400 bg-amber-50/50', items: filteredOrders.filter(o => o.orderStatus === 'pending') },
    { id: 'preparing', title: 'Preparing', color: 'border-purple-400 bg-purple-50/50', items: filteredOrders.filter(o => ['confirmed', 'preparing'].includes(o.orderStatus)) },
    { id: 'ready', title: 'Ready to Serve', color: 'border-emerald-400 bg-emerald-50/50', items: filteredOrders.filter(o => o.orderStatus === 'ready') },
    { id: 'completed', title: 'Completed Today', color: 'border-stone-300 bg-stone-50/50', items: filteredOrders.filter(o => o.orderStatus === 'completed') }
  ], [filteredOrders]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Orders & Kitchen"
        subtitle="Manage live orders, monitor table calls, and advance ticket statuses in real time."
        breadcrumbs={[
          { label: 'Operations', to: '/dashboard' },
          { label: 'Orders' }
        ]}
        actions={
          <>
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => {
                if (!audioContext.current) {
                  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                  if (AudioContextClass) audioContext.current = new AudioContextClass();
                }
                audioContext.current?.resume();
                setAudioEnabled((prev) => !prev);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold shadow-xs transition ${
                audioEnabled
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
              title={audioEnabled ? 'Audio alerts active' : 'Audio alerts muted'}
            >
              {audioEnabled ? <Volume2 size={15} className="text-amber-600 animate-pulse" /> : <VolumeX size={15} />}
              <span>{audioEnabled ? 'Sound On' : 'Sound Off'}</span>
            </button>

            {/* Kitchen Display link */}
            <a
              href="/orders/kitchen"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs transition"
            >
              <ExternalLink size={14} className="text-stone-400" />
              <span>Full KDS Screen</span>
            </a>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => { fetchOrders(); loadServiceRequests(); }}
              className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50 shadow-xs transition"
              title="Refresh orders"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </>
        }
      />

      {/* Table Service Requests Alert Banner */}
      {serviceRequests.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-200 text-amber-900">
                <BellRing size={16} className="animate-bounce" />
              </span>
              <h2 className="text-sm font-bold text-amber-950">
                {serviceRequests.length} Live Table Service {serviceRequests.length === 1 ? 'Request' : 'Requests'}
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
              Immediate Attention
            </span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {serviceRequests.map((request) => (
              <div
                key={request._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/90 bg-white p-3 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-900 text-[11px] font-bold text-white">
                      T{request.tableNumber}
                    </span>
                    <span className="text-xs font-bold text-stone-900">
                      {request.type === 'bill' ? 'Bill Requested' : 'Waiter Summoned'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-stone-400 flex items-center gap-1">
                    <Clock size={11} /> {new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => serveRequest(request._id)}
                  className="rounded-lg bg-amber-900 hover:bg-amber-950 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition"
                >
                  Mark Served
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Search & Filter Bar */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by order #, guest name, phone, table..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 py-2 pl-9.5 pr-8 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* View mode toggle (List vs Board) */}
          <div className="flex items-center gap-1.5 self-end md:self-auto">
            <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1">
              <button
                type="button"
                onClick={() => setLayoutMode('list')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  layoutMode === 'list'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <List size={14} /> List
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('board')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  layoutMode === 'board'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Kanban size={14} /> Board
              </button>
            </div>
          </div>
        </div>

        {/* Date Filter & Status Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100">
          {/* Date Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mr-1">Period:</span>
            {DATE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDateFilter(value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  dateFilter === value
                    ? 'bg-espresso-950 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Status Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mr-1">Status:</span>
            <button
              type="button"
              onClick={() => setStatus('')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                status === ''
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              All ({totalOrders})
            </button>
            {STATUSES.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setStatus(val)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  status === val
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                }`}
              >
                {STATUS_LABELS[val] || val}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 w-full animate-pulse rounded-2xl bg-stone-100 border border-stone-200/60" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No orders found"
          description={query ? `No orders matched your search query "${query}".` : "There are no orders matching this filter."}
          actionLabel="Clear filters"
          onAction={() => { setQuery(''); setStatus(''); setDateFilter('today'); }}
        />
      ) : layoutMode === 'board' ? (
        /* KANBAN BOARD VIEW */
        <div className="grid gap-4 lg:grid-cols-4 items-start">
          {boardColumns.map((col) => (
            <div key={col.id} className="rounded-2xl border border-stone-200/80 bg-stone-50/70 p-3 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    {col.title}
                  </h3>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-700">
                    {col.items.length}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 min-h-[300px]">
                {col.items.length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-stone-200 text-[11px] text-stone-400">
                    No tickets
                  </div>
                ) : (
                  col.items.map((order) => (
                    <div
                      key={order._id}
                      className="rounded-xl border border-stone-200/90 bg-white p-3 shadow-xs hover:shadow-md transition space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              T{order.tableNumber}
                            </span>
                            <span className="text-xs font-bold text-stone-900">
                              {order.orderNumber}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] text-stone-400 flex items-center gap-1">
                            <Clock size={10} /> {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <StatusPill status={order.orderStatus} size="xs" />
                      </div>

                      {/* Items */}
                      <div className="space-y-1 border-t border-stone-100 pt-2 text-xs text-stone-600">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span className="truncate max-w-[150px] font-medium text-stone-800">
                              {item.quantity}× {item.name}
                            </span>
                            <span className="tabular-nums text-stone-500 font-mono">
                              {formatMoney(item.itemTotal, currency)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Footer & Next action */}
                      <div className="flex items-center justify-between border-t border-stone-100 pt-2">
                        <span className="text-xs font-bold text-stone-900 tabular-nums">
                          {formatMoney(order.total, currency)}
                        </span>
                        {NEXT_STATUS[order.orderStatus] && (
                          <button
                            type="button"
                            onClick={() => updateStatus(order._id, NEXT_STATUS[order.orderStatus])}
                            disabled={updating[order._id]}
                            className="btn-primary rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                          >
                            {updating[order._id] ? 'Saving…' : `Advance →`}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isExpanded = expanded === order._id;
            return (
              <div
                key={order._id}
                className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-xs transition-all hover:border-stone-300"
              >
                {/* Order Row Bar */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : order._id)}
                  className="flex cursor-pointer items-center justify-between gap-3 p-3.5 sm:p-4 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Table Badge */}
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-espresso-950 text-white shadow-xs">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-300 leading-none">Table</span>
                      <span className="font-display text-sm font-bold leading-none mt-0.5">{order.tableNumber}</span>
                    </div>

                    {/* Order Details */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-stone-900 tracking-tight">
                          {order.orderNumber}
                        </span>
                        <StatusPill status={order.orderStatus} size="sm" pulse={order.orderStatus === 'preparing'} />

                        {/* Payment badge */}
                        {order.paymentStatus === 'paid' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 size={10} /> Paid via {order.paymentMethod?.toUpperCase()}
                          </span>
                        ) : order.paymentMethod === 'cash' && order.cashVerificationStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200/80">
                            <AlertCircle size={10} /> Verify Cash
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200/60">
                            Unpaid ({order.paymentMethod || 'Counter'})
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                        <span className="font-medium text-stone-700">
                          {order.customer?.name || 'Walk-in Guest'}
                          {order.customer?.phone && ` (${order.customer.phone})`}
                        </span>
                        <span>•</span>
                        <span>{order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}</span>
                        <span>•</span>
                        <span className="font-semibold text-stone-900 tabular-nums font-mono">
                          {formatMoney(order.total, currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side info & Expand icon */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold text-stone-700">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-stone-400">
                        {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                    </div>

                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-transform ${isExpanded ? 'rotate-180 bg-stone-100 text-stone-700' : ''}`}>
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>

                {/* Expanded Details Drawer/Accordion */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="border-t border-stone-200 bg-stone-50/70 p-4 space-y-4"
                    >
                      {/* Items table */}
                      <div className="rounded-xl border border-stone-200/90 bg-white p-3.5 shadow-2xs">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                          Order Breakdown
                        </h4>
                        <div className="divide-y divide-stone-100">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="py-2 flex items-start justify-between gap-3 text-xs">
                              <div>
                                <p className="font-semibold text-stone-900">
                                  {item.quantity}× {item.name}
                                  {item.variant?.name && <span className="ml-1 text-stone-500 font-normal">({item.variant.name})</span>}
                                </p>
                                {item.addons?.length > 0 && (
                                  <p className="text-[11px] text-stone-400 mt-0.5">
                                    Add-ons: {item.addons.map((a) => a.name).join(', ')}
                                  </p>
                                )}
                                {item.specialInstructions && (
                                  <p className="text-[11px] font-medium text-amber-700 mt-0.5">
                                    Note: {item.specialInstructions}
                                  </p>
                                )}
                              </div>
                              <span className="font-bold text-stone-800 tabular-nums">
                                {formatMoney(item.itemTotal, currency)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Totals */}
                        <div className="border-t border-stone-200 mt-2.5 pt-2.5 flex items-center justify-between text-sm font-bold text-stone-900">
                          <span>Total Amount</span>
                          <span className="tabular-nums font-mono text-base text-espresso-950">
                            {formatMoney(order.total, currency)}
                          </span>
                        </div>
                      </div>

                      {/* Actions row */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); printReceipt(order._id); }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs transition"
                          >
                            <Printer size={13} className="text-stone-500" /> Print Bill
                          </button>

                          {canEditOrRefund && order.orderStatus === 'pending' && order.paymentStatus === 'pending' && !order.razorpayOrderId && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEdit(order); }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs transition"
                            >
                              Edit Items
                            </button>
                          )}

                          {canEditOrRefund && order.paymentStatus === 'paid' && order.orderStatus !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); promptRefund(order); }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 shadow-xs transition"
                            >
                              Refund
                            </button>
                          )}

                          {order.orderStatus !== 'cancelled' && order.orderStatus !== 'completed' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); promptCancel(order); }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 shadow-xs transition"
                            >
                              Cancel Order
                            </button>
                          )}
                        </div>

                        {/* Status advancement actions */}
                        <div className="flex items-center gap-2">
                          {order.paymentMethod === 'cash' && order.cashVerificationStatus === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); verifyCashOrder(order._id, 'confirm'); }}
                                disabled={updating[order._id]}
                                className="btn-primary rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xs"
                              >
                                {updating[order._id] ? 'Saving...' : 'Accept Cash Order'}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); verifyCashOrder(order._id, 'reject'); }}
                                disabled={updating[order._id]}
                                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {order.paymentMethod === 'cash' && order.paymentStatus !== 'paid' && order.cashVerificationStatus === 'confirmed' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); settleCashPayment(order._id); }}
                              disabled={updating[order._id]}
                              className="btn-primary rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xs"
                            >
                              {updating[order._id] ? <Loader2 size={13} className="animate-spin" /> : 'Confirm Cash Received'}
                            </button>
                          )}

                          {NEXT_STATUS[order.orderStatus] && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); updateStatus(order._id, NEXT_STATUS[order.orderStatus]); }}
                              disabled={updating[order._id]}
                              className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold shadow-xs flex items-center gap-1.5"
                            >
                              {updating[order._id] ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                `Mark ${STATUS_LABELS[NEXT_STATUS[order.orderStatus]]}`
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {!loading && totalPages > 1 && (
        <nav aria-label="Order pagination" className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-3.5 shadow-xs">
          <p className="text-xs text-stone-500 font-medium">
            Showing {filteredOrders.length} of {totalOrders} orders · Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="rounded-xl border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </nav>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <section role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-espresso-950">
                  Edit Order {editingOrder.orderNumber}
                </h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  Update quantities or cooking instructions before the kitchen begins preparation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="rounded-xl p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {editItems.map((item, index) => (
                <div key={index} className="rounded-xl border border-stone-200 p-3 bg-stone-50/50 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-stone-900">
                        {editingOrder.items[index]?.name}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        {formatMoney(editingOrder.items[index]?.price, currency)} each
                      </p>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                      Qty:
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={item.quantity}
                        onChange={(e) => setEditItems((cur) => cur.map((v, i) => i === index ? { ...v, quantity: Number(e.target.value) } : v))}
                        className="w-16 rounded-lg border border-stone-200 bg-white px-2 py-1 text-center font-bold text-stone-900 focus:border-amber-500 focus:outline-none"
                      />
                    </label>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Special instructions (e.g. less spicy, oat milk)..."
                      maxLength={120}
                      value={item.specialInstructions}
                      onChange={(e) => setEditItems((cur) => cur.map((v, i) => i === index ? { ...v, specialInstructions: e.target.value } : v))}
                      className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Universal Confirm Dialog for Refunds & Cancels */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmVariant={confirmDialog.confirmVariant}
        onConfirm={confirmDialog.action}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
