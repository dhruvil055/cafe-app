import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Loader2 } from 'lucide-react';
import api from '../../services/api';

const STATUS_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
const STATUS_LABELS = { pending: 'Order Received', confirmed: 'Confirmed', preparing: 'Being Prepared', ready: 'Ready to Serve!', completed: 'Completed' };
const STATUS_ICONS = { pending: '📋', confirmed: '✅', preparing: '👨‍🍳', ready: '🔔', completed: '🎉' };

export default function TrackOrderPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = () => api.get(`/orders/${orderId}`).then(r => { setOrder(r.data.order); setLoading(false); }).catch(() => setLoading(false));
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading) return <div className="min-h-screen bg-cream flex items-center justify-center"><Loader2 className="animate-spin text-brew-500" size={32} /></div>;
  if (!order) return <div className="min-h-screen bg-cream flex items-center justify-center flex-col gap-4"><p className="font-display text-xl">Order not found</p><Link to="/menu" className="btn-primary">Back to Menu</Link></div>;

  const currentIdx = STATUS_STEPS.indexOf(order.orderStatus);

  return (
    <div className="min-h-screen bg-cream">
      <div className="flex items-center gap-3 p-4 border-b border-foam bg-white">
        <Link to="/menu" className="w-9 h-9 rounded-full border border-foam flex items-center justify-center">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display text-xl font-bold text-espresso-900">Track Order</h1>
        <span className="ml-auto text-xs text-espresso-400 flex items-center gap-1"><Clock size={11} />Auto-updates</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="card p-4 text-center">
          <span className="text-4xl">{STATUS_ICONS[order.orderStatus] || '📋'}</span>
          <h2 className="font-display text-xl font-bold text-espresso-900 mt-2">{STATUS_LABELS[order.orderStatus]}</h2>
          <p className="text-espresso-400 text-sm">{order.orderNumber} · Table {String(order.tableNumber).padStart(2, '0')}</p>
        </div>

        <div className="card p-4">
          <div className="space-y-4">
            {STATUS_STEPS.map((step, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500
                    ${done ? 'bg-espresso-900' : 'bg-espresso-100'}`}>
                    {done ? <span className="text-cream text-sm">✓</span> : <span className="text-espresso-300 text-sm">{i + 1}</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium text-sm ${done ? 'text-espresso-900' : 'text-espresso-400'}`}>
                      {STATUS_LABELS[step]}
                    </p>
                    {active && <p className="text-xs text-brew-500 mt-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-brew-500 rounded-full animate-pulse" />In progress</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
