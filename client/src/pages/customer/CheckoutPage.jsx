import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, Banknote, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useCartStore from '../../context/cartStore';

const loadRazorpay = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, tableNumber, clearCart, diningSessionToken, addRecentOrder } = useCartStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => (
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `chk_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  ));

  const subtotal = items.reduce((s, i) => s + i.itemTotal, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center flex-col gap-4">
        <span className="text-5xl">🛒</span>
        <p className="font-display text-xl text-espresso-900">Your cart is empty</p>
        <Link to="/menu" className="btn-primary">Back to Menu</Link>
      </div>
    );
  }

  const validate = () => {
    if (!name.trim()) return 'Please enter your name.';
    if (!phone.trim() || !/^\d{10}$/.test(phone)) return 'Please enter a valid 10-digit phone number.';
    return null;
  };

  const handleCashOrder = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError('');
    try {
      const secureItems = items.map(item => ({
        productId: item.product,
        quantity: item.quantity,
        ...(item.variant && { variantId: item.variant._id }),
        ...(item.addons.length > 0 && { addonIds: item.addons.map(a => a._id) }),
      }));

      const orderData = {
        tableNumber,
        customer: { name: name.trim(), phone: phone.trim() },
        items: secureItems,
        paymentMethod: 'cash',
        idempotencyKey,
        ...(diningSessionToken && { diningSessionToken }),
      };
      const res = await api.post('/orders', orderData);
      const { accessToken, order } = res.data;
      if (addRecentOrder && order?._id) {
        addRecentOrder({
          orderId: order._id,
          orderNumber: order.orderNumber,
          accessToken,
          tableNumber,
          createdAt: order.createdAt || new Date().toISOString(),
          total: order.total,
          paymentMethod: 'cash',
        });
      }
      clearCart();
      navigate(`/order-confirm/${res.data.order._id}?token=${accessToken}`);
    } catch (e) {
      setError(e.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpayOrder = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError('');

    try {
      const secureItems = items.map(item => ({
        productId: item.product,
        quantity: item.quantity,
        ...(item.variant && { variantId: item.variant._id }),
        ...(item.addons.length > 0 && { addonIds: item.addons.map(a => a._id) }),
      }));

      const orderData = {
        tableNumber,
        customer: { name: name.trim(), phone: phone.trim() },
        items: secureItems,
        paymentMethod: 'razorpay',
        idempotencyKey,
        ...(diningSessionToken && { diningSessionToken }),
      };
      const orderRes = await api.post('/orders', orderData);
      const order = orderRes.data.order;
      const { accessToken } = orderRes.data;

      if (addRecentOrder && order?._id) {
        addRecentOrder({
          orderId: order._id,
          orderNumber: order.orderNumber,
          accessToken,
          tableNumber,
          createdAt: order.createdAt || new Date().toISOString(),
          total: order.total,
          paymentMethod: 'razorpay',
        });
      }

      if (import.meta.env.VITE_DEMO_PAYMENTS !== 'false') {
        await api.post('/payment/demo-complete', { orderId: order._id, accessToken });
        clearCart();
        navigate(`/order-confirm/${order._id}?token=${accessToken}`);
        return;
      }

      const rzpRes = await api.post('/payment/create-order', { orderId: order._id, accessToken });
      const { razorpayOrderId, amount, keyId } = rzpRes.data;

      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Payment gateway failed to load. Check your internet connection.');

      const rzp = new window.Razorpay({
        key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount,
        currency: 'INR',
        name: 'Brewhaus Cafe',
        description: `Order ${order.orderNumber} · Table ${tableNumber}`,
        order_id: razorpayOrderId,
        prefill: { name: name.trim(), contact: phone.trim() },
        theme: { color: '#1a0f08' },
        modal: {
          ondismiss: () => {
            setLoading(false);
            api.post('/payment/cancel', { orderId: order._id, accessToken }).catch(() => {});
            toast.error('Payment cancelled.');
          }
        },
        handler: async (response) => {
          try {
            await api.post('/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId: order._id,
              accessToken,
            });
            clearCart();
            navigate(`/order-confirm/${order._id}?token=${accessToken}`);
          } catch (verifyErr) {
            setError(verifyErr.message || 'Payment verification failed.');
            setLoading(false);
          }
        },
      });

      rzp.open();
    } catch (e) {
      setError(e.message || 'Failed to process payment. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (paymentMethod === 'cash') handleCashOrder();
    else handleRazorpayOrder();
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-foam bg-white sticky top-0 z-10">
        <Link to="/cart" className="w-9 h-9 rounded-full border border-foam flex items-center justify-center">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display text-xl font-bold text-espresso-900">Checkout</h1>
      </div>

      <div className="p-4 space-y-4 pb-40 sm:pb-32">
        {/* Table badge */}
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-espresso-900">
            <span className="font-display font-bold text-sm text-cream">
              {String(tableNumber || '—').padStart(2, '0')}
            </span>
          </div>
          <div>
            <p className="text-xs text-espresso-400">Your Table</p>
            <p className="font-medium text-espresso-900">
              {tableNumber ? `Table ${String(tableNumber).padStart(2, '0')}` : 'Not set — scan QR on menu'}
            </p>
          </div>
        </div>

        {/* Customer info */}
        <div className="card p-4 space-y-3">
          <h2 className="font-display font-semibold text-espresso-900">Your Details</h2>
          <div>
            <label className="text-xs text-espresso-500 mb-1 block">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              className="input-field"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="text-xs text-espresso-500 mb-1 block">Mobile Number *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400 text-sm">+91</span>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile"
                className="input-field pl-12"
                autoComplete="tel"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div className="card p-4 space-y-3">
          <h2 className="font-display font-semibold text-espresso-900">Order Summary</h2>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.key} className="flex justify-between text-sm">
                <span className="text-espresso-700 flex-1 pr-2 truncate">
                  {item.name} {String.fromCharCode(215)} {item.quantity}
                  {item.addons?.length > 0 && (
                    <span className="text-espresso-400 text-xs ml-1">
                      (+{item.addons.map(a => a.name).join(', ')})
                    </span>
                  )}
                </span>
                <span className="font-medium text-espresso-900 flex-shrink-0">{String.fromCharCode(8377)}{item.itemTotal}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-foam pt-2 space-y-1">
            <div className="flex justify-between text-sm text-espresso-500">
              <span>Subtotal</span><span>{String.fromCharCode(8377)}{subtotal}</span>
            </div>
            <div className="flex justify-between text-sm text-espresso-500">
              <span>GST (5%)</span><span>{String.fromCharCode(8377)}{tax}</span>
            </div>
            <div className="flex justify-between font-display font-bold text-espresso-900 text-base">
              <span>Total</span><span>{String.fromCharCode(8377)}{total}</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="card p-4 space-y-3">
          <h2 className="font-display font-semibold text-espresso-900">Payment Method</h2>
          <div className="grid gap-3 min-[380px]:grid-cols-2">
            {[
              { id: 'razorpay', icon: <CreditCard size={20} />, label: 'Online Payment', sub: 'UPI, Card, Net Banking' },
              { id: 'cash', icon: <Banknote size={20} />, label: 'Cash at Counter', sub: 'Pay when you leave' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setPaymentMethod(opt.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all
                  ${paymentMethod === opt.id
                    ? 'border-espresso-900 bg-espresso-900 text-cream'
                    : 'border-foam bg-white text-espresso-700 hover:border-espresso-300'
                  }`}
              >
                {opt.icon}
                <span className="font-medium text-sm text-center leading-tight">{opt.label}</span>
                <span className={`text-xs text-center ${paymentMethod === opt.id ? 'text-cream/70' : 'text-espresso-400'}`}>
                  {opt.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3"
          >
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </motion.div>
        )}
      </div>

      {/* Fixed bottom button */}
      <div className="bottom-safe fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-foam shadow-2xl">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={loading}
          className="w-full btn-primary flex items-center justify-center gap-2 py-4"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {paymentMethod === 'razorpay' ? 'Opening Payment...' : 'Placing Order...'}
            </>
          ) : (
            <>
              {paymentMethod === 'razorpay' ? <CreditCard size={18} /> : <Banknote size={18} />}
              {paymentMethod === 'razorpay' ? `Pay ${String.fromCharCode(8377)}${total}` : `Place Order · ${String.fromCharCode(8377)}${total}`}
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
