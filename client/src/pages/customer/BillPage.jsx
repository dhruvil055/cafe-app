import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Banknote, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useCartStore from '../../context/cartStore';

export default function BillPage() {
  const { diningSessionToken } = useCartStore();
  const [bill, setBill] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestingCash, setRequestingCash] = useState(false);

  const loadBill = async () => {
    if (!diningSessionToken) {
      setLoading(false);
      return;
    }
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

  useEffect(() => { loadBill(); }, [diningSessionToken]);

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

  if (loading) return <div className="min-h-screen bg-cream flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (!diningSessionToken || !bill) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="font-display text-xl text-espresso-900">Start a cafe session to view your bill.</p>
        <Link to="/menu" className="btn-primary">Back to Menu</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center gap-3 border-b border-foam bg-white p-4">
        <Link to="/menu" className="flex h-9 w-9 items-center justify-center rounded-full border border-foam"><ArrowLeft size={18} /></Link>
        <h1 className="font-display text-xl font-bold text-espresso-900">My Bill</h1>
        <button onClick={loadBill} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-foam" title="Refresh bill"><RefreshCw size={16} /></button>
      </header>

      <main className="space-y-4 p-4 pb-10">
        <section className="card space-y-3 p-4">
          <div className="flex items-center justify-between"><span className="text-sm text-espresso-500">Current dining session</span><span className="text-xs font-semibold uppercase text-brew-600">{bill.status}</span></div>
          {orders.map((order) => (
            <div key={order._id} className="flex items-center justify-between border-t border-foam pt-3 text-sm">
              <span className="text-espresso-700">{order.orderNumber}</span>
              <span className="text-espresso-500">{order.paymentStatus === 'paid' ? 'Paid' : 'Due'}</span>
              <span className="font-medium text-espresso-900">₹{order.total}</span>
            </div>
          ))}
          <div className="space-y-1 border-t border-foam pt-3 text-sm">
            <div className="flex justify-between text-espresso-500"><span>Subtotal</span><span>₹{bill.subtotal}</span></div>
            <div className="flex justify-between text-espresso-500"><span>GST</span><span>₹{bill.taxTotal}</span></div>
            <div className="flex justify-between font-display text-base font-bold text-espresso-900"><span>Total</span><span>₹{bill.grandTotal}</span></div>
            <div className="flex justify-between font-semibold text-brew-700"><span>Current due</span><span>₹{bill.dueAmount}</span></div>
          </div>
        </section>

        {bill.status === 'CASH_PENDING' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Cash requested. Please show this bill to the cashier. Your session will close after staff confirms payment.</div>
        ) : bill.dueAmount > 0 ? (
          <button onClick={requestCash} disabled={requestingCash} className="btn-primary flex w-full items-center justify-center gap-2 py-4">
            {requestingCash ? <Loader2 size={18} className="animate-spin" /> : <Banknote size={18} />} Request Cash Payment
          </button>
        ) : (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm text-green-700">Your bill is paid.</div>
        )}
      </main>
    </div>
  );
}