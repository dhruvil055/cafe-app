import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Loader2, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'previous', label: 'Previous' },
  { value: 'all', label: 'All' },
];
const NEXT_STATUS = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'completed' };

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState({});

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('date', dateFilter);
      params.set('limit', '200');
      const { data } = await api.get(`/orders?${params.toString()}`);
      setOrders(data.orders || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [status, dateFilter]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
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

        <button onClick={fetchOrders} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600">
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center text-stone-500"><Loader2 size={28} className="animate-spin" /></div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center text-stone-500">No orders found.</div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div key={order._id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
              <div onClick={() => setExpanded((current) => current === order._id ? null : order._id)} className="flex cursor-pointer items-center gap-3 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-espresso-900 font-display text-sm font-bold text-white">
                  {String(order.tableNumber).padStart(2, '0')}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">{order.orderNumber}</span>
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] status-${order.orderStatus}`}>
                      {order.orderStatus}
                    </span>
                    {order.paymentStatus === 'paid' && <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">PAID</span>}
                  </div>
                  <div className="mt-1 text-xs text-stone-500">{order.customer?.name || 'Walk-in guest'} • {order.items?.length || 0} items • ₹{order.total}</div>
                </div>

                <div className="flex items-center gap-2 text-xs text-stone-400">
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
                              <span className="font-medium text-stone-900">₹{item.itemTotal}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3 text-sm font-semibold text-stone-900">
                          <span>Total</span>
                          <span>₹{order.total}</span>
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
                          {NEXT_STATUS[order.orderStatus] && (
                            <button onClick={() => updateStatus(order._id, NEXT_STATUS[order.orderStatus])} disabled={updating[order._id]} className="btn-primary rounded-full px-3 py-2 text-xs">
                              {updating[order._id] ? <Loader2 size={12} className="animate-spin" /> : `Mark as ${NEXT_STATUS[order.orderStatus]}`}
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
      )}
    </div>
  );
}
