import { useEffect, useState, useRef, useMemo } from 'react';
import {
  Loader2, Bell, CheckCircle2, AlertTriangle, Volume2, VolumeX,
  RefreshCw, Clock, UtensilsCrossed, CheckSquare, Square, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { subscribeToLiveStream } from '../utils/liveStream';

const STATIONS = ['ALL', 'KITCHEN', 'BAR', 'BAKERY', 'DESSERT'];
const STATUS_LABEL = {
  pending: 'Received',
  confirmed: 'Queued',
  preparing: 'Cooking',
  ready: 'Ready',
  completed: 'Served',
  cancelled: 'Cancelled',
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
      'delayed': { freq: 440, duration: 0.6, gain: 0.22 },
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
  } catch (_err) {
    // Audio context may be blocked by browser autoplay policy
  }
};

export default function KitchenDisplayPage() {
  const tenant = useTenant();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [viewFilter, setViewFilter] = useState('active'); // 'active' | 'ready' | 'history'
  const [checkedItems, setCheckedItems] = useState({}); // { [orderId_itemIndex]: boolean }
  const [now, setNow] = useState(Date.now());

  const audioContext = useRef(null);
  const unsubRef = useRef(null);

  // Live timer tick every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

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
      params.set('limit', '250');
      const { data } = await api.get(`/orders?${params.toString()}`);
      setOrders(data.orders || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load kitchen tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // SSE Live Stream Listener
  useEffect(() => {
    unsubRef.current = subscribeToLiveStream('/orders/events/admin', {
      onEvent: (type, payload) => {
        if (type === 'connected') {
          fetchOrders();
        } else if ((type === 'new-order' || type === 'order-update') && payload.order) {
          const incoming = payload.order;
          const isNew = type === 'new-order';
          mergeOrder(incoming);

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
            toast.success(`🍳 Ticket ${incoming.orderNumber} (Table ${incoming.tableNumber || 'Takeaway'})`);
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
      toast.success(`Ticket marked as ${STATUS_LABEL[newStatus] || newStatus}`);
    } catch (error) {
      toast.error(error.message || 'Failed to update ticket status');
    }
  };

  const toggleItemCheck = (orderId, itemIndex) => {
    const key = `${orderId}_${itemIndex}`;
    setCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Filter Orders by Station & View
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Status Filter
      if (viewFilter === 'active') {
        if (!['pending', 'confirmed', 'preparing'].includes(order.orderStatus)) return false;
      } else if (viewFilter === 'ready') {
        if (order.orderStatus !== 'ready') return false;
      } else if (viewFilter === 'history') {
        if (order.orderStatus !== 'completed') return false;
      }

      // 2. Station Filter
      if (selectedStation !== 'ALL') {
        const hasStationItem = order.items?.some(item => {
          const itemStation = item.kitchenStation || item.station || 'KITCHEN';
          return itemStation === selectedStation;
        });
        if (!hasStationItem) return false;
      }

      return true;
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // FIFO: Oldest tickets first
  }, [orders, viewFilter, selectedStation]);

  // Counts for top bar
  const counts = useMemo(() => {
    const active = orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.orderStatus)).length;
    const ready = orders.filter(o => o.orderStatus === 'ready').length;
    const delayed = orders.filter(o => {
      if (!['pending', 'confirmed', 'preparing'].includes(o.orderStatus)) return false;
      const mins = (now - new Date(o.createdAt).getTime()) / 60000;
      return mins > 20;
    }).length;
    return { active, ready, delayed };
  }, [orders, now]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Top Header Bar */}
      <header className="border-b border-stone-800 bg-stone-900/95 backdrop-blur px-4 py-3 shrink-0 sticky top-0 z-30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left Title & Live Counters */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xl shadow-inner">
              🍳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-white text-base tracking-wide">
                  Kitchen Display System (KDS)
                </span>
                {counts.delayed > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse flex items-center gap-1">
                    <AlertTriangle size={10} /> {counts.delayed} DELAYED
                  </span>
                )}
              </div>
              <div className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5">
                <span className="text-amber-400 font-semibold">{counts.active} active</span>
                <span>·</span>
                <span className="text-emerald-400 font-semibold">{counts.ready} ready to serve</span>
                <span>·</span>
                <span>{orders.length} total today</span>
              </div>
            </div>
          </div>

          {/* Middle: Station Filters */}
          <div className="flex items-center gap-1 bg-stone-950/80 p-1 rounded-xl border border-stone-800 overflow-x-auto">
            <span className="text-[10px] uppercase font-bold text-stone-500 px-2">Station:</span>
            {STATIONS.map(st => (
              <button
                key={st}
                onClick={() => setSelectedStation(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  selectedStation === st
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-stone-400 hover:text-white hover:bg-stone-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Right: View Tabs & Sound / Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex bg-stone-950/80 p-1 rounded-xl border border-stone-800">
              <button
                onClick={() => setViewFilter('active')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                  viewFilter === 'active'
                    ? 'bg-stone-800 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Active ({counts.active})
              </button>
              <button
                onClick={() => setViewFilter('ready')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                  viewFilter === 'ready'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Ready ({counts.ready})
              </button>
              <button
                onClick={() => setViewFilter('history')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                  viewFilter === 'history'
                    ? 'bg-stone-800 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Served History
              </button>
            </div>

            <button
              onClick={() => {
                if (!audioContext.current) {
                  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                  if (AudioContextClass) audioContext.current = new AudioContextClass();
                }
                audioContext.current?.resume();
                setAudioEnabled(prev => !prev);
              }}
              title={audioEnabled ? 'Sound alerts on' : 'Sound alerts muted'}
              className="h-9 w-9 rounded-xl border border-stone-700 bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center transition"
            >
              {audioEnabled ? <Volume2 size={16} className="text-amber-400" /> : <VolumeX size={16} />}
            </button>

            <button
              onClick={fetchOrders}
              title="Refresh tickets"
              className="h-9 w-9 rounded-xl border border-stone-700 bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center transition"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Ticket Grid */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {loading && orders.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center text-stone-400">
            <Loader2 size={32} className="animate-spin text-amber-400" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/40 py-24 text-center text-stone-500">
            <UtensilsCrossed size={48} className="mx-auto text-stone-700 mb-3" />
            <p className="text-lg font-semibold text-stone-300">Kitchen Queue is Clear!</p>
            <p className="text-xs text-stone-500 mt-1">All tickets in this view have been prepared and served</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredOrders.map(order => {
              const elapsedMins = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60000));
              const isDelayed = elapsedMins >= 20;
              const isWarning = elapsedMins >= 10 && elapsedMins < 20;

              // Border and header color based on duration
              const timerBadgeClass = isDelayed
                ? 'bg-red-500/20 text-red-300 border-red-500/50 animate-pulse'
                : isWarning
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';

              const orderTypeEmoji = {
                counter: '⚡ Counter',
                dine_in: `🍽️ Table ${order.tableNumber}`,
                takeaway: '🛍️ Takeaway',
                delivery: '🛵 Delivery',
              }[order.orderType || (order.tableNumber ? 'dine_in' : 'counter')];

              return (
                <article
                  key={order._id}
                  className={`flex flex-col justify-between rounded-3xl border transition-all duration-200 bg-stone-900/90 shadow-xl overflow-hidden ${
                    isDelayed
                      ? 'border-red-500/60 ring-2 ring-red-500/20'
                      : isWarning
                      ? 'border-amber-500/40'
                      : order.orderStatus === 'ready'
                      ? 'border-emerald-500/40'
                      : 'border-stone-800'
                  }`}
                >
                  <div>
                    {/* Ticket Header */}
                    <div className="p-3.5 bg-stone-950/70 border-b border-stone-800/80 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-white text-base tracking-wide">
                            {order.orderNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-stone-800 text-stone-300 border border-stone-700">
                            {orderTypeEmoji}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1.5">
                          <span>{order.customer?.name || 'Walk-in'}</span>
                          <span>·</span>
                          <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Live Timer Badge */}
                      <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1 ${timerBadgeClass}`}>
                        <Clock size={12} />
                        <span>{elapsedMins}m</span>
                      </div>
                    </div>

                    {/* Order Notes / Special Dietary Alert */}
                    {order.notes && (
                      <div className="mx-3 mt-2.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-medium">
                        ⚠️ Note: {order.notes}
                      </div>
                    )}

                    {/* Items List with Interactive Checkoff */}
                    <div className="p-3.5 space-y-2">
                      {order.items?.map((item, idx) => {
                        const itemKey = `${order._id}_${idx}`;
                        const isChecked = Boolean(checkedItems[itemKey]);

                        return (
                          <div
                            key={itemKey}
                            onClick={() => toggleItemCheck(order._id, idx)}
                            className={`p-2.5 rounded-2xl border transition cursor-pointer select-none ${
                              isChecked
                                ? 'bg-stone-950/40 border-stone-800/50 opacity-40 line-through'
                                : 'bg-stone-950/80 border-stone-800 hover:border-stone-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 min-w-0">
                                <button
                                  type="button"
                                  className="mt-0.5 text-stone-500 hover:text-stone-300 shrink-0"
                                >
                                  {isChecked ? (
                                    <CheckSquare size={16} className="text-emerald-400" />
                                  ) : (
                                    <Square size={16} />
                                  )}
                                </button>
                                <div className="min-w-0">
                                  <div className="font-semibold text-sm text-white">
                                    <span className="text-amber-400 font-bold mr-1">{item.quantity}×</span>
                                    <span>{item.name}</span>
                                    {item.variant?.name && (
                                      <span className="text-xs text-stone-400 ml-1">({item.variant.name})</span>
                                    )}
                                  </div>

                                  {/* Addons */}
                                  {item.addons?.length > 0 && (
                                    <div className="text-[11px] text-stone-400 mt-0.5">
                                      + {item.addons.map(a => a.name).join(', ')}
                                    </div>
                                  )}

                                  {/* Special Instructions */}
                                  {item.specialInstructions && (
                                    <div className="text-[11px] font-medium text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded mt-1 inline-block border border-amber-900/50">
                                      {item.specialInstructions}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {item.kitchenStation && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 shrink-0">
                                  {item.kitchenStation}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="p-3 bg-stone-950/80 border-t border-stone-800/80 space-y-2">
                    {order.orderStatus === 'pending' && (
                      <button
                        onClick={() => updateStatus(order._id, 'preparing')}
                        className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm transition flex items-center justify-center gap-1.5"
                      >
                        <span>Start Cooking</span>
                      </button>
                    )}

                    {order.orderStatus === 'confirmed' && (
                      <button
                        onClick={() => updateStatus(order._id, 'preparing')}
                        className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm transition flex items-center justify-center gap-1.5"
                      >
                        <span>Start Cooking</span>
                      </button>
                    )}

                    {order.orderStatus === 'preparing' && (
                      <button
                        onClick={() => updateStatus(order._id, 'ready')}
                        className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={14} />
                        <span>Mark Order Ready</span>
                      </button>
                    )}

                    {order.orderStatus === 'ready' && (
                      <button
                        onClick={() => updateStatus(order._id, 'completed')}
                        className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={14} />
                        <span>Mark Served / Complete</span>
                      </button>
                    )}

                    {order.orderStatus === 'completed' && (
                      <button
                        onClick={() => updateStatus(order._id, 'preparing')}
                        className="w-full py-2 rounded-xl text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 transition flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw size={13} />
                        <span>Recall to Kitchen</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
