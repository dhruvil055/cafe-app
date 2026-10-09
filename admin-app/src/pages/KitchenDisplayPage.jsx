import { useEffect, useState, useRef, useMemo } from 'react';
import {
  Loader2, Bell, CheckCircle2, AlertTriangle, Volume2, VolumeX,
  RefreshCw, Clock, UtensilsCrossed, CheckSquare, Square, RotateCcw,
  Maximize2, Minimize2, Moon, Sun
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
  } catch (_err) {}
};

export default function KitchenDisplayPage() {
  const tenant = useTenant();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isKitchenDark, setIsKitchenDark] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [viewFilter, setViewFilter] = useState('active'); // 'active' | 'ready' | 'history'
  const [checkedItems, setCheckedItems] = useState({});
  const [now, setNow] = useState(Date.now());

  const unsubRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

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
            if (isNew) playSound('new-order');
            else if (incoming.orderStatus === 'confirmed') playSound('confirm');
            else if (incoming.orderStatus === 'ready') playSound('ready');
            else if (incoming.orderStatus === 'completed') playSound('complete');
          }

          if (isNew) {
            toast.success(`🍳 Ticket #${incoming.orderNumber} (Table ${incoming.tableNumber || 'Takeaway'})`);
          }
        }
      },
      onError: () => {},
    });

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [audioEnabled]);

  const updateStatus = async (orderId, newStatus) => {
    try {
      const { data } = await api.patch(`/orders/${orderId}/status`, { orderStatus: newStatus });
      mergeOrder(data.order);
      if (audioEnabled) {
        if (newStatus === 'ready') playSound('ready');
        if (newStatus === 'completed') playSound('complete');
      }
      toast.success(`Order updated to ${STATUS_LABEL[newStatus] || newStatus}`);
    } catch (error) {
      toast.error(error.message || 'Status update failed');
    }
  };

  const toggleItemCheck = (orderId, itemIndex) => {
    const key = `${orderId}_${itemIndex}`;
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (viewFilter === 'active') {
        if (!['pending', 'confirmed', 'preparing'].includes(order.orderStatus)) return false;
      } else if (viewFilter === 'ready') {
        if (order.orderStatus !== 'ready') return false;
      } else if (viewFilter === 'history') {
        if (order.orderStatus !== 'completed') return false;
      }

      if (selectedStation !== 'ALL') {
        const hasStationItem = order.items?.some(item => {
          const itemStation = item.kitchenStation || item.station || 'KITCHEN';
          return itemStation === selectedStation;
        });
        if (!hasStationItem) return false;
      }

      return true;
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [orders, viewFilter, selectedStation]);

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
    <div className={`space-y-4 rounded-3xl p-4 sm:p-5 transition-colors ${
      isKitchenDark ? 'bg-stone-950 text-stone-100' : 'bg-white text-stone-900 border border-stone-200'
    }`}>
      {/* ── Kitchen Control Toolbar (Single clean header) ────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-base sm:text-lg">
              🍳 Kitchen Tickets
            </span>
            {counts.delayed > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse flex items-center gap-1">
                <AlertTriangle size={11} /> {counts.delayed} DELAYED (&gt;20m)
              </span>
            )}
          </div>
          <div className="text-xs text-stone-400 hidden sm:flex items-center gap-2">
            <span className="text-amber-400 font-bold">{counts.active} active</span>
            <span>·</span>
            <span className="text-emerald-400 font-bold">{counts.ready} ready</span>
          </div>
        </div>

        {/* Action Controls Cluster */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Station Selector */}
          <div className="flex items-center gap-1 bg-stone-900/90 p-1 rounded-xl border border-stone-800 text-xs">
            <span className="text-[10px] uppercase font-bold text-stone-400 px-1.5 hidden md:inline">Station:</span>
            {STATIONS.map(st => (
              <button
                key={st}
                onClick={() => setSelectedStation(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedStation === st
                    ? 'bg-amber-500 text-stone-950 shadow-xs font-bold'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              audioEnabled
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-stone-800 bg-stone-900 text-stone-400'
            }`}
            title={audioEnabled ? 'Kitchen chime sound on' : 'Kitchen sound muted'}
          >
            {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Kitchen Dark/Light Mode Toggle */}
          <button
            onClick={() => setIsKitchenDark(!isKitchenDark)}
            className="p-2 rounded-xl border border-stone-800 bg-stone-900 text-stone-300 hover:text-white transition"
            title={isKitchenDark ? 'Switch to light mode' : 'Switch to kitchen dark mode'}
          >
            {isKitchenDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl border border-stone-800 bg-stone-900 text-stone-300 hover:text-white transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Kitchen Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            onClick={fetchOrders}
            className="p-2 rounded-xl border border-stone-800 bg-stone-900 text-stone-300 hover:text-white transition"
            title="Refresh kitchen tickets"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── View Filter Tabs (Active / Ready / History) ──────────── */}
      <div className="flex gap-2 text-xs font-bold">
        <button
          onClick={() => setViewFilter('active')}
          className={`px-4 py-2 rounded-xl transition ${
            viewFilter === 'active'
              ? 'bg-amber-500 text-stone-950 shadow-sm'
              : 'bg-stone-900/80 text-stone-400 hover:text-white'
          }`}
        >
          Active Cooking Queue ({counts.active})
        </button>
        <button
          onClick={() => setViewFilter('ready')}
          className={`px-4 py-2 rounded-xl transition ${
            viewFilter === 'ready'
              ? 'bg-emerald-500 text-stone-950 shadow-sm'
              : 'bg-stone-900/80 text-stone-400 hover:text-white'
          }`}
        >
          Ready to Serve ({counts.ready})
        </button>
        <button
          onClick={() => setViewFilter('history')}
          className={`px-4 py-2 rounded-xl transition ${
            viewFilter === 'history'
              ? 'bg-stone-700 text-white shadow-sm'
              : 'bg-stone-900/80 text-stone-400 hover:text-white'
          }`}
        >
          Completed History
        </button>
      </div>

      {/* ── Kitchen Ticket Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max pt-2">
        {loading && orders.length === 0 ? (
          <div className="col-span-full py-24 text-center text-stone-400">
            <Loader2 className="animate-spin mx-auto mb-2" size={32} />
            <span>Connecting to live kitchen feed...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="col-span-full py-24 text-center text-stone-500 space-y-2">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
            <div className="text-sm font-bold text-stone-300">No tickets in this station!</div>
            <div className="text-xs text-stone-500">All kitchen orders have been cooked and served.</div>
          </div>
        ) : (
          filteredOrders.map(order => {
            const elapsedMins = Math.floor((now - new Date(order.createdAt).getTime()) / 60000);
            const isDelayed = elapsedMins > 20;
            const isWarning = elapsedMins > 10 && elapsedMins <= 20;

            const timerColor = isDelayed
              ? 'bg-red-500 text-white animate-pulse border-red-600'
              : isWarning
              ? 'bg-amber-500 text-stone-950 border-amber-600'
              : 'bg-stone-800 text-stone-300 border-stone-700';

            return (
              <div
                key={order._id}
                className={`rounded-3xl border flex flex-col justify-between overflow-hidden shadow-lg transition ${
                  isKitchenDark ? 'bg-stone-900/90 border-stone-800' : 'bg-white border-stone-200'
                }`}
              >
                {/* Header */}
                <div className={`p-4 border-b ${isKitchenDark ? 'border-stone-800 bg-stone-950/60' : 'border-stone-100 bg-stone-50/80'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-base tracking-wide flex items-center gap-2">
                        <span>#{order.orderNumber || order._id.slice(-4)}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          order.orderType === 'dine_in'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}>
                          {order.orderType === 'dine_in' ? `Table ${order.tableNumber}` : 'Takeaway'}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400 mt-1">
                        {order.customer?.name || 'Walk-in'} · {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* Timer chip */}
                    <div className={`px-2.5 py-1 rounded-xl text-xs font-mono font-extrabold border flex items-center gap-1 ${timerColor}`}>
                      <Clock size={12} />
                      <span>{elapsedMins}m</span>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="mt-2 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 p-2 rounded-xl">
                      ⚠️ Note: {order.notes}
                    </div>
                  )}
                </div>

                {/* Items with interactive checkoff */}
                <div className="p-4 space-y-2.5 flex-1 overflow-y-auto max-h-[340px] custom-sidebar-scroll">
                  {order.items?.map((item, idx) => {
                    const key = `${order._id}_${idx}`;
                    const isChecked = Boolean(checkedItems[key]);

                    return (
                      <div
                        key={key}
                        onClick={() => toggleItemCheck(order._id, idx)}
                        className={`p-2.5 rounded-2xl border transition cursor-pointer select-none flex items-start gap-2.5 ${
                          isChecked
                            ? 'opacity-35 line-through bg-black/20 border-transparent'
                            : isKitchenDark
                            ? 'bg-stone-950/70 border-stone-800 hover:border-stone-700'
                            : 'bg-stone-50 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <button type="button" className="mt-0.5 text-stone-400 shrink-0">
                          {isChecked ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold leading-tight">
                            <span className="text-amber-400 mr-1.5">{item.quantity}×</span>
                            <span>{item.name}</span>
                            {item.variant?.name && (
                              <span className="text-xs opacity-75 ml-1">({item.variant.name})</span>
                            )}
                          </div>
                          {item.addons?.length > 0 && (
                            <div className="text-[11px] text-stone-400 mt-0.5">
                              +{item.addons.map(a => a.name).join(', ')}
                            </div>
                          )}
                          {item.specialInstructions && (
                            <div className="text-[11px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">
                              {item.specialInstructions}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className={`p-3 border-t ${isKitchenDark ? 'border-stone-800 bg-stone-950/80' : 'border-stone-100 bg-stone-50'}`}>
                  {['pending', 'confirmed'].includes(order.orderStatus) && (
                    <button
                      onClick={() => updateStatus(order._id, 'preparing')}
                      className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm transition"
                    >
                      Start Cooking
                    </button>
                  )}
                  {order.orderStatus === 'preparing' && (
                    <button
                      onClick={() => updateStatus(order._id, 'ready')}
                      className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-sm transition"
                    >
                      Mark as Ready (Bell 🔔)
                    </button>
                  )}
                  {order.orderStatus === 'ready' && (
                    <button
                      onClick={() => updateStatus(order._id, 'completed')}
                      className="w-full py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition"
                    >
                      Complete & Served ✓
                    </button>
                  )}
                  {order.orderStatus === 'completed' && (
                    <button
                      onClick={() => updateStatus(order._id, 'preparing')}
                      className="w-full py-2 rounded-xl text-xs font-semibold border border-stone-700 text-stone-400 hover:text-white"
                    >
                      Reopen Ticket
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
