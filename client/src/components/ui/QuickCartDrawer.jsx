import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  UtensilsCrossed,
} from 'lucide-react';
import useCartStore from '../../context/cartStore';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&q=80';

export default function QuickCartDrawer() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    items,
    tableNumber,
    isQuickCartOpen,
    lastAddedItemKey,
    closeQuickCart,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCartStore();

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.itemTotal, 0);
  const tax = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + tax;

  // Close drawer if user navigates to /cart or /checkout
  useEffect(() => {
    if (location.pathname === '/cart' || location.pathname === '/checkout') {
      closeQuickCart();
    }
  }, [location.pathname, closeQuickCart]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isQuickCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isQuickCartOpen]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isQuickCartOpen) {
        closeQuickCart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickCartOpen, closeQuickCart]);

  return (
    <AnimatePresence>
      {isQuickCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={closeQuickCart}
            className="absolute inset-0 bg-espresso-950/70 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative flex h-full w-screen max-w-md flex-col bg-cream text-espresso-900 shadow-2xl border-l border-foam"
              aria-label="Quick View Cart"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-foam bg-white px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brew-100 text-brew-700">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-xl font-bold text-espresso-950 sm:text-2xl">
                        Your Cart
                      </h2>
                      {itemCount > 0 && (
                        <span className="rounded-full bg-brew-500 px-2 py-0.5 text-[11px] font-bold text-white">
                          {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </span>
                      )}
                    </div>
                    {tableNumber ? (
                      <p className="text-xs font-semibold uppercase tracking-wider text-brew-600">
                        Dining at Table {String(tableNumber).padStart(2, '0')}
                      </p>
                    ) : (
                      <p className="text-xs text-espresso-500">Freshly handcrafted for you</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeQuickCart}
                  aria-label="Close cart"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-foam bg-cream text-espresso-700 transition hover:bg-espresso-900 hover:text-cream active:scale-90"
                >
                  <X size={17} />
                </button>
              </div>

              {/* Freshly added item notice */}
              {lastAddedItemKey && items.some((i) => i.key === lastAddedItemKey) && (
                <div className="flex items-center gap-2 border-b border-brew-200 bg-brew-50 px-5 py-2.5 text-xs font-semibold text-brew-800">
                  <CheckCircle2 size={15} className="text-green-600 flex-shrink-0" />
                  <span>Item updated in your order!</span>
                </div>
              )}

              {/* Body / Items List */}
              <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                {items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-foam text-espresso-400">
                      <UtensilsCrossed size={36} />
                    </div>
                    <h3 className="mt-4 font-display text-2xl font-bold text-espresso-900">
                      Your cart is empty
                    </h3>
                    <p className="mt-2 max-w-xs text-sm text-espresso-500">
                      Explore our handcrafted brews, comforting meals, and pastries.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        closeQuickCart();
                        navigate('/menu');
                      }}
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-espresso-900 px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-cream transition hover:bg-brew-600 active:scale-95"
                    >
                      Browse Menu <ArrowRight size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between pb-1 text-xs text-espresso-500">
                      <span>Order Items</span>
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-xs font-medium text-red-600 hover:text-red-700 transition"
                      >
                        Clear all
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {items.map((item) => {
                        const isRecentlyAdded = item.key === lastAddedItemKey;
                        return (
                          <motion.article
                            key={item.key}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`relative flex gap-3.5 rounded-2xl border p-3.5 transition-all ${
                              isRecentlyAdded
                                ? 'border-brew-300 bg-white shadow-md ring-1 ring-brew-200'
                                : 'border-foam bg-white shadow-sm hover:border-espresso-200'
                            }`}
                          >
                            {/* Product Thumbnail */}
                            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-foam">
                              <img
                                src={item.image || PLACEHOLDER}
                                alt={item.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.target.src = PLACEHOLDER;
                                }}
                              />
                            </div>

                            {/* Info & Actions */}
                            <div className="flex flex-1 flex-col justify-between min-w-0">
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-display text-base font-bold leading-tight text-espresso-950 line-clamp-1">
                                    {item.name}
                                  </h4>
                                  <button
                                    type="button"
                                    onClick={() => removeItem(item.key)}
                                    aria-label={`Remove ${item.name}`}
                                    className="text-espresso-400 hover:text-red-600 transition p-0.5"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>

                                {item.variant && (
                                  <span className="mt-0.5 inline-block rounded-md bg-espresso-50 px-1.5 py-0.5 text-[10px] font-semibold text-espresso-700">
                                    {item.variant.name}
                                  </span>
                                )}

                                {item.addons?.length > 0 && (
                                  <p className="mt-1 text-[11px] text-espresso-500 line-clamp-1">
                                    + {item.addons.map((a) => a.name).join(', ')}
                                  </p>
                                )}

                                {item.specialInstructions && (
                                  <p className="mt-0.5 text-[10px] italic text-brew-700 line-clamp-1">
                                    “{item.specialInstructions}”
                                  </p>
                                )}
                              </div>

                              <div className="mt-2.5 flex items-center justify-between">
                                {/* Quantity Controls */}
                                <div className="flex items-center gap-2 rounded-xl border border-espresso-100 bg-cream px-2 py-1">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.key, item.quantity - 1)}
                                    aria-label="Decrease quantity"
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-espresso-700 hover:bg-espresso-900 hover:text-cream transition active:scale-90"
                                  >
                                    <Minus size={11} />
                                  </button>
                                  <span className="w-5 text-center text-xs font-bold text-espresso-900">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.key, item.quantity + 1)}
                                    aria-label="Increase quantity"
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-espresso-700 hover:bg-espresso-900 hover:text-cream transition active:scale-90"
                                  >
                                    <Plus size={11} />
                                  </button>
                                </div>

                                {/* Total Price for Item */}
                                <div className="text-right">
                                  <span className="price-tag text-base font-bold text-espresso-950">
                                    ₹{item.itemTotal}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.article>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Footer / Checkout Actions */}
              {items.length > 0 && (
                <div className="border-t border-foam bg-white p-5 sm:p-6 shadow-[0_-10px_25px_rgba(0,0,0,0.03)]">
                  {/* Bill breakdown */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-espresso-600">
                      <span>Subtotal</span>
                      <span className="font-semibold text-espresso-900">₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-espresso-600">
                      <span>Taxes & GST (5%)</span>
                      <span className="font-semibold text-espresso-900">₹{tax}</span>
                    </div>
                    <div className="flex justify-between border-t border-dashed border-espresso-200 pt-2 text-sm font-bold text-espresso-950">
                      <span>Total Amount</span>
                      <span className="font-display text-xl text-espresso-950">₹{grandTotal}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-5 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        closeQuickCart();
                        navigate('/checkout');
                      }}
                      className="inline-flex w-full items-center justify-between rounded-2xl bg-espresso-900 px-6 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-cream shadow-md transition-all hover:bg-espresso-800 active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2">
                        <ShoppingBag size={15} className="text-brew-300" />
                        <span>Proceed to Checkout</span>
                      </div>
                      <span className="font-display text-base text-brew-200">₹{grandTotal}</span>
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          closeQuickCart();
                          navigate('/cart');
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-espresso-300 bg-cream py-2.5 text-xs font-semibold text-espresso-900 transition hover:bg-espresso-100"
                      >
                        <span>View Full Cart</span>
                        <ChevronRight size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={closeQuickCart}
                        className="flex-1 rounded-xl border border-transparent py-2.5 text-xs font-semibold text-espresso-600 transition hover:text-espresso-900"
                      >
                        Keep Browsing
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.aside>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
