import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, DollarSign, ShoppingBag } from 'lucide-react';
import api from '../services/api';

const cardConfig = [
  { label: "Today's Orders", key: 'todayCount', icon: ShoppingBag, tone: 'text-sky-600' },
  { label: "Today's Revenue", key: 'todayRevenue', icon: DollarSign, tone: 'text-emerald-600' },
  { label: 'Pending', key: 'pending', icon: Clock3, tone: 'text-amber-600' },
  { label: 'Completed', key: 'completed', icon: CheckCircle2, tone: 'text-violet-600' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState({ todayCount: 0, todayRevenue: 0, pending: 0, completed: 0 });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders?date=today&limit=6')
      .then((response) => {
        setStats(response.data.stats || {});
        setOrders(response.data.orders || []);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cardConfig.map(({ label, key, icon: Icon, tone }) => (
          <div key={key} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</div>
                <div className="mt-2 text-3xl font-bold text-stone-900">
                  {key === 'todayRevenue' ? `₹${Number(stats[key] || 0)}` : Number(stats[key] || 0)}
                </div>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 ${tone}`}>
                <Icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-espresso-900">Recent orders</h2>
          <span className="text-xs uppercase tracking-[0.12em] text-stone-500">Live feed</span>
        </div>

        {loading ? (
          <div className="flex min-h-[150px] items-center justify-center text-stone-400">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="flex min-h-[150px] items-center justify-center text-stone-400">No orders today yet.</div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order._id} className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 p-3">
                <div>
                  <div className="font-semibold text-stone-900">{order.orderNumber}</div>
                  <div className="text-sm text-stone-500">Table {order.tableNumber} • {order.customer?.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-stone-900">₹{order.total}</div>
                  <div className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] status-${order.orderStatus}`}>
                    {order.orderStatus}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
