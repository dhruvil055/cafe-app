import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, UtensilsCrossed, CheckCircle2, Clock, Loader2, Sparkles, Receipt, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { downloadPdf } from '../../utils/download';
import NotificationPermissionPrompt from '../../components/ui/NotificationPermissionPrompt';
import { subscribeToLiveStream } from '../../utils/liveStream';
import { useTenant } from '../../context/TenantContext';
import { formatMoney } from '../../utils/money';
import usePageMeta from '../../hooks/usePageMeta';

const STATUS_CONFIG = {
  pending:   { label: 'Order Received',    color: 'text-amber-800', bg: 'bg-amber-50/80', border: 'border-amber-200', icon: '📋' },
  confirmed: { label: 'Order Confirmed',   color: 'text-blue-800',   bg: 'bg-blue-50/80',   border: 'border-blue-200',   icon: '✅' },
  preparing: { label: 'Being Prepared',    color: 'text-orange-800', bg: 'bg-orange-50/80', border: 'border-orange-200', icon: '👨‍🍳' },
  ready:     { label: 'Ready to Serve!',   color: 'text-emerald-800',  bg: 'bg-emerald-50/80',  border: 'border-emerald-200',  icon: '🔔' },
  completed: { label: 'Served & Enjoyed',  color: 'text-gray-800',   bg: 'bg-gray-50/80',   border: 'border-gray-200',   icon: '🎉' },
};

export default function OrderConfirmPage() {
  const tenant = useTenant();

  usePageMeta({
    title: 'Order Confirmed — Kitchen Status & Receipt',
    description: 'Your order has been sent to the kitchen. Track real-time preparation progress and download your itemized receipt.',
  });
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('token');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const safeItems = Array.isArray(order?.items) ? order.items : [];

  useEffect(() => {
    if (!accessToken) return undefined;
    const fetchOrder = () => api.get(`/orders/${orderId}?accessToken=${encodeURIComponent(accessToken)}`)
      .then((res) => { setOrder(res.data.order); setLoading(false); })
      .catch(() => setLoading(false));
    fetchOrder();
    return subscribeToLiveStream(`/orders/${orderId}/events`, {
      headers: { 'X-Order-Access-Token': accessToken },
      onEvent: (type, payload) => {
        if (type === 'connected') fetchOrder();
        if (type === 'order-update' && payload.order) {
          setOrder((current) => ({ ...current, ...payload.order }));
          setLoading(false);
        }
      },
    });
  }, [orderId, accessToken]);

  const handleDownloadReceipt = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/orders/${orderId}/receipt?accessToken=${accessToken}`, { responseType: 'blob' });
      downloadPdf(res.data, `receipt-${order.orderNumber}.pdf`);
    } catch (e) {
      console.error('Receipt download failed:', e);
      toast.error('Unable to download receipt PDF.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream/90 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full border-2 border-brew-500 border-t-transparent animate-spin mb-3" />
        <p className="font-display text-lg font-bold text-espresso-950">Retrieving order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-cream/90 flex flex-col items-center justify-center gap-4 p-8 text-center max-w-md mx-auto">
        <div className="w-20 h-20 rounded-3xl bg-foam flex items-center justify-center text-4xl mb-2">
          ❓
        </div>
        <h1 className="font-display text-2xl font-bold text-espresso-950">Order not found</h1>
        <p className="text-espresso-500 text-sm">
          We could not locate this order. Please verify your order link or return to the menu.
        </p>
        <Link to="/menu" className="btn-primary min-h-[46px] px-8 text-xs font-bold uppercase tracking-wider mt-2">
          Back to Menu
        </Link>
      </div>
    );
  }

  const status = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.pending;

  return (
    <div className="min-h-screen bg-cream/90 pb-16">
      {/* Celebration Header */}
      <div className="relative bg-espresso-950 px-6 py-12 text-center overflow-hidden text-cream">
        <div className="absolute inset-0 bg-gradient-to-t from-espresso-950 via-espresso-900/40 to-black/30 pointer-events-none" />

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 300 }}
          className="relative z-10 w-20 h-20 rounded-3xl bg-gradient-to-br from-brew-500 to-brew-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-brew-500/20 text-white"
        >
          <CheckCircle2 size={42} strokeWidth={2.4} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="relative z-10 max-w-lg mx-auto"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brew-300 border border-white/10 mb-2">
            <Sparkles size={13} />
            <span>{order.paymentStatus === 'paid' ? 'Payment Verified' : 'Order Placed'}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Order #{order.orderNumber} Confirmed!
          </h1>
          <p className="text-cream/80 text-xs sm:text-sm mt-2 leading-relaxed">
            {order.paymentMethod === 'cash'
              ? 'Your order has been sent to the kitchen. You can pay at the billing counter when leaving.'
              : order.paymentStatus === 'paid'
                ? 'Your payment was received successfully! The kitchen is preparing your dishes.'
                : 'Payment submitted. We are confirming it with the payment gateway.'}
          </p>
        </motion.div>
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4 -mt-4">
        {/* Order Metadata Pills Card */}
        <div className="card p-4 sm:p-5 bg-white shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Order #', value: order.orderNumber },
              { label: 'Table', value: `Table ${String(order.tableNumber).padStart(2, '0')}` },
              { label: 'Payment', value: order.paymentMethod === 'razorpay' ? 'Online' : 'Cash at Counter' },
              { label: 'Total Paid', value: formatMoney(order.total, order.currency || tenant.currency) },
            ].map(row => (
              <div key={row.label} className="bg-foam/70 rounded-2xl p-3 border border-foam">
                <p className="text-[11px] font-bold uppercase tracking-wider text-espresso-400">{row.label}</p>
                <p className="font-display font-bold text-espresso-950 text-sm sm:text-base mt-0.5">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live Kitchen Preparation Progress */}
        <div className={`card p-5 ${status.bg} border ${status.border} shadow-xs`}>
          <div className="flex items-center gap-3.5">
            <span className="text-3xl">{status.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className={`font-display text-lg font-bold ${status.color}`}>{status.label}</p>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-espresso-600 text-xs flex items-center gap-1.5 mt-0.5 font-medium">
                <Clock size={12} />
                <span>Real-time kitchen updates stream automatically</span>
              </p>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="mt-5 flex items-center gap-1.5">
            {['received', 'preparing', 'ready', 'served'].map((s, i) => {
              const currentIdx = ({ pending: 0, confirmed: 0, preparing: 1, ready: 2, completed: 3 })[order.orderStatus] ?? 0;
              const done = i <= currentIdx;
              return (
                <div key={s} className="flex-1 flex items-center">
                  <div className={`flex-1 h-2 rounded-full transition-all duration-500 ${
                    done ? 'bg-espresso-950' : 'bg-espresso-200/80'
                  }`} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            {['Received', 'Preparing', 'Ready', 'Served'].map((label, i) => {
              const currentIdx = ({ pending: 0, confirmed: 0, preparing: 1, ready: 2, completed: 3 })[order.orderStatus] ?? 0;
              const isCurrent = i === currentIdx;
              return (
                <span key={label} className={`text-[10px] uppercase tracking-wider flex-1 text-center font-bold ${
                  isCurrent ? 'text-espresso-950' : 'text-espresso-400'
                }`}>
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Notification Permission Opt-In */}
        <NotificationPermissionPrompt
          customerId={order.customerId}
          phone={order.customer?.phone}
          variant="card"
        />

        {/* Itemized Order Breakdown */}
        <div className="card p-5 bg-white space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between border-b border-foam pb-3">
            <h2 className="font-display text-base font-bold text-espresso-950">
              Ordered Items
            </h2>
            <span className="text-xs font-semibold text-espresso-500">
              {safeItems.length} {safeItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="space-y-2.5">
            {safeItems.map((item, i) => (
              <div key={i} className="flex justify-between items-baseline text-xs sm:text-sm">
                <div className="flex-1 pr-3">
                  <p className="font-semibold text-espresso-900">
                    {item.name} <span className="text-espresso-500 font-normal">× {item.quantity}</span>
                  </p>
                  {item.addons?.length > 0 && (
                    <p className="text-[11px] text-espresso-400 mt-0.5">
                      +{item.addons.map(a => a.name).join(', ')}
                    </p>
                  )}
                </div>
                <span className="price-tag text-xs sm:text-sm font-bold text-espresso-950 flex-shrink-0">
                  {formatMoney(item.itemTotal, order.currency || tenant.currency)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-foam pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-espresso-600">
              <span>Subtotal</span>
              <span className="price-tag text-xs">{formatMoney(order.subtotal, order.currency || tenant.currency)}</span>
            </div>
            <div className="flex justify-between text-espresso-600">
              <span>GST ({order.taxRate ?? tenant.taxRate}%)</span>
              <span className="price-tag text-xs">{formatMoney(order.tax, order.currency || tenant.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-espresso-200 pt-2 text-base font-bold text-espresso-950">
              <span>Grand Total</span>
              <span className="price-tag text-lg text-espresso-950">{formatMoney(order.total, order.currency || tenant.currency)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 pt-2">
          <Link
            to={`/receipt/${orderId}?accessToken=${encodeURIComponent(accessToken)}`}
            className="btn-secondary min-h-[46px] flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <Receipt size={16} />
            <span>View Receipt</span>
          </Link>

          <Link
            to={`/track/${orderId}?token=${encodeURIComponent(accessToken)}`}
            className="btn-accent min-h-[46px] flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <Clock size={16} />
            <span>Track Kitchen Live</span>
          </Link>

          {order.paymentMethod !== 'cash' && (
            <button
              type="button"
              onClick={handleDownloadReceipt}
              disabled={downloading}
              className="btn-secondary min-h-[46px] flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider sm:col-span-2"
            >
              {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              <span>{downloading ? 'Preparing Receipt PDF...' : 'Download PDF Receipt'}</span>
            </button>
          )}

          <Link
            to="/menu"
            className="btn-primary min-h-[48px] flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider sm:col-span-2 shadow-sm"
          >
            <UtensilsCrossed size={16} />
            <span>Back to Menu</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
