import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  X,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Trash2,
} from 'lucide-react';
import useCartStore from '../../context/cartStore';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&q=80';

export default function QuickCartPopup() {
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
  } = useCartStore();

  const [isHovered, setIsHovered] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [progress, setProgress] = useState(100);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.itemTotal, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  // Find the last added item or the first item
  const recentItem =
    items.find((i) => i.key === lastAddedItemKey) || items[items.length - 1] || null;

  // Don't show popup on Cart or Checkout pages
  const isExcludedPage = location.pathname === '/cart' || location.pathname === '/checkout';

  // Auto-dismiss countdown (5.5 seconds), pauses on hover
  useEffect(() => {
    if (!isQuickCartOpen || isExcludedPage || items.length === 0) {
      setProgress(100);
      return;
    }

    if (isHovered || showAllItems) {
      return;
    }

    const duration = 5500;
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          closeQuickCart();
          return 100;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isQuickCartOpen, isHovered, showAllItems, isExcludedPage, items.length, closeQuickCart, lastAddedItemKey]);

  // Reset progress bar on new item add
  useEffect(() => {
    if (isQuickCartOpen) {
      setProgress(100);
    }
  }, [lastAddedItemKey, isQuickCartOpen]);

  if (isExcludedPage || items.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      {isQuickCartOpen && (
        <aside
          aria-label="Quick Cart Notification Popup"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="fixed bottom-20 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm sm:bottom-6 sm:right-6 sm:w-96 pointer-events-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: 35, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.94 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="overflow-hidden rounded-[1.75rem] border border-foam bg-white/95 text-espresso-900 shadow-[0_20px_50px_rgba(26,15,8,0.22)] backdrop-blur-xl ring-1 ring-espresso-950/5"
          >
            {/* Auto-dismiss progress indicator line */}
            <div className="h-1 w-full bg-foam/70">
              <div
                className="h-full bg-brew-500 transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Popup Header */}
            <div className="flex items-center justify-between border-b border-foam/80 bg-cream/70 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brew-500 text-white shadow-sm">
                  <CheckCircle2 size={15} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-espresso-900">
                    Added to Order
                  </p>
                  <p className="text-[11px] text-espresso-500">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'} in cart
                    {tableNumber ? ` • Table ${String(tableNumber).padStart(2, '0')}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeQuickCart}
                aria-label="Dismiss quick cart popup"
                className="flex h-7 w-7 items-center justify-center rounded-full text-espresso-400 transition hover:bg-espresso-100 hover:text-espresso-800 active:scale-90"
              >
                <X size={15} />
              </button>
            </div>

            {/* Recent Item Highlight Card */}
            {recentItem && (
              <div className="p-4 sm:p-5">
                <div className="flex gap-3.5">
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-foam">
                    <img
                      src={recentItem.image || PLACEHOLDER}
                      alt={recentItem.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.target.src = PLACEHOLDER;
                      }}
                    />
                  </div>

                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-display text-base font-bold leading-tight text-espresso-950 line-clamp-1">
                          {recentItem.name}
                        </h4>
                        <span className="price-tag text-sm font-bold text-espresso-950 flex-shrink-0">
                          ₹{recentItem.itemTotal}
                        </span>
                      </div>

                      {recentItem.variant && (
                        <span className="mt-0.5 inline-block rounded-md bg-espresso-100/70 px-1.5 py-0.2 text-[10px] font-semibold text-espresso-700">
                          {recentItem.variant.name}
                        </span>
                      )}

                      {recentItem.addons?.length > 0 && (
                        <p className="text-[10px] text-espresso-500 line-clamp-1">
                          + {recentItem.addons.map((a) => a.name).join(', ')}
                        </p>
                      )}
                    </div>

                    {/* Quantity controls inside popup */}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-lg border border-foam bg-cream px-1.5 py-0.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(recentItem.key, recentItem.quantity - 1)}
                          className="flex h-5 w-5 items-center justify-center rounded text-espresso-700 hover:bg-espresso-900 hover:text-white transition active:scale-90"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="w-4 text-center text-xs font-bold text-espresso-900">
                          {recentItem.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(recentItem.key, recentItem.quantity + 1)}
                          className="flex h-5 w-5 items-center justify-center rounded text-espresso-700 hover:bg-espresso-900 hover:text-white transition active:scale-90"
                          aria-label="Increase quantity"
                        >
                          <Plus size={10} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(recentItem.key)}
                        className="text-espresso-400 hover:text-red-600 transition text-[11px] flex items-center gap-1"
                        aria-label="Remove item"
                      >
                        <Trash2 size={12} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* If multiple items exist in cart, allow expanding to view list */}
                {items.length > 1 && (
                  <div className="mt-3 border-t border-foam/80 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAllItems((prev) => !prev)}
                      className="flex w-full items-center justify-between text-[11px] font-semibold text-brew-700 hover:text-espresso-900 transition py-0.5"
                    >
                      <span>
                        {showAllItems ? 'Hide other items' : `View all ${items.length} items in cart`}
                      </span>
                      {showAllItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <AnimatePresence>
                      {showAllItems && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1"
                        >
                          {items
                            .filter((item) => item.key !== recentItem.key)
                            .map((item) => (
                              <div
                                key={item.key}
                                className="flex items-center justify-between rounded-xl bg-cream/70 p-2 text-xs"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="font-medium text-espresso-900 truncate">
                                    {item.name}
                                  </p>
                                  <p className="text-[10px] text-espresso-500">
                                    Qty: {item.quantity} {item.variant ? `• ${item.variant.name}` : ''}
                                  </p>
                                </div>
                                <span className="font-semibold text-espresso-900">
                                  ₹{item.itemTotal}
                                </span>
                              </div>
                            ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}

            {/* Popup Actions & Total */}
            <div className="border-t border-foam bg-cream/60 p-4">
              <div className="flex items-center justify-between pb-3 text-xs">
                <span className="text-espresso-600 font-medium">Cart Total (incl. tax)</span>
                <span className="font-display text-lg font-bold text-espresso-950">₹{total}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    closeQuickCart();
                    navigate('/cart');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-espresso-300 bg-white py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-espresso-900 shadow-sm transition hover:bg-espresso-50 active:scale-95"
                >
                  <ShoppingBag size={13} />
                  <span>View Cart</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    closeQuickCart();
                    navigate('/checkout');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-espresso-900 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-cream shadow-md transition hover:bg-brew-600 active:scale-95"
                >
                  <span>Checkout</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </motion.div>
        </aside>
      )}
    </AnimatePresence>
  );
}
