import { useEffect, useState } from 'react';
import { ArrowLeft, ChefHat, Clock3, Loader2, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useCartStore from '../../context/cartStore';
import { downloadPdf } from '../../utils/download';

const STATUS = {
  pending: { label: 'Order received', detail: 'Waiting for the cafe to confirm your order.', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
  confirmed: { label: 'Confirmed', detail: 'Your order is confirmed and queued for preparation.', tone: 'border-sky-200 bg-sky-50 text-sky-800' },
  preparing: { label: 'Being prepared', detail: 'The kitchen is preparing your order now.', tone: 'border-orange-200 bg-orange-50 text-orange-800' },
  ready: { label: 'Ready to serve', detail: 'Your order is ready and coming to your table.', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  completed: { label: 'Served', detail: 'This order has been served.', tone: 'border-stone-200 bg-stone-100 text-stone-700' },
  cancelled: { label: 'Cancelled', detail: 'This order was cancelled.', tone: 'border-rose-200 bg-rose-50 text-rose-800' },
};

const PAYMENT = {
  paid: 'Paid',
  pending: 'Payment pending',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

export default function OrdersPage() {
  const { diningSessionToken, tableNumber } = useCartStore();
  const [orders, setOrders] = useState([]);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadOrders = async (showSpinner = false) => {
    if (!diningSessionToken) { setLoading(false); return; }
    if (showSpinner) setRefreshing(true);
    try {
      const response = await api.get(`/session/bill?diningSessionToken=${encodeURIComponent(diningSessionToken)}`);
      setOrders(response.data.orders || []);
      setBill(response.data.bill || null);
    } catch (error) {
      if (showSpinner) toast.error(error.message || 'Unable to refresh orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => loadOrders(), 10000);
    return () => clearInterval(interval);
  }, [diningSessionToken]);

  const downloadReceipt = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/session/bill/receipt?diningSessionToken=${encodeURIComponent(diningSessionToken)}`, { responseType: 'blob' });
      downloadPdf(response.data, 'brewhaus-receipt.pdf');
    } catch (error) {
      toast.error(error.message || 'Unable to download receipt');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-cream"><Loader2 className="animate-spin text-brew-500" /></div>;

  if (!diningSessionToken) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream p-8 text-center"><ChefHat size={40} className="text-brew-500" /><h1 className="font-display text-2xl font-bold text-espresso-900">Scan your table to view orders</h1><p className="max-w-sm text-sm text-espresso-500">Your live order status is available after joining the table dining session.</p><Link to="/menu" className="btn-primary">Back to Menu</Link></div>;
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center gap-3 border-b border-foam bg-white p-4">
        <Link to="/menu" className="flex h-9 w-9 items-center justify-center rounded-full border border-foam"><ArrowLeft size={18} /></Link>
        <div className="min-w-0"><h1 className="font-display text-xl font-bold text-espresso-900">My Orders</h1><p className="text-xs text-espresso-500">Table {String(tableNumber || bill?.tableNumber || '-').padStart(2, '0')} · Live status</p></div>
        <button onClick={() => loadOrders(true)} disabled={refreshing} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-foam text-espresso-700" title="Refresh orders" aria-label="Refresh orders"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-10 sm:p-6">
        <div className="flex items-center justify-between rounded-2xl border border-brew-200 bg-brew-50 p-4 text-brew-900"><div className="flex items-center gap-3"><Clock3 size={20} className="text-brew-600" /><div><p className="font-semibold">Kitchen updates are live</p><p className="text-xs text-brew-700">This page refreshes automatically.</p></div></div><Link to="/menu" className="inline-flex items-center gap-1 text-xs font-semibold text-brew-700"><UtensilsCrossed size={14} /> Order more</Link></div>

        {orders.length === 0 ? <div className="rounded-2xl border border-dashed border-espresso-200 bg-white p-10 text-center"><ChefHat size={32} className="mx-auto text-brew-500" /><p className="mt-3 font-display text-lg font-semibold text-espresso-900">No orders yet</p><Link to="/menu" className="btn-primary mt-4">Browse Menu</Link></div> : <>
          <div className="flex flex-wrap gap-2"><Link to="/receipt" className="btn-secondary inline-flex items-center justify-center py-3 text-sm">View Receipt</Link><button onClick={downloadReceipt} disabled={downloading} className="btn-primary inline-flex items-center justify-center py-3 text-sm disabled:opacity-60">{downloading ? 'Preparing...' : 'Download Receipt'}</button></div>
          {orders.map((order) => {
          const status = STATUS[order.orderStatus] || STATUS.pending;
          const cashPending = order.paymentMethod === 'cash' && order.cashVerificationStatus === 'pending';
          return <article key={order._id} className={`rounded-2xl border bg-white p-4 shadow-sm ${order.orderStatus === 'cancelled' ? 'opacity-75' : ''}`}>
            <div className="flex items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${order.orderStatus === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-espresso-900 text-cream'}`}><ChefHat size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-espresso-900">{order.orderNumber}</h2><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${status.tone}`}>{status.label}</span></div><p className="mt-1 text-xs text-espresso-500">{new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · Table {String(order.tableNumber).padStart(2, '0')}</p></div><span className="font-display font-semibold text-espresso-900">₹{Number(order.total || 0).toFixed(2)}</span></div>
            <p className={`mt-4 rounded-xl border p-3 text-sm ${status.tone}`}>{cashPending ? 'Cash payment pending verification before preparation can begin.' : status.detail}</p>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-foam pt-3 text-xs text-espresso-500"><span>{order.items?.map((item) => `${item.name} ×${item.quantity}`).join(', ')}</span><span className="shrink-0 font-medium">{PAYMENT[order.paymentStatus] || order.paymentStatus}</span></div>
          </article>;
          })}
        </>}
      </main>
    </div>
  );
}
