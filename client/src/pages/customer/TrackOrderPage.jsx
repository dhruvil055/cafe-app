import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { subscribeToLiveStream } from '../../utils/liveStream';
import usePageMeta from '../../hooks/usePageMeta';

const STATUS_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
const STATUS_LABELS = { pending: 'Order Received', confirmed: 'Confirmed', preparing: 'Being Prepared', ready: 'Ready to Serve!', completed: 'Completed' };
const STATUS_ICONS = { pending: '📋', confirmed: '✅', preparing: '👨‍🍳', ready: '🔔', completed: '🎉' };

export default function TrackOrderPage() {
  usePageMeta({
    title: 'Track Order Status & Kitchen Progress',
    description: 'Follow live real-time updates as our barista and kitchen prepare your order. Instant updates when your food is ready to serve.',
  });

  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('token');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const unsubRef = useRef(null);

  // Initial fetch
  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    const fetch = () => api.get(`/orders/${orderId}?accessToken=${accessToken}`)
      .then(r => { setOrder(r.data.order); setLoading(false); })
      .catch(() => setLoading(false));
    fetch();
  }, [orderId, accessToken]);

  // SSE for live updates
  useEffect(() => {
    if (!accessToken || loading) return;
    unsubRef.current = subscribeToLiveStream(`/orders/${orderId}/events`, {
      headers: { 'X-Order-Access-Token': accessToken },
      onEvent: (type, payload) => {
        if (type === 'connected') {
          setSseConnected(true);
        } else if (type === 'order-update' && payload.order) {
          setOrder((current) => ({ ...current, ...payload.order }));
          setLoading(false);
        }
      },
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [orderId, accessToken, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brew-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center flex-col gap-4 p-6 text-center">
        <p className="font-display text-2xl font-bold text-espresso-950">Order not found</p>
        <p className="text-sm text-stone-600 max-w-sm">Please verify your order link or return to the menu.</p>
        <Link to="/menu" className="btn-primary min-h-[44px] inline-flex items-center justify-center px-6">
          Back to Menu
        </Link>
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(order.orderStatus);

  return (
    <div className="min-h-screen bg-cream">
      <div className="flex items-center gap-3 p-4 border-b border-foam bg-white">
        <Link
          to="/menu"
          aria-label="Back to menu"
          className="min-h-[44px] min-w-[44px] rounded-full border border-foam flex items-center justify-center text-espresso-700 hover:bg-espresso-50 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display text-xl font-bold text-espresso-900">Track Order</h1>
        <span className="ml-auto text-xs text-espresso-500 flex items-center gap-1">
          {sseConnected ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <Clock size={11} />Live
            </span>
          ) : (
            <span className="flex items-center gap-1"><Clock size={11} />Polling</span>
          )}
        </span>
      </div>

      <div className="mx-auto max-w-xl p-4 space-y-4 pb-12">
        <div className="card p-6 text-center">
          <span className="text-4xl" role="img" aria-label="Status icon">{STATUS_ICONS[order.orderStatus] || '📋'}</span>
          <h2 className="font-display text-2xl font-bold text-espresso-900 mt-2">{STATUS_LABELS[order.orderStatus]}</h2>
          <p className="text-espresso-500 text-sm mt-1">{order.orderNumber} · Table {String(order.tableNumber).padStart(2, '0')}</p>
        </div>

        <div className="card p-5">
          <div className="space-y-4">
            {STATUS_STEPS.map((step, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500
                    ${done ? 'bg-espresso-900' : 'bg-espresso-100'}`}>
                    {done ? <span className="text-cream text-sm">✓</span> : <span className="text-espresso-400 text-sm">{i + 1}</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium text-sm ${done ? 'text-espresso-900 font-semibold' : 'text-espresso-400'}`}>
                      {STATUS_LABELS[step]}
                    </p>
                    {active && (
                      <p className="text-xs text-brew-600 mt-0.5 flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 bg-brew-500 rounded-full animate-pulse" />
                        In progress
                      </p>
                    )}
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