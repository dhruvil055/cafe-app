import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, UtensilsCrossed, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import api from '../../services/api';

const STATUS_CONFIG = {
  pending:   { label: 'Order Received',    color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '📋' },
  confirmed: { label: 'Order Confirmed',   color: 'text-blue-600',   bg: 'bg-blue-50',   icon: '✅' },
  preparing: { label: 'Being Prepared',    color: 'text-orange-600', bg: 'bg-orange-50', icon: '👨‍🍳' },
  ready:     { label: 'Ready to Serve!',   color: 'text-green-600',  bg: 'bg-green-50',  icon: '🔔' },
  completed: { label: 'Order Completed',   color: 'text-gray-600',   bg: 'bg-gray-50',   icon: '🎉' },
};

export default function OrderConfirmPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('token');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const safeItems = Array.isArray(order?.items) ? order.items : [];

  useEffect(() => {
    const fetchOrder = () => {
      api.get(`/orders/${orderId}?accessToken=${accessToken}`)
        .then(res => { setOrder(res.data.order); setLoading(false); })
        .catch(() => setLoading(false));
    };
    if (accessToken) {
      fetchOrder();
      // Poll for status updates every 15s
      const interval = setInterval(fetchOrder, 15000);
      return () => clearInterval(interval);
    }
  }, [orderId, accessToken]);

  const handleDownloadReceipt = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/orders/${orderId}/receipt?accessToken=${accessToken}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${order.orderNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Receipt download failed:', e);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brew-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 p-8">
        <span className="text-5xl">❓</span>
        <p className="font-display text-xl text-espresso-900">Order not found</p>
        <Link to="/menu" className="btn-primary">Back to Menu</Link>
      </div>
    );
  }

  const status = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.pending;

  return (
    <div className="min-h-screen bg-cream">
      {/* Confetti header */}
      <div className="bg-espresso-950 px-6 py-10 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          {['☕','🍕','🍔','🎉','⭐'].map((emoji, i) => (
            <motion.span
              key={i}
              className="absolute text-2xl"
              style={{ left: `${10 + i * 20}%`, top: '20%' }}
              animate={{ y: [-10, 10, -10], rotate: [-10, 10, -10] }}
              transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.5 }}
            >
              {emoji}
            </motion.span>
          ))}
        </div>

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="w-20 h-20 bg-brew-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 size={40} className="text-brew-400" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="font-display text-2xl font-bold text-cream">
            {order.paymentStatus === 'paid' ? '🎉 Order Confirmed!' : '📋 Order Placed!'}
          </h1>
          <p className="text-brew-300 text-sm mt-1">
            {order.paymentMethod === 'cash'
              ? 'Pay at the counter when you leave'
              : 'Payment received. Your order is being processed!'}
          </p>
        </motion.div>
      </div>

      <div className="p-4 space-y-4">
        {/* Order meta */}
        <div className="card p-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Order #', value: order.orderNumber },
              { label: 'Table', value: `Table ${String(order.tableNumber).padStart(2, '0')}` },
              { label: 'Payment', value: order.paymentMethod === 'razorpay' ? 'Online' : 'Cash' },
              { label: 'Total', value: `₹${order.total}` },
            ].map(row => (
              <div key={row.label} className="bg-foam rounded-xl p-3">
                <p className="text-xs text-espresso-400">{row.label}</p>
                <p className="font-medium text-espresso-900 text-sm mt-0.5">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live status */}
        <div className={`card p-4 ${status.bg}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{status.icon}</span>
            <div className="flex-1">
              <p className={`font-display font-bold ${status.color}`}>{status.label}</p>
              <p className="text-espresso-500 text-xs flex items-center gap-1 mt-0.5">
                <Clock size={11} /> Est. 15–20 minutes · Updates automatically
              </p>
            </div>
          </div>

          {/* Status progress */}
          <div className="mt-4 flex items-center gap-1">
            {['pending', 'confirmed', 'preparing', 'ready', 'completed'].map((s, i) => {
              const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
              const currentIdx = statuses.indexOf(order.orderStatus);
              const done = i <= currentIdx;
              return (
                <div key={s} className="flex-1 flex items-center">
                  <div className={`flex-1 h-1.5 rounded-full transition-colors duration-500
                    ${done ? 'bg-espresso-900' : 'bg-espresso-200'}`} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            {['Received', 'Confirmed', 'Preparing', 'Ready', 'Done'].map(label => (
              <span key={label} className="text-[9px] text-espresso-400 flex-1 text-center">{label}</span>
            ))}
          </div>
        </div>

        {/* Items */}
        <div className="card p-4 space-y-3">
          <h2 className="font-display font-semibold text-espresso-900">Items Ordered</h2>
          {safeItems.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <div className="flex-1 pr-2">
                <span className="text-espresso-800">{item.name}</span>
                <span className="text-espresso-400 ml-1">× {item.quantity}</span>
                {item.addons?.length > 0 && (
                  <p className="text-xs text-espresso-400 mt-0.5">
                    + {item.addons.map(a => a.name).join(', ')}
                  </p>
                )}
              </div>
              <span className="font-medium text-espresso-900">₹{item.itemTotal}</span>
            </div>
          ))}
          <div className="border-t border-foam pt-2 space-y-1">
            <div className="flex justify-between text-sm text-espresso-500">
              <span>Subtotal</span><span>₹{order.subtotal}</span>
            </div>
            <div className="flex justify-between text-sm text-espresso-500">
              <span>GST (5%)</span><span>₹{order.tax}</span>
            </div>
            <div className="flex justify-between font-display font-bold text-espresso-900">
              <span>Total</span><span>₹{order.total}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className={`grid gap-3 pb-6 ${order.paymentMethod === 'cash' ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {order.paymentMethod !== 'cash' && (
            <button
              onClick={handleDownloadReceipt}
              disabled={downloading}
              className="btn-secondary flex items-center justify-center gap-2 py-3.5 text-sm"
            >
              {downloading
                ? <Loader2 size={16} className="animate-spin" />
                : <Download size={16} />}
              {downloading ? 'Generating...' : 'Receipt PDF'}
            </button>
          )}
          <Link to="/menu">
            <button className="w-full btn-accent flex items-center justify-center gap-2 py-3.5 text-sm">
              <UtensilsCrossed size={16} />
              Back to Menu
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
