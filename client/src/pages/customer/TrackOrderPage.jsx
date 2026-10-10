import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Loader2, UtensilsCrossed, Receipt, ShieldCheck, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { subscribeToLiveStream } from '../../utils/liveStream';
import usePageMeta from '../../hooks/usePageMeta';
import { useTenant } from '../../context/TenantContext';

const STATUS_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
const STATUS_LABELS = {
  pending: 'Order Received',
  confirmed: 'Order Confirmed',
  preparing: 'Being Prepared in Kitchen',
  ready: 'Fresh & Ready to Serve!',
  completed: 'Served & Completed',
};
const STATUS_DESCS = {
  pending: 'The kitchen queue has received your order.',
  confirmed: 'The kitchen team has accepted your order.',
  preparing: 'Your beverages and culinary dishes are being freshly crafted.',
  ready: 'Your order is hot and ready. Server is bringing it to your table!',
  completed: 'Hope you enjoyed your meal! Have a wonderful day.',
};
const STATUS_ICONS = {
  pending: '📋',
  confirmed: '✅',
  preparing: '👨‍🍳',
  ready: '🔔',
  completed: '🎉',
};

export default function TrackOrderPage() {
  const tenant = useTenant();
  usePageMeta({
    title: 'Live Order Tracker — Kitchen Progress',
    description: 'Track real-time preparation progress of your artisanal beverages and dishes.',
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
      <div className="min-h-screen bg-cream/90 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full border-2 border-brew-500 border-t-transparent animate-spin mb-3" />
        <p className="font-display text-lg font-bold text-espresso-950">Connecting to kitchen stream...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-cream/90 flex items-center justify-center flex-col gap-4 p-6 text-center max-w-md mx-auto">
        <div className="w-20 h-20 rounded-3xl bg-foam flex items-center justify-center text-4xl mb-2">
          ❓
        </div>
        <h1 className="font-display text-2xl font-bold text-espresso-950">Order not found</h1>
        <p className="text-sm text-espresso-500">Please verify your order link or return to the menu.</p>
        <Link to="/menu" className="btn-primary min-h-[46px] px-8 text-xs font-bold uppercase tracking-wider mt-2">
          Back to Menu
        </Link>
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(order.orderStatus);

  return (
    <div className="min-h-screen bg-cream/90 flex flex-col pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-foam/90 bg-white/95 backdrop-blur-md shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            to="/menu"
            aria-label="Back to Menu"
            className="min-h-[40px] min-w-[40px] rounded-full border border-espresso-200/80 flex items-center justify-center text-espresso-800 hover:bg-espresso-50 transition active:scale-95"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-display text-lg font-bold text-espresso-950 leading-none">
              Track Order
            </h1>
            <p className="text-[11px] text-espresso-500 mt-0.5">#{order.orderNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-white shadow-2xs">
          {sseConnected ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Live Updates</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-espresso-500">
              <Clock size={12} />
              <span>Polling Active</span>
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-xl w-full p-4 sm:p-6 space-y-4">
        {/* Current State Hero Card */}
        <div className="card p-6 text-center bg-white shadow-xs">
          <span className="text-5xl" role="img" aria-label="Status icon">
            {STATUS_ICONS[order.orderStatus] || '📋'}
          </span>
          <h2 className="font-display text-2xl font-bold text-espresso-950 mt-3">
            {STATUS_LABELS[order.orderStatus]}
          </h2>
          <p className="text-espresso-500 text-xs sm:text-sm mt-1 max-w-sm mx-auto">
            {STATUS_DESCS[order.orderStatus] || 'Your order is progressing smoothly.'}
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-foam/70 px-3.5 py-1.5 text-xs font-bold text-espresso-900 border border-foam">
            <span>Table {String(order.tableNumber).padStart(2, '0')}</span>
            <span className="text-espresso-300">•</span>
            <span className="font-mono">Order #{order.orderNumber}</span>
          </div>
        </div>

        {/* Timeline Stepper Card */}
        <div className="card p-6 bg-white shadow-xs space-y-6">
          <h3 className="font-display text-base font-bold text-espresso-950 border-b border-foam pb-3">
            Preparation Timeline
          </h3>

          <div className="space-y-6">
            {STATUS_STEPS.map((step, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              const isLast = i === STATUS_STEPS.length - 1;

              return (
                <div key={step} className="relative flex items-start gap-4">
                  {/* Vertical connecting line */}
                  {!isLast && (
                    <div
                      className={`absolute left-4 top-8 -bottom-6 w-0.5 transition-colors duration-500 ${
                        i < currentIdx ? 'bg-espresso-900' : 'bg-foam'
                      }`}
                    />
                  )}

                  {/* Step circle */}
                  <div
                    className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 shadow-2xs ${
                      done
                        ? 'bg-espresso-900 text-cream'
                        : 'bg-foam text-espresso-400 border border-espresso-200/50'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </div>

                  {/* Step text */}
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`font-display text-sm font-bold ${
                        done ? 'text-espresso-950' : 'text-espresso-400'
                      }`}>
                        {STATUS_LABELS[step]}
                      </p>
                      {active && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brew-600 bg-brew-50 px-2 py-0.5 rounded-full border border-brew-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-brew-500 animate-pulse" />
                          <span>Current</span>
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${done ? 'text-espresso-600' : 'text-espresso-400'}`}>
                      {STATUS_DESCS[step]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link
            to={`/receipt/${orderId}?accessToken=${encodeURIComponent(accessToken)}`}
            className="btn-secondary min-h-[46px] flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <Receipt size={16} />
            <span>Receipt</span>
          </Link>

          <Link
            to="/menu"
            className="btn-primary min-h-[46px] flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <UtensilsCrossed size={16} />
            <span>Menu</span>
          </Link>
        </div>
      </main>
    </div>
  );
}