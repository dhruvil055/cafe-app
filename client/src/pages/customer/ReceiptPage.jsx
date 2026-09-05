import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, Loader2, Printer, Share2 } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useCartStore from '../../context/cartStore';
import { downloadPdf } from '../../utils/download';

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

export default function ReceiptPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('accessToken') || '';
  const { diningSessionToken } = useCartStore();
  const sessionReceipt = !orderId;
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const loadReceipt = async () => {
      if ((sessionReceipt && !diningSessionToken) || (!sessionReceipt && !accessToken)) { setLoading(false); return; }
      try {
        const endpoint = sessionReceipt
          ? `/session/bill/receipt-data?diningSessionToken=${encodeURIComponent(diningSessionToken)}`
          : `/orders/${orderId}/receipt-data?accessToken=${encodeURIComponent(accessToken)}`;
        const response = await api.get(endpoint);
        setReceipt(response.data.receipt);
      } catch (error) {
        toast.error(error.message || 'Unable to load receipt. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadReceipt();
  }, [accessToken, diningSessionToken, orderId, sessionReceipt]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const endpoint = sessionReceipt
        ? `/session/bill/receipt?diningSessionToken=${encodeURIComponent(diningSessionToken)}`
        : `/orders/${orderId}/receipt?accessToken=${encodeURIComponent(accessToken)}`;
      const response = await api.get(endpoint, { responseType: 'blob' });
      downloadPdf(response.data, `brewhaus-${receipt.receiptNumber}.pdf`);
    } catch (error) {
      toast.error(error.message || 'Unable to generate receipt. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const shareReceipt = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `Brewhaus receipt ${receipt.receiptNumber}`, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Receipt link copied.');
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-cream"><Loader2 className="animate-spin text-brew-500" /></div>;
  if (!receipt) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream p-8 text-center"><p className="font-display text-xl text-espresso-900">Order not found. Please check the receipt number.</p><Link to="/menu" className="btn-primary">Back to Menu</Link></div>;

  return (
    <div className="receipt-page min-h-screen bg-[#eee8e2] px-3 py-4 sm:px-6 sm:py-8">
      <div className="receipt-actions mx-auto mb-4 flex max-w-md flex-wrap items-center justify-between gap-2">
        <Link to="/menu" className="inline-flex items-center gap-2 rounded-full border border-espresso-200 bg-white px-3 py-2 text-sm font-medium text-espresso-700"><ArrowLeft size={16} /> Back to Order</Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-espresso-200 bg-white px-3 py-2 text-sm font-medium text-espresso-700"><Printer size={16} /> Print Receipt</button>
          <button onClick={downloadPdf} disabled={downloading} className="inline-flex items-center gap-2 rounded-full bg-espresso-900 px-3 py-2 text-sm font-medium text-cream disabled:opacity-60"><Download size={16} /> {downloading ? 'Preparing...' : 'Download Receipt'}</button>
          <button onClick={shareReceipt} className="inline-flex items-center gap-2 rounded-full border border-espresso-200 bg-white px-3 py-2 text-sm font-medium text-espresso-700"><Share2 size={16} /> Share</button>
        </div>
      </div>

      <article className="receipt-sheet mx-auto max-w-md bg-white px-5 py-7 shadow-xl sm:px-7 sm:py-8">
        <header className="border-b border-espresso-200 pb-6 text-center">
          <p className="font-display text-3xl font-bold tracking-[0.12em] text-espresso-950">BREWHAUS</p>
          <p className="mt-1 text-xs font-semibold tracking-[0.24em] text-brew-600">FINE COFFEE & DINING</p>
          <p className="mt-3 text-xs text-espresso-500">Surat, Gujarat 395001 | +91 98765 43210</p>
          <p className="mt-5 font-mono text-sm font-semibold text-espresso-900">{receipt.receiptNumber}</p>
        </header>

        <section className="grid gap-4 border-b border-espresso-200 py-6 text-sm sm:grid-cols-2">
          <div className="space-y-2"><Info label="Order" value={receipt.orderNumbers.join(', ')} /><Info label="Table" value={String(receipt.tableNumber || '-').padStart(2, '0')} /><Info label="Order status" value={receipt.orderStatus} /></div>
          <div className="space-y-2"><Info label="Date" value={receipt.date} /><Info label="Time" value={receipt.time} />{receipt.customer && <Info label="Customer" value={receipt.customer} />}{receipt.phone && <Info label="Phone" value={receipt.phone} />}</div>
        </section>

        <section className="py-6">
          <div className="grid grid-cols-[1fr_2.5rem_5rem] border-b border-espresso-200 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-espresso-500"><span>Item</span><span className="text-center">Qty</span><span className="text-right">Amount</span></div>
          <div className="divide-y divide-espresso-100">
            {receipt.items.map((item, index) => <div key={`${item.orderNumber}-${item.name}-${index}`} className="grid grid-cols-[1fr_2.5rem_5rem] gap-2 py-3 text-sm"><div><p className="font-semibold text-espresso-900">{item.name}</p>{item.variant && <p className="mt-1 text-xs text-espresso-500">+ Size: {item.variant.name}</p>}{item.addons?.map((addon) => <p key={addon.name} className="text-xs text-espresso-500">+ Add-on: {addon.name}</p>)}{item.specialInstructions && <p className="text-xs italic text-espresso-500">Note: {item.specialInstructions}</p>}</div><span className="text-center text-espresso-700">{item.quantity}</span><span className="text-right font-medium text-espresso-900">{money(item.itemTotal)}</span></div>)}
          </div>
        </section>

        <section className="ml-auto max-w-sm border-t border-espresso-200 pt-4 text-sm">
          <SummaryRow label="Subtotal" value={receipt.subtotal} />
          {receipt.discount > 0 && <SummaryRow label="Discount" value={-receipt.discount} />}
          <SummaryRow label="Taxable amount" value={receipt.taxableAmount} />
          {receipt.taxRows.map((tax) => <SummaryRow key={tax.label} label={tax.label} value={tax.amount} />)}
          <div className="mt-3 flex items-center justify-between border-t-2 border-espresso-900 pt-3 text-lg font-bold text-espresso-950"><span>Total amount</span><span>{money(receipt.grandTotal)}</span></div>
        </section>

        <section className="mt-7 grid gap-4 border-y border-espresso-200 py-5 sm:grid-cols-2">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-espresso-500">Payment method</p><p className="mt-1 font-semibold text-espresso-900">{receipt.paymentMethod}</p></div>
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-espresso-500">Payment status</p><p className={`mt-1 font-semibold ${receipt.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-700'}`}>{receipt.paymentStatus}</p></div>
          {receipt.transactionId && <div className="sm:col-span-2"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-espresso-500">Transaction ID</p><p className="mt-1 break-all font-mono text-xs text-espresso-700">{receipt.transactionId}</p></div>}
        </section>

        {receipt.paymentStatus !== 'PAID' && <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />Payment pending - receipt will be finalized after payment confirmation.</div>}
        <footer className="mt-8 border-t border-espresso-200 pt-6 text-center"><p className="font-display text-lg font-semibold text-brew-700">Thank you for visiting Brewhaus!</p><p className="mt-1 text-sm text-espresso-500">Please visit again. Have a great day!</p><p className="mt-3 text-xs text-espresso-400">www.brewhauscafe.com</p></footer>
      </article>
    </div>
  );
}

function Info({ label, value }) { return <div className="flex justify-between gap-4"><span className="text-espresso-500">{label}</span><span className="text-right font-medium text-espresso-900">{value}</span></div>; }
function SummaryRow({ label, value }) { return <div className="flex justify-between gap-6 py-1 text-espresso-600"><span>{label}</span><span className="font-medium text-espresso-900">{money(value)}</span></div>; }
