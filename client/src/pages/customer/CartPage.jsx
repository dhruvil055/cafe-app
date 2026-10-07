import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, QrCode, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore, { cartItemCount } from '../../context/cartStore';
import { useTenant } from '../../context/TenantContext';
import { formatMoney } from '../../utils/money';
import QrScannerModal from '../../components/ui/QrScannerModal';
import usePageMeta from '../../hooks/usePageMeta';

const FALLBACK_IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" fill="%23f5ebe1"><rect width="80" height="80" rx="12"/><text x="50%" y="54%" text-anchor="middle" font-size="28" fill="%23846358">☕</text></svg>';

export default function CartPage() {
  const tenant = useTenant();
  const navigate = useNavigate();
  const { items, tableNumber, removeItem, updateQuantity, clearCart, isScannerOpen, openScanner, closeScanner } = useCartStore();
  const itemCount = useCartStore(cartItemCount);

  usePageMeta(
    'Your Order Cart & Selected Items',
    'Review the artisanal coffee beverages, gourmet treats, and table orders currently in your café cart before seamless digital checkout.'
  );

  const subtotal = items.reduce((s, i) => s + i.itemTotal, 0);
  const tax = Number((subtotal * Number(tenant.taxRate || 0) / 100).toFixed(2));
  const total = subtotal + tax;

  const handleProceedCheckout = () => {
    if (!tableNumber) {
      toast.error('Please scan your table QR code to place your order.');
      openScanner();
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-foam bg-white">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-[44px] min-w-[44px] rounded-full border border-foam flex items-center justify-center text-espresso-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brew-500"
            aria-label="Go back to previous page"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <h1 className="font-display text-xl font-bold text-espresso-900">Your Cart</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 max-w-md mx-auto text-center">
          <span className="text-6xl" role="img" aria-label="Empty shopping cart">🛒</span>
          <h2 className="font-display text-2xl font-bold text-espresso-900">Cart is empty</h2>
          <p className="text-espresso-500 text-sm">Browse our artisanal menu and add your favorite beverages and snacks!</p>
          <Link
            to="/menu"
            className="btn-primary mt-2 min-h-[44px] inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold"
          >
            Browse Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-foam bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-[44px] min-w-[44px] rounded-full border border-foam flex items-center justify-center text-espresso-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brew-500"
            aria-label="Go back to previous page"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <h1 className="font-display text-xl font-bold text-espresso-900">Your Cart</h1>
          {itemCount > 0 && (
            <span className="bg-brew-500 text-white text-xs font-bold px-2 py-0.5 rounded-full" aria-label={`${itemCount} items in cart`}>
              {itemCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tableNumber ? (
            <span className="text-xs text-espresso-700 font-semibold bg-foam px-2.5 py-1 rounded-full">
              Table {String(tableNumber).padStart(2, '0')}
            </span>
          ) : (
            <button
              type="button"
              onClick={openScanner}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-brew-600 px-3.5 py-2 text-xs font-bold uppercase text-white shadow-sm hover:bg-brew-700 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-brew-500"
            >
              <QrCode size={14} aria-hidden="true" />
              <span>Scan Table</span>
            </button>
          )}
          <button
            type="button"
            onClick={clearCart}
            className="min-h-[44px] inline-flex items-center px-3 py-1 text-xs text-red-500 font-semibold hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 rounded-lg"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* No table warning */}
      {!tableNumber && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-3" role="status" aria-live="polite">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-700 flex-shrink-0" aria-hidden="true" />
            <p className="text-amber-900 text-xs sm:text-sm font-medium">
              Please scan your table QR code to place your order.
            </p>
          </div>
          <button
            type="button"
            onClick={openScanner}
            className="min-h-[44px] inline-flex items-center rounded-full bg-brew-600 px-4 py-2 text-xs font-bold uppercase text-white shadow-sm hover:bg-brew-700 transition active:scale-95 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brew-500"
          >
            Scan QR
          </button>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto pb-52 sm:pb-48">
        <div className="p-4 space-y-3 max-w-2xl mx-auto w-full">
          <AnimatePresence>
            {items.map(item => (
              <motion.div
                key={item.key}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-2xl p-4 border border-foam shadow-sm flex gap-3 items-center"
              >
                <img
                  src={item.image || FALLBACK_IMAGE}
                  alt={item.name}
                  width="80"
                  height="80"
                  loading="lazy"
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-stone-100"
                  onError={e => { e.currentTarget.src = FALLBACK_IMAGE; }}
                />

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-espresso-900 text-sm truncate">{item.name}</h3>

                  {item.variant && (
                    <p className="text-xs text-espresso-500 mt-0.5">Size: {item.variant.name}</p>
                  )}

                  {item.addons?.length > 0 && (
                    <p className="text-xs text-espresso-400 mt-0.5">
                      +{item.addons.map(a => a.name).join(', ')}
                    </p>
                  )}

                  {item.specialInstructions && (
                    <p className="text-xs text-espresso-400 italic mt-0.5 truncate">
                      &quot;{item.specialInstructions}&quot;
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                    <div className="flex items-center bg-cream rounded-full p-0.5 border border-foam">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-espresso-600 hover:text-espresso-900 hover:bg-stone-200/50 transition-colors focus:outline-none focus:ring-2 focus:ring-brew-500"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <span className="text-xs font-bold text-espresso-900 min-w-[20px] text-center px-1">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-espresso-600 hover:text-espresso-900 hover:bg-stone-200/50 transition-colors focus:outline-none focus:ring-2 focus:ring-brew-500"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="price-tag text-sm font-semibold">
                        {formatMoney(item.itemTotal, tenant.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        className="min-h-[44px] min-w-[44px] rounded-full text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Bill summary + checkout */}
      <div className="bottom-safe fixed bottom-0 left-0 right-0 bg-white border-t border-foam p-4 space-y-3 shadow-2xl z-10">
        <div className="max-w-2xl mx-auto w-full space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-espresso-600">
              <span>Subtotal</span>
              <span className="price-tag text-sm">{formatMoney(subtotal, tenant.currency)}</span>
            </div>
            <div className="flex justify-between text-sm text-espresso-600">
              <span>GST ({tenant.taxRate}%)</span>
              <span className="price-tag text-sm">{formatMoney(tax, tenant.currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-espresso-900 text-base pt-1 border-t border-foam">
              <span>Total</span>
              <span className="price-tag text-base">{formatMoney(total, tenant.currency)}</span>
            </div>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={handleProceedCheckout}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-semibold text-sm transition-all btn-primary focus:outline-none focus:ring-2 focus:ring-brew-500"
          >
            <ShoppingBag size={18} aria-hidden="true" />
            Proceed to Checkout
          </motion.button>
        </div>
      </div>

      {/* QR Scanner modal if customer didn't scan table before checkout */}
      <AnimatePresence>
        {isScannerOpen && (
          <QrScannerModal
            onClose={closeScanner}
            onTableFound={(num) => {
              closeScanner();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
