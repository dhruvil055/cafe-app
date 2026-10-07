import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Banknote, CreditCard, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useCartStore from '../../context/cartStore';
import TableServiceActions from '../../components/table/TableServiceActions';
import { useTenant } from '../../context/TenantContext';
import usePageMeta from '../../hooks/usePageMeta';

const loadRazorpay = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

export default function BillPage() {
  const tenant = useTenant();

  usePageMeta({
    title: 'Table Session Bill & Final Payment',
    description: 'Review your complete dining table bill, itemized orders, taxes, and complete payment smoothly online or with cash at the counter.',
  });

  const { diningSessionToken } = useCartStore();
  const [bill, setBill] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestingCash, setRequestingCash] = useState(false);
  const [payingOnline, setPayingOnline] = useState(false);

  const loadBill = async () => {
    if (!diningSessionToken) { setLoading(false); return; }
    try {
      const response = await api.get(`/session/bill?diningSessionToken=${encodeURIComponent(diningSessionToken)}`);
      setBill(response.data.bill);
      setOrders(response.data.orders || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load your bill');
    } finally {
      setLoading(false);
    }
  };

  const payOnline = async () => {
    setPayingOnline(true);
    try {
      const created = await api.post('/session/bill/payment/create', { diningSessionToken });
      if (!(await loadRazorpay())) throw new Error('Payment gateway failed to load.');
      const checkout = new window.Razorpay({
        key: created.data.keyId,
        amount: created.data.amount,
        currency: created.data.currency || tenant.currency || 'INR',
        name: tenant.name,
        order_id: created.data.razorpayOrderId,
        handler: async () => {
          toast.success('Payment submitted. Waiting for provider confirmation.');
          await loadBill();
        },
      });
      checkout.open();
    } catch (error) {
      toast.error(error.message || 'Final bill payment failed');
    } finally {
      setPayingOnline(false);
    }
  };

  useEffect(() => { loadBill(); }, [diningSessionToken]);
  useEffect(() => {
    if (bill?.status !== 'PAYMENT_PENDING') return undefined;
    const interval = setInterval(loadBill, 5000);
    return () => clearInterval(interval);
  }, [bill?.status, diningSessionToken]);

  const requestCash = async () => {
    setRequestingCash(true);
    try {
      const response = await api.post('/session/bill/cash', { diningSessionToken });
      setBill(response.data.bill);
      toast.success('Cash payment requested. Please see the counter.');
    } catch (error) {
      toast.error(error.message || 'Unable to request cash payment');
    } finally {
      setRequestingCash(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="animate-spin text-brew-600" size={32} />
      </div>
    );
  }

  if (!diningSessionToken || !bill) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="font-display text-2xl font-bold text-espresso-900">
          Scan your table QR code to view your bill.
        </p>
        <p className="text-sm text-stone-600 max-w-sm">
          Your dining session starts automatically when you scan the QR code located on your table.
        </p>
        <Link to="/menu" className="btn-primary min-h-[44px] inline-flex items-center justify-center mt-2 px-6">
          Back to Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center gap-3 border-b border-foam bg-white p-4">
        <Link
          to="/menu"
          aria-label="Back to menu"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-foam text-espresso-700 hover:bg-espresso-50 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display text-xl font-bold text-espresso-900">My Table Bill</h1>
        <button
          type="button"
          onClick={loadBill}
          aria-label="Refresh bill"
          className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-foam text-espresso-700 hover:bg-espresso-50 transition-colors"
          title="Refresh bill"
        >
          <RefreshCw size={16} />
        </button>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-12">
        <TableServiceActions />
        <section className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-espresso-600">Table {bill.tableNumber || ''}</span>
            <span className="rounded-full bg-brew-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brew-700">
              {bill.status}
            </span>
          </div>

          <div className="divide-y divide-foam">
            {orders.map((order) => (
              <div key={order._id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <span className="font-semibold text-espresso-900">{order.orderNumber}</span>
                  <p className="text-xs text-espresso-500">
                    {order.paymentStatus === 'paid'
                      ? 'Paid'
                      : order.paymentMethod === 'cash' && order.cashVerificationStatus === 'pending'
                      ? 'Cash verification pending'
                      : 'Payment due'}
                  </p>
                </div>
                <span className="font-mono font-bold text-espresso-900">₹{order.total}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 border-t border-foam pt-3 text-sm">
            <div className="flex justify-between text-espresso-600">
              <span>Subtotal</span>
              <span>₹{bill.subtotal}</span>
            </div>
            <div className="flex justify-between text-espresso-600">
              <span>GST</span>
              <span>₹{bill.taxTotal}</span>
            </div>
            <div className="flex justify-between font-display text-lg font-bold text-espresso-950 pt-1">
              <span>Total Bill</span>
              <span>₹{bill.grandTotal}</span>
            </div>
            <div className="flex justify-between font-semibold text-brew-700">
              <span>Amount Due</span>
              <span>₹{bill.dueAmount}</span>
            </div>
          </div>
        </section>

        {bill.status === 'CASH_PENDING' ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 leading-relaxed">
            Cash payment requested. Please see the cashier at the counter. Your bill will close after staff confirms payment.
          </div>
        ) : bill.status === 'PAYMENT_PENDING' ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 leading-relaxed">
            Online payment submitted. Waiting for secure payment provider confirmation…
          </div>
        ) : bill.dueAmount > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={payOnline}
              disabled={payingOnline}
              className="btn-primary min-h-[44px] flex items-center justify-center gap-2 py-3.5"
            >
              {payingOnline ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
              <span>Pay ₹{bill.dueAmount} Online</span>
            </button>
            <button
              type="button"
              onClick={requestCash}
              disabled={requestingCash}
              className="btn-secondary min-h-[44px] flex items-center justify-center gap-2 py-3.5"
            >
              {requestingCash ? <Loader2 size={18} className="animate-spin" /> : <Banknote size={18} />}
              <span>Pay Cash at Counter</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-800">
            Bill fully settled. Thank you for dining with us!
          </div>
        )}
      </main>
    </div>
  );
}
