import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, RefreshCw, ChevronDown, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/api';

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
const NEXT_STATUS = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'completed' };

const STATUS_COLORS = {
  pending: 'status-pending', confirmed: 'status-confirmed',
  preparing: 'status-preparing', ready: 'status-ready',
  completed: 'status-completed', cancelled: 'status-cancelled'
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState({});
  const [expanded, setExpanded] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '?date=today';
      const res = await api.get(`/orders${params}`);
      setOrders(res.data.orders);
    } catch (e) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(prev => ({ ...prev, [orderId]: true }));
    try {
      const res = await api.put(`/orders/${orderId}/status`, { orderStatus: newStatus });
      setOrders(prev => prev.map(o => o._id === orderId ? res.data.order : o));
      toast.success(`Order marked as ${newStatus}`);
    } catch (e) {
      toast.error('Failed to update status');
    } finally {
      setUpdating(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const filtered = orders.filter(o =>
    !search ||
    o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    String(o.tableNumber).includes(search)
  );

  return (
    <AdminLayout title="Orders">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search order, name, table..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brew-300 bg-white"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {['', ...STATUSES].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all border
                  ${statusFilter === s
                    ? 'bg-espresso-900 text-white border-espresso-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchOrders}
            className="w-8 h-8 border border-gray-200 rounded-xl flex items-center justify-center
                       text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-brew-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium">No orders found</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map(order => (
                <motion.div
                  key={order._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  {/* Header */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(expanded === order._id ? null : order._id)}
                  >
                    {/* Table badge */}
                    <div className="w-10 h-10 bg-espresso-900 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-cream font-display font-bold text-sm">
                        {String(order.tableNumber).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-espresso-900 text-sm">{order.orderNumber}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_COLORS[order.orderStatus]}`}>
                          {order.orderStatus}
                        </span>
                        {order.paymentStatus === 'paid' && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                            PAID
                          </span>
                        )}
                        {order.paymentMethod === 'cash' && order.paymentStatus !== 'paid' && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                            CASH
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {order.customer?.name} · {order.items?.length} items · ₹{order.total}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">
                        {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-gray-400 transition-transform ${expanded === order._id ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {expanded === order._id && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-gray-100"
                      >
                        <div className="p-4 space-y-4 bg-gray-50/50">
                          {/* Items */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
                            <div className="space-y-1">
                              {order.items?.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-gray-700">
                                    {item.name} × {item.quantity}
                                    {item.addons?.length > 0 && <span className="text-gray-400 text-xs ml-1">(+{item.addons.map(a => a.name).join(', ')})</span>}
                                  </span>
                                  <span className="font-medium text-gray-900">₹{item.itemTotal}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between font-bold text-espresso-900 text-sm mt-2 pt-2 border-t border-gray-200">
                              <span>Total</span>
                              <span>₹{order.total}</span>
                            </div>
                          </div>

                          {/* Customer */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Customer</p>
                            <p className="text-sm text-gray-700">{order.customer?.name} · {order.customer?.phone}</p>
                          </div>

                          {/* Status actions */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Update Status</p>
                            <div className="flex gap-2 flex-wrap">
                              {NEXT_STATUS[order.orderStatus] && (
                                <button
                                  onClick={() => updateStatus(order._id, NEXT_STATUS[order.orderStatus])}
                                  disabled={updating[order._id]}
                                  className="flex items-center gap-1.5 btn-primary text-xs py-2 px-4"
                                >
                                  {updating[order._id] && <Loader2 size={12} className="animate-spin" />}
                                  Mark as {NEXT_STATUS[order.orderStatus]}
                                </button>
                              )}
                              {order.orderStatus !== 'cancelled' && order.orderStatus !== 'completed' && (
                                <button
                                  onClick={() => updateStatus(order._id, 'cancelled')}
                                  disabled={updating[order._id]}
                                  className="text-xs py-2 px-4 border border-red-200 text-red-600 rounded-full hover:bg-red-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              )}
                              {order.paymentMethod === 'cash' && order.paymentStatus !== 'paid' && (
                                <button
                                  onClick={async () => {
                                    setUpdating(prev => ({ ...prev, [order._id]: true }));
                                    try {
                                      const res = await api.put(`/orders/${order._id}/cash-payment`, { paymentStatus: 'paid' });
                                      setOrders(prev => prev.map(o => o._id === order._id ? res.data.order : o));
                                      toast.success('Marked as paid');
                                    } catch { toast.error('Failed'); }
                                    finally { setUpdating(prev => ({ ...prev, [order._id]: false })); }
                                  }}
                                  className="text-xs py-2 px-4 border border-green-200 text-green-700 rounded-full hover:bg-green-50 transition-colors"
                                >
                                  Mark as Paid
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
