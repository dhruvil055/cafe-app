import { useEffect, useState } from 'react';
import { ArrowLeft, ChefHat, Clock3, Download, Loader2, RefreshCw, UtensilsCrossed } from 'lucide-react';
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
  payment_created: 'Payment created',
  payment_processing: 'Processing',
  failed: 'Payment failed',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
};

export default function OrdersPage() {
  const { diningSessionToken, tableNumber, recentOrders = [] } = useCartStore();
  const [orders, setOrders] = useState([]);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const loadOrders = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      if (diningSessionToken) {
        const response = await api.get(`/session/bill?diningSessionToken=${encodeURIComponent(diningSessionToken)}`);
        setOrders(response.data.orders || []);
        setBill(response.data.bill || null);
      } else if (recentOrders.length > 0) {
        // Fetch status for recent orders stored on device
        const fetched = await Promise.allSettled(
          recentOrders.map(async (ro) => {
            const res = await api.get(`/orders/${ro.orderId}?accessToken=${encodeURIComponent(ro.accessToken)}`);
            return { ...res.data.order, accessToken: ro.accessToken };
          })
        );
        const validOrders = fetched
          .filter((p) => p.status === 'fulfilled' && p.value?._id)
          .map((p) => p.value);
        setOrders(validOrders);
      } else {
        setOrders([]);
      }
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
  }, [diningSessionToken, recentOrders]);

  const downloadReceipt = async (orderId, accessToken) => {
    setDownloadingId(orderId || 'session');
    try {
      const endpoint = diningSessionToken
        ? `/session/bill/receipt?diningSessionToken=${encodeURIComponent(diningSessionToken)}`
        : `/orders/${orderId}/receipt?accessToken=${encodeURIComponent(accessToken)}`;
      const response = await api.get(endpoint, { responseType: 'blob' });
      downloadPdf(response.data, `brewhaus-receipt-${orderId || 'session'}.pdf`);
    } catch (error) {
      toast.error(error.message || 'Unable to download receipt');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brew-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-50 pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-foam bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <Link to="/menu" className="flex h-9 w-9 items-center justify-center rounded-full border border-foam text-espresso-700" title="Back to menu" aria-label="Back to menu">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-espresso-900">My Orders</h1>
          <p className="text-xs text-espresso-500">Table {String(tableNumber || bill?.tableNumber || '-').padStart(2, '0')} · Live status</p>
        </div>
        <button
          onClick={() => loadOrders(true)}
          disabled={refreshing}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-foam text-espresso-700 hover:bg-sand-100"
          title="Refresh orders"
          aria-label="Refresh orders"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-10 sm:p-6">
        <div className="flex items-center justify-between rounded-2xl border border-brew-200 bg-brew-50 p-4 text-brew-900">
          <div className="flex items-center gap-3">
            <Clock3 size={20} className="text-brew-600" />
            <div>
              <p className="font-semibold">Kitchen updates are live</p>
              <p className="text-xs text-brew-700">This page refreshes automatically every 10 seconds.</p>
            </div>
          </div>
          <Link to="/menu" className="inline-flex items-center gap-1 text-xs font-semibold text-brew-700 hover:underline">
            <UtensilsCrossed size={14} /> Order more
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-espresso-200 bg-white p-10 text-center">
            <ChefHat size={32} className="mx-auto text-brew-500" />
            <p className="mt-3 font-display text-lg font-semibold text-espresso-900">No orders yet</p>
            <p className="mt-1 text-sm text-espresso-500">Scan a table QR code or order items from our menu.</p>
            <Link to="/menu" className="btn-primary mt-4 inline-flex">Browse Menu</Link>
          </div>
        ) : (
          <>
            {diningSessionToken && (
              <div className="flex flex-wrap gap-2">
                <Link to="/receipt" className="btn-secondary inline-flex items-center justify-center py-2.5 text-sm">
                  View Session Receipt
                </Link>
                <button
                  onClick={() => downloadReceipt(null, null)}
                  disabled={downloadingId === 'session'}
                  className="btn-primary inline-flex items-center justify-center py-2.5 text-sm disabled:opacity-60"
                >
                  <Download size={15} className="mr-1.5" />
                  {downloadingId === 'session' ? 'Preparing...' : 'Download Session Receipt'}
                </button>
              </div>
            )}

            {orders.map((order) => {
              const status = STATUS[order.orderStatus] || STATUS.pending;
              const cashPending = order.paymentMethod === 'cash' && order.cashVerificationStatus === 'pending';
              const orderToken = order.accessToken || recentOrders.find(r => r.orderId === order._id)?.accessToken;

              return (
                <article key={order._id} className={`rounded-2xl border border-foam bg-white p-4 shadow-sm ${order.orderStatus === 'cancelled' ? 'opacity-75' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${order.orderStatus === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-espresso-900 text-cream'}`}>
                      <ChefHat size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-espresso-900">{order.orderNumber}</h2>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.tone}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-espresso-500">
                        {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · Table {String(order.tableNumber).padStart(2, '0')}
                      </p>
                    </div>
                    <span className="price-tag text-sm font-semibold text-brew-800">₹{Number(order.total || 0).toFixed(2)}</span>
                  </div>

                  <p className={`mt-3 rounded-xl border p-2.5 text-xs font-medium ${status.tone}`}>
                    {cashPending ? 'Cash payment pending verification at counter before preparation can begin.' : status.detail}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-foam pt-3 text-xs text-espresso-500">
                    <span className="truncate">{order.items?.map((item) => `${item.name} ×${item.quantity}`).join(', ')}</span>
                    <span className="shrink-0 font-medium text-espresso-700">{PAYMENT[order.paymentStatus] || order.paymentStatus}</span>
                  </div>

                  {orderToken && (
                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-foam/50 pt-2">
                      <Link
                        to={`/track/${order._id}?token=${encodeURIComponent(orderToken)}`}
                        className="text-xs font-semibold text-brew-700 hover:underline"
                      >
                        Track Status
                      </Link>
                      <button
                        onClick={() => downloadReceipt(order._id, orderToken)}
                        disabled={downloadingId === order._id}
                        className="inline-flex items-center text-xs font-medium text-espresso-600 hover:text-espresso-900 disabled:opacity-50"
                      >
                        <Download size={13} className="mr-1" />
                        {downloadingId === order._id ? 'Downloading...' : 'Receipt'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
