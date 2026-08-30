import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, DollarSign, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/api';

const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className={`font-display text-2xl font-bold mt-1 ${color}`}>{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-700', '-100')}`}>
        <Icon size={20} className={color} />
      </div>
    </div>
  </motion.div>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders?date=today&limit=5')
      .then(res => {
        setStats(res.data.stats);
        setRecentOrders(res.data.orders.slice(0, 5));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AdminLayout title="Dashboard">
      <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brew-500" size={28} /></div>
    </AdminLayout>
  );

  const CARDS = [
    { icon: ShoppingBag, label: "Today's Orders", value: stats?.todayCount ?? 0, color: 'text-blue-600', delay: 0 },
    { icon: DollarSign, label: "Today's Revenue", value: `₹${stats?.todayRevenue ?? 0}`, color: 'text-green-600', delay: 0.1 },
    { icon: Clock, label: 'Pending Orders', value: stats?.pending ?? 0, color: 'text-orange-600', delay: 0.2 },
    { icon: CheckCircle2, label: 'Completed', value: stats?.completed ?? 0, color: 'text-purple-600', delay: 0.3 },
  ];

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CARDS.map(c => <StatCard key={c.label} {...c} />)}
        </div>

        {/* Recent orders */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-display font-bold text-espresso-900 mb-4">Recent Orders</h2>
          {recentOrders.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No orders yet today</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map(order => (
                <div key={order._id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-9 h-9 bg-espresso-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="font-display font-bold text-espresso-700 text-xs">
                      {String(order.tableNumber).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-espresso-900 truncate">{order.orderNumber}</p>
                    <p className="text-xs text-gray-400">{order.customer?.name} · {order.items?.length} items</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-espresso-900">₹{order.total}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full
                      status-${order.orderStatus}`}>
                      {order.orderStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
