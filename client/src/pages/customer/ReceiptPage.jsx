import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, Loader2, Printer, Share2, Phone, Mail } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useCartStore from '../../context/cartStore';
import { downloadPdf } from '../../utils/download';
import { useTenant } from '../../context/TenantContext';
import usePageMeta from '../../hooks/usePageMeta';

const money = (value, currency = 'INR') => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

function formatInternationalTel(phone) {
  if (!phone) return 'tel:+919876543210';
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.startsWith('+')) return `tel:${clean}`;
  if (clean.length === 10) return `tel:+91${clean}`;
  return `tel:+${clean}`;
}

export default function ReceiptPage() {
  const tenant = useTenant();

  usePageMeta({
    title: 'Tax Invoice & Official Digital Receipt',
    description: 'View and download your official itemized GST tax invoice and digital payment receipt for your recent café dining orders.',
  });

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
      if ((sessionReceipt && !diningSessionToken) || (!sessionReceipt && !accessToken)) {
        setLoading(false);
        return;
      }
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

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const endpoint = sessionReceipt
        ? `/session/bill/receipt?diningSessionToken=${encodeURIComponent(diningSessionToken)}`
        : `/orders/${orderId}/receipt?accessToken=${encodeURIComponent(accessToken)}`;
      const response = await api.get(endpoint, { responseType: 'blob' });
      const slug = (tenant.slug || tenant.name || 'cafe').toLowerCase().replace(/[^a-z0-9]/g, '-');
      downloadPdf(response.data, `${slug}-${receipt.receiptNumber}.pdf`);
    } catch (error) {
      toast.error(error.message || 'Unable to generate receipt. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const shareReceipt = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${receipt.tenant?.name || 'Café'} receipt ${receipt.receiptNumber}`, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Receipt link copied to clipboard.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="animate-spin text-brew-500" size={32} />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream p-8 text-center">
        <p className="font-display text-2xl font-bold text-espresso-900">
          Order receipt not found.
        </p>
        <p className="text-sm text-stone-600 max-w-sm">
          Please check your order confirmation link or return to the menu.
        </p>
        <Link to="/menu" className="btn-primary min-h-[44px] inline-flex items-center justify-center px-6">
          Back to Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="receipt-page min-h-screen bg-[#eee8e2] px-3 py-6 sm:px-6 sm:py-8">
      <div className="receipt-actions mx-auto mb-5 flex max-w-md flex-wrap items-center justify-between gap-2.5">
        <Link
          to="/orders"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-espresso-200 bg-white px-4 py-2 text-sm font-medium text-espresso-700 hover:bg-espresso-50 transition"
        >
          <ArrowLeft size={16} />
          <span>My Orders</span>
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-espresso-200 bg-white px-3.5 py-2 text-sm font-medium text-espresso-700 hover:bg-espresso-50 transition"
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-espresso-900 px-4 py-2 text-sm font-medium text-cream disabled:opacity-60 hover:bg-espresso-800 transition"
          >
            <Download size={16} />
            <span>{downloading ? 'Preparing...' : 'Download'}</span>
          </button>
          <button
            type="button"
            onClick={shareReceipt}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-espresso-200 bg-white px-3.5 py-2 text-sm font-medium text-espresso-700 hover:bg-espresso-50 transition"
          >
            <Share2 size={16} />
            <span>Share</span>
          </button>
        </div>
      </div>

      <article className="receipt-sheet mx-auto max-w-md bg-white px-5 py-7 shadow-xl rounded-2xl sm:px-7 sm:py-8">
        <header className="border-b border-espresso-200 pb-6 text-center">
          <p className="font-display text-3xl font-bold tracking-[0.12em] text-espresso-950">
            {receipt.tenant?.name || 'Café'}
          </p>
          <p className="mt-1 text-xs font-semibold tracking-[0.24em] text-brew-600">
            FINE COFFEE &amp; DINING
          </p>
          <div className="mt-3 text-xs text-espresso-500 space-y-1">
            {receipt.tenant?.address && <p>{receipt.tenant.address}</p>}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {receipt.tenant?.contactPhone && (
                <a href={formatInternationalTel(receipt.tenant.contactPhone)} className="text-brew-700 underline">
                  {receipt.tenant.contactPhone}
                </a>
              )}
              {receipt.tenant?.gstNumber && <span>· GSTIN: {receipt.tenant.gstNumber}</span>}
            </div>
          </div>
          <p className="mt-5 font-mono text-sm font-semibold text-espresso-900 bg-sand-100 py-1 rounded-md inline-block px-3">
            {receipt.receiptNumber}
          </p>
        </header>

        <section className="grid gap-4 border-b border-espresso-200 py-6 text-sm sm:grid-cols-2">
          <div className="space-y-2">
            <Info label="Order" value={receipt.orderNumbers.join(', ')} />
            <Info label="Table" value={String(receipt.tableNumber || '-').padStart(2, '0')} />
            <Info label="Order status" value={receipt.orderStatus} />
          </div>
          <div className="space-y-2">
            <Info label="Date" value={receipt.date} />
            <Info label="Time" value={receipt.time} />
            {receipt.customer && <Info label="Customer" value={receipt.customer} />}
            {receipt.phone && <Info label="Phone" value={receipt.phone} />}
          </div>
        </section>

        <section className="py-6 overflow-x-auto">
          <div className="grid grid-cols-[1fr_2.5rem_5rem] border-b border-espresso-200 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-espresso-500">
            <span>Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="divide-y divide-espresso-100">
            {receipt.items.map((item, index) => (
              <div key={`${item.orderNumber}-${item.name}-${index}`} className="grid grid-cols-[1fr_2.5rem_5rem] gap-2 py-3 text-sm">
                <div>
                  <p className="font-semibold text-espresso-900">{item.name}</p>
                  {item.variant && <p className="mt-1 text-xs text-espresso-500">+ Size: {item.variant.name}</p>}
                  {item.addons?.map((addon) => <p key={addon.name} className="text-xs text-espresso-500">+ Add-on: {addon.name}</p>)}
                  {item.specialInstructions && <p className="text-xs italic text-espresso-500">Note: {item.specialInstructions}</p>}
                </div>
                <span className="text-center text-espresso-700 font-medium">{item.quantity}</span>
                <span className="text-right font-medium text-espresso-900">{money(item.itemTotal, receipt.tenant?.currency)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ml-auto max-w-sm border-t border-espresso-200 pt-4 text-sm">
          <SummaryRow label="Subtotal" value={receipt.subtotal} currency={receipt.tenant?.currency} />
          {receipt.discount > 0 && <SummaryRow label="Discount" value={-receipt.discount} currency={receipt.tenant?.currency} />}
          <SummaryRow label="Taxable amount" value={receipt.taxableAmount} currency={receipt.tenant?.currency} />
          {receipt.taxRows.map((tax) => <SummaryRow key={tax.label} label={tax.label} value={tax.amount} currency={receipt.tenant?.currency} />)}
          <div className="mt-3 flex items-center justify-between border-t-2 border-espresso-900 pt-3 text-lg font-bold text-espresso-950">
            <span>Total amount</span>
            <span>{money(receipt.grandTotal, receipt.tenant?.currency)}</span>
          </div>
        </section>

        <section className="mt-7 grid gap-4 border-y border-espresso-200 py-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-espresso-500">Payment method</p>
            <p className="mt-1 font-semibold text-espresso-900">{receipt.paymentMethod}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-espresso-500">Payment status</p>
            <p className={`mt-1 font-semibold ${receipt.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-700'}`}>
              {receipt.paymentStatus}
            </p>
          </div>
          {receipt.transactionId && (
            <div className="sm:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-espresso-500">Transaction ID</p>
              <p className="mt-1 break-all font-mono text-xs text-espresso-700">{receipt.transactionId}</p>
            </div>
          )}
        </section>

        {receipt.paymentStatus !== 'PAID' && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span>Payment pending - receipt will be finalized after payment confirmation.</span>
          </div>
        )}

        <footer className="mt-8 border-t border-espresso-200 pt-6 text-center">
          <p className="font-display text-lg font-semibold text-brew-700">
            Thank you for visiting {receipt.tenant?.name || 'our café'}!
          </p>
          <p className="mt-1 text-sm text-espresso-500">Please visit again. Have a wonderful day!</p>
          {receipt.tenant?.contactEmail && (
            <a href={`mailto:${receipt.tenant.contactEmail}`} className="mt-3 inline-block text-xs text-brew-700 underline">
              {receipt.tenant.contactEmail}
            </a>
          )}
        </footer>
      </article>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-espresso-500">{label}</span>
      <span className="text-right font-medium text-espresso-900">{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, currency }) {
  return (
    <div className="flex justify-between gap-6 py-1 text-espresso-600">
      <span>{label}</span>
      <span className="font-medium text-espresso-900">{money(value, currency)}</span>
    </div>
  );
}
