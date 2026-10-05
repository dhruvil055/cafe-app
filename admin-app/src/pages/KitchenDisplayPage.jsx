import { useEffect, useState, useRef } from 'react';
import { Loader2, Bell, CheckCircle2, AlertTriangle, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { subscribeToLiveStream } from '../utils/liveStream';
import { formatMoney } from '../utils/money';

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
const NEXT_STATUS = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'completed' };
const STATUS_LABEL = { pending: 'Received', confirmed: 'Received', preparing: 'Preparing', ready: 'Ready', completed: 'Served', cancelled: 'Cancelled' };
const STATUS_SOUND = {
  'new-order': 'new-order',
  'order-confirmed': 'confirm',
  'order-ready': 'ready',
  'order-completed': 'complete',
};

const playSound = (type) => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume();
    
    const sounds = {
      'new-order': { freq: 880, duration: 0.45, gain: 0.16 },
      'confirm': { freq: 660, duration: 0.3, gain: 0.12 },
      'ready': { freq: 784, duration: 0.4, gain: 0.14 },
      'complete': { freq: 1046, duration: 0.5, gain: 0.18 },
    };
    
    const sound = sounds[type] || sounds['new-order'];
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = sound.freq;
    gain.gain.setValueAtTime(sound.gain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + sound.duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + sound.duration);
  } catch { /* Audio may be unavailable or blocked by browser policy. */ }
};

export default function KitchenDisplayPage() {
  const tenant = useTenant();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'active'
  const audioContext = useRef(null);
  const unsubRef = useRef(null);

  const mergeOrder = (incoming) => setOrders((current) => {
    const exists = current.some((order) => String(order._id) === String(incoming._id));
    return exists
      ? current.map((order) => String(order._id) === String(incoming._id) ? { ...order, ...incoming } : order)
      : [incoming, ...current];
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
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
  }, []);

  useEffect(() => {
    unsubRef.current = subscribeToLiveStream('/orders/events/admin', {
      onEvent: (type, payload) => {
        if (type === 'connected') {
          fetchOrders();
        } else if ((type === 'new-order' || type === 'order-update') && payload.order) {
          const incoming = payload.order;
          const isNew = type === 'new-order';
          mergeOrder(incoming);
          
          // Play sound based on event type
          if (audioEnabled) {
            if (isNew) {
              playSound('new-order');
            } else if (incoming.orderStatus === 'confirmed') {
              playSound('confirm');
            } else if (incoming.orderStatus === 'ready') {
              playSound('ready');
            } else if (incoming.orderStatus === 'completed') {
              playSound('complete');
            }
          }
          
          if (isNew) {
            toast.success(`New order ${incoming.orderNumber} · Table ${incoming.tableNumber}`);
          }
        }
      },
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [audioEnabled]);

  const updateStatus = async (orderId, newStatus) => {
    try {
      const { data } = await api.put(`/orders/${orderId}/status`, { orderStatus: newStatus });
      setOrders((current) => current.map((order) => order._id === orderId ? data.order : order));
      toast.success(`Order marked as ${newStatus}`);
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const displayedOrders = viewMode === 'active'
    ? orders.filter((order) => ['pending', 'confirmed', 'preparing', 'ready'].includes(order.orderStatus))
    : orders.filter((order) => !['cancelled', 'completed'].includes(order.orderStatus));

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Top Bar */}
      <header className="border-b border-stone-800 bg-stone-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <span className="text-xl">🍳</span>
            </div>
            <div>
              <div className="font-bold text-sm text-white">Kitchen Display</div>
              <div className="text-[11px] text-stone-400">Live order queue · {orders.length} orders</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode((v) => v === 'active' ? 'all' : 'active')} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${viewMode === 'active' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-stone-700 bg-stone-800/50 text-stone-400'}`}>
              <span className="flex items-center gap-1">{viewMode === 'active' ? <Bell size={15} className="text-amber-400" /> : <span>📋</span>} {viewMode === 'active' ? 'Active only' : 'All orders'}</span>
            </button>
            <button onClick={() => {
              if (!audioContext.current) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) audioContext.current = new AudioContextClass();
              }
              audioContext.current?.resume();
              setAudioEnabled((e) => !e);
            }} aria-label={audioEnabled ? 'Mute alerts' : 'Enable alerts'} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-700 bg-stone-800/50 text-stone-400 hover:bg-stone-700/50 hover:text-stone-200">
              {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button onClick={fetchOrders} aria-label="Refresh orders" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-700 bg-stone-800/50 text-stone-400 hover:bg-stone-700/50 hover:text-stone-200">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-8 pb-16">
        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center text-stone-500"><Loader2 size={28} className="animate-spin text-amber-400" /></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {orders.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-stone-800 bg-stone-900/50 py-16 text-center text-stone-500">No orders found.</div>
            ) : 
              displayedOrders.map((order) => (
                <article key={order._id} className="relative rounded-2xl border border-stone-800 bg-stone-900/60 p-4 shadow-xl transition-all hover:border-amber-500/30">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
                        #{order.tableNumber}
                      </div>
                      <span className="text-xs font-semibold uppercase text-amber-400/80">{order.orderNumber}</span>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase status-${order.orderStatus} ${{
                      pending: 'bg-stone-800 text-stone-400 border border-stone-700',
                      confirmed: 'bg-blue-900/30 text-blue-400 border border-blue-500/30',
                      preparing: 'bg-amber-900/30 text-amber-400 border border-amber-500/30',
                      ready: 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30',
                      completed: 'bg-stone-800 text-stone-500 border border-stone-700',
                      cancelled: 'bg-red-900/30 text-red-400 border border-red-500/30',
                    }[order.orderStatus]}`}>
                      {STATUS_LABEL[order.orderStatus]}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {order.items?.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="border-t border-stone-800/50 pt-2 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-stone-200">{item.quantity} × {item.name}{item.variant?.name ? ` · ${item.variant.name}` : ''}</p>
                          {item.addons?.length > 0 && <p className="text-xs text-stone-500">Add-ons: {item.addons.map((addon) => addon.name).join(', ')}</p>}
                          {item.specialInstructions && <p className="text-xs font-medium text-amber-800 bg-amber-900/30 px-2 py-0.5 rounded">Note: {item.specialInstructions}</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {NEXT_STATUS[order.orderStatus] && (
                    <button
                      onClick={() => updateStatus(order._id, NEXT_STATUS[order.orderStatus])}
                      className="w-full mt-4 rounded-xl py-3 text-sm font-semibold transition-colors ${
                        order.orderStatus === 'ready' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' :
                        order.orderStatus === 'preparing' ? 'bg-amber-600 hover:bg-amber-500 text-white' :
                        order.orderStatus === 'confirmed' ? 'bg-blue-600 hover:bg-blue-500 text-white' :
                        'bg-stone-700 hover:bg-stone-600 text-white'
                      }"
                    >
                      {order.orderStatus === 'ready' ? 'Mark Ready & Serve' : `Mark as ${STATUS_LABEL[NEXT_STATUS[order.orderStatus]]}`}
                    </button>
                  )}
                </article>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
