import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  QrCode,
  AlertCircle,
  CheckCircle2,
  UtensilsCrossed,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore, { cartItemCount } from '../../context/cartStore';
import { useTenant } from '../../context/TenantContext';
import { formatMoney } from '../../utils/money';
import QrScannerModal from '../../components/ui/QrScannerModal';
import usePageMeta from '../../hooks/usePageMeta';

const FALLBACK_IMAGE = '/images/coffee-placeholder.svg';

export default function CartPage() {
  const tenant = useTenant();
  const navigate = useNavigate();
  const { items, tableNumber, removeItem, updateQuantity, clearCart, isScannerOpen, openScanner, closeScanner } = useCartStore();
  const itemCount = useCartStore(cartItemCount);

  usePageMeta(
    `Your Order Cart (${itemCount}) — ${tenant.name || 'Café'}`,
    'Review your selected dishes, beverages, and order items before table checkout.'
  );

  const subtotal = items.reduce((s, i) => s + i.itemTotal, 0);
  const tax = Number(((subtotal * Number(tenant.taxRate || 0)) / 100).toFixed(2));
  const total = (subtotal + tax).toFixed(2);

  const handleProceedCheckout = () => {
    if (!tableNumber) {
      toast.error('Please scan your table QR code to proceed with your order.');
      openScanner();
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-cream/90 flex flex-col">
        {/* Simple Top Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-foam bg-white">
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="min-h-[40px] min-w-[40px] rounded-full border border-espresso-200/80 flex items-center justify-center text-espresso-700 hover:bg-espresso-50 transition active:scale-95"
            aria-label="Back to Menu"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-lg font-bold text-espresso-950">Your Cart</h1>
        </div>

        {/* Empty State Body */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-foam flex items-center justify-center text-4xl mb-4 shadow-inner">
            ☕
          </div>
          <h2 className="font-display text-2xl font-bold text-espresso-950">Your cart is empty</h2>
          <p className="text-espresso-500 text-sm mt-2 leading-relaxed">
            Discover our freshly brewed specialty coffees, artisanal bites, and comforting meals.
          </p>
          <Link
            to="/menu"
            className="mt-6 btn-primary min-h-[46px] px-8 text-xs font-bold uppercase tracking-[0.16em]"
          >
            Explore Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream/90 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-foam/90 bg-white/95 backdrop-blur-md shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="min-h-[40px] min-w-[40px] rounded-full border border-espresso-200/80 flex items-center justify-center text-espresso-800 hover:bg-espresso-50 transition active:scale-95"
            aria-label="Back to Menu"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg sm:text-xl font-bold text-espresso-950 leading-none">
                Your Order
              </h1>
              <span className="flex h-5 items-center justify-center rounded-full bg-brew-500 px-2 text-[11px] font-bold text-white">
                {itemCount}
              </span>
            </div>
            <p className="text-[11px] text-espresso-500 mt-0.5">{tenant.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearCart}
            className="min-h-[36px] px-3 py-1 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition"
          >
            Clear All
          </button>
        </div>
      </header>

      {/* Main Content Layout (2-Column on Desktop) */}
      <main className="flex-1 mx-auto max-w-6xl w-full p-4 sm:p-6 lg:p-8 pb-36 lg:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Table Status & Cart Items */}
          <div className="lg:col-span-7 space-y-4">
            {/* Table Identification Card */}
            <div className={`rounded-2xl p-4 border transition-all ${
              tableNumber
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 shadow-2xs'
                : 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold ${
                    tableNumber
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-500 text-white'
                  }`}>
                    {tableNumber ? (
                      <span className="font-display text-base font-bold">
                        {String(tableNumber).padStart(2, '0')}
                      </span>
                    ) : (
                      <QrCode size={20} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-75">
                      {tableNumber ? 'Connected Table' : 'Table Required to Order'}
                    </p>
                    <p className="font-display text-base font-bold">
                      {tableNumber ? `Table ${String(tableNumber).padStart(2, '0')}` : 'Please scan your table QR'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openScanner}
                  className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition active:scale-95 shadow-xs ${
                    tableNumber
                      ? 'bg-white hover:bg-emerald-100/60 text-emerald-900 border border-emerald-200'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {tableNumber ? 'Switch Table' : 'Scan QR'}
                </button>
              </div>
            </div>

            {/* Items Card List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-espresso-500">
                <span>Selected Items ({items.length})</span>
                <Link to="/menu" className="text-brew-700 hover:text-espresso-950 font-semibold transition">
                  + Add more items
                </Link>
              </div>

              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <motion.article
                    key={item.key}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="card p-3.5 sm:p-4 flex gap-3.5 items-center bg-white shadow-2xs hover:shadow-xs transition-shadow"
                  >
                    {/* Item Thumbnail */}
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-foam">
                      <img
                        src={item.image || FALLBACK_IMAGE}
                        alt={item.name}
                        width="80"
                        height="80"
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                      />
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-display text-base font-bold text-espresso-950 leading-tight truncate">
                          {item.name}
                        </h2>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          aria-label={`Remove ${item.name} from cart`}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-espresso-400 hover:text-red-600 transition rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Variant and Add-ons */}
                      <div className="mt-1 flex flex-wrap gap-1 text-xs">
                        {item.variant && (
                          <span className="rounded-md bg-espresso-100/70 px-1.5 py-0.5 text-[11px] font-semibold text-espresso-800">
                            Size: {item.variant.name}
                          </span>
                        )}
                        {item.addons?.length > 0 && (
                          <span className="text-espresso-500 text-[11px]">
                            +{item.addons.map(a => a.name).join(', ')}
                          </span>
                        )}
                      </div>

                      {item.specialInstructions && (
                        <p className="mt-1 text-[11px] italic text-brew-700 truncate">
                          &ldquo;{item.specialInstructions}&rdquo;
                        </p>
                      )}

                      {/* Quantity Stepper & Price */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center rounded-xl bg-cream border border-espresso-200/80 p-0.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.key, item.quantity - 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-espresso-700 hover:bg-espresso-900 hover:text-white transition active:scale-90"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus size={13} strokeWidth={2.5} />
                          </button>
                          <span className="w-7 text-center font-mono text-xs font-bold text-espresso-950">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.key, item.quantity + 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-espresso-700 hover:bg-espresso-900 hover:text-white transition active:scale-90"
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus size={13} strokeWidth={2.5} />
                          </button>
                        </div>

                        <span className="price-tag text-base font-bold text-espresso-950">
                          {formatMoney(item.itemTotal, tenant.currency)}
                        </span>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Column: Order Bill Summary & Checkout Action */}
          <div className="lg:col-span-5">
            <div className="card p-5 sm:p-6 space-y-5 bg-white shadow-xs sticky top-24">
              <h2 className="font-display text-lg font-bold text-espresso-950 border-b border-foam pb-3">
                Order Summary
              </h2>

              {/* Cost Breakdown */}
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-espresso-600">
                  <span>Items Subtotal</span>
                  <span className="price-tag text-sm">{formatMoney(subtotal, tenant.currency)}</span>
                </div>
                <div className="flex justify-between text-espresso-600">
                  <span>Taxes &amp; GST ({tenant.taxRate}%)</span>
                  <span className="price-tag text-sm">{formatMoney(tax, tenant.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-espresso-200 pt-3 text-base font-bold text-espresso-950">
                  <span>Total Payable</span>
                  <span className="price-tag text-xl text-espresso-950">{formatMoney(total, tenant.currency)}</span>
                </div>
              </div>

              {/* Trust Badge */}
              <div className="flex items-center gap-2 rounded-xl bg-foam/60 p-3 text-xs text-espresso-600">
                <ShieldCheck size={16} className="text-emerald-700 shrink-0" />
                <span>Orders are prepared fresh by {tenant.name} upon placement.</span>
              </div>

              {/* Checkout Button */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={handleProceedCheckout}
                className="w-full min-h-[50px] btn-primary flex items-center justify-between px-6 py-3.5 text-sm font-bold shadow-md uppercase tracking-wider"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} />
                  <span>Proceed to Checkout</span>
                </div>
                <span className="price-tag text-base text-brew-200">{formatMoney(total, tenant.currency)}</span>
              </motion.button>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Bottom Bar for Mobile Viewports */}
      <div className="lg:hidden bottom-safe fixed bottom-0 left-0 right-0 p-3.5 bg-white/95 backdrop-blur-xl border-t border-foam shadow-2xl z-20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-espresso-500 uppercase tracking-wider font-semibold">Total Amount</p>
            <p className="price-tag text-lg font-bold text-espresso-950">{formatMoney(total, tenant.currency)}</p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={handleProceedCheckout}
            className="flex-1 min-h-[48px] btn-primary flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <ShoppingBag size={16} />
            <span>Checkout ({itemCount})</span>
          </motion.button>
        </div>
      </div>

      {/* Table QR Scanner Modal */}
      <AnimatePresence>
        {isScannerOpen && (
          <QrScannerModal
            onClose={closeScanner}
            onTableFound={(num, token) => {
              closeScanner();
              if (token) {
                navigate(`/cart?tableToken=${encodeURIComponent(token)}`, { replace: true });
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
