import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, QrCode, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore, { cartItemCount } from '../../context/cartStore';
import { useSessionValidator } from '../../hooks/useSessionValidator';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&q=70';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, tableNumber, sessionExpired, removeItem, updateQuantity, clearCart, openScanner } = useCartStore();
  const itemCount = useCartStore(cartItemCount);

  // Validate session on every visit to this page
  useSessionValidator();

  const subtotal = items.reduce((s, i) => s + i.itemTotal, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  const handleProceedCheckout = () => {
    if (sessionExpired) {
      toast.error('Your table session has expired. Please scan the table QR code again.', {
        id: 'session-expired',
      });
      openScanner();
      return;
    }
    if (!tableNumber || !useCartStore.getState().diningSessionToken) {
      toast.error('Please scan your table QR code to place your order.');
      openScanner();
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-foam">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full border border-foam flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-xl font-bold text-espresso-900">Your Cart</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <span className="text-6xl">🛒</span>
          <h2 className="font-display text-2xl font-bold text-espresso-900">Cart is empty</h2>
          <p className="text-espresso-400 text-center text-sm">Browse our menu and add something delicious!</p>
          <Link to="/menu" className="btn-primary mt-2">Browse Menu</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-foam bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full border border-foam flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-xl font-bold text-espresso-900">Your Cart</h1>
          {itemCount > 0 && (
            <span className="bg-brew-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {itemCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tableNumber && !sessionExpired ? (
            <span className="text-xs text-espresso-700 font-semibold bg-foam px-2.5 py-1 rounded-full">
              Table {String(tableNumber).padStart(2, '0')}
            </span>
          ) : (
            <button
              type="button"
              onClick={openScanner}
              className="inline-flex items-center gap-1.5 rounded-full bg-brew-600 px-3 py-1 text-xs font-bold uppercase text-white shadow-sm hover:bg-brew-700 transition active:scale-95"
            >
              <QrCode size={13} />
              <span>{sessionExpired ? 'Re-scan QR' : 'Scan Table'}</span>
            </button>
          )}
          <button
            onClick={clearCart}
            className="text-xs text-red-500 font-medium hover:text-red-700 transition-colors ml-1"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Session expired warning */}
      {sessionExpired && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-red-600 flex-shrink-0" />
            <p className="text-red-700 text-xs font-medium">
              Your table session has expired. Please scan the table QR code again to checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={openScanner}
            className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase text-white shadow-sm hover:bg-red-700 transition active:scale-95 whitespace-nowrap"
          >
            Scan QR
          </button>
        </motion.div>
      )}

      {/* No table warning */}
      {!tableNumber && !sessionExpired && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-700 flex-shrink-0" />
            <p className="text-amber-900 text-xs font-medium">
              Please scan your table QR code to place your order.
            </p>
          </div>
          <button
            type="button"
            onClick={openScanner}
            className="rounded-full bg-brew-600 px-3 py-1 text-xs font-bold uppercase text-white shadow-sm hover:bg-brew-700 transition active:scale-95 whitespace-nowrap"
          >
            Scan QR
          </button>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto pb-52 sm:pb-48">
        <div className="p-4 space-y-3">
          <AnimatePresence>
            {items.map(item => (
              <motion.div
                key={item.key}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className="card flex gap-3 p-3"
              >
                <img
                  src={item.image || PLACEHOLDER}
                  alt={item.name}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-foam"
                  onError={e => { e.target.src = PLACEHOLDER; }}
                />

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-espresso-900 text-sm leading-tight">{item.name}</p>

                  {item.variant && (
                    <p className="text-xs text-espresso-400 mt-0.5">{item.variant.name}</p>
                  )}

                  {item.addons?.length > 0 && (
                    <p className="text-xs text-espresso-400 mt-0.5">
                      + {item.addons.map(a => a.name).join(', ')}
                    </p>
                  )}

                  {item.specialInstructions && (
                    <p className="text-xs text-brew-600 mt-0.5 italic">"{item.specialInstructions}"</p>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 bg-foam rounded-xl px-2 py-1">
                      <button className="qty-btn" onClick={() => updateQuantity(item.key, item.quantity - 1)}>
                        <Minus size={12} />
                      </button>
                      <span className="w-5 text-center text-sm font-medium text-espresso-900">
                        {item.quantity}
                      </span>
                      <button className="qty-btn" onClick={() => updateQuantity(item.key, item.quantity + 1)}>
                        <Plus size={12} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-espresso-900 text-sm">
                        {String.fromCharCode(8377)}{item.itemTotal}
                      </span>
                      <button
                        onClick={() => removeItem(item.key)}
                        className="w-7 h-7 rounded-full text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Order note */}
          <div className="bg-brew-50 border border-brew-200 rounded-2xl p-4 text-sm text-brew-800">
            <p className="font-medium mb-1">📋 Order Note</p>
            <p className="text-brew-600 text-xs">Your order will be delivered to your table. No need to wait at the counter!</p>
          </div>
        </div>
      </div>

      {/* Bill summary + checkout */}
      <div className="bottom-safe fixed bottom-0 left-0 right-0 bg-white border-t border-foam p-4 space-y-3 shadow-2xl">
        {/* Bill */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-espresso-600">
            <span>Subtotal</span>
            <span>{String.fromCharCode(8377)}{subtotal}</span>
          </div>
          <div className="flex justify-between text-sm text-espresso-600">
            <span>GST (5%)</span>
            <span>{String.fromCharCode(8377)}{tax}</span>
          </div>
          <div className="flex justify-between font-display font-bold text-espresso-900 text-base pt-1 border-t border-foam">
            <span>Total</span>
            <span>{String.fromCharCode(8377)}{total}</span>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleProceedCheckout}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm transition-all
            ${sessionExpired
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'btn-primary'
            }`}
        >
          {sessionExpired ? (
            <>
              <RefreshCw size={18} />
              Scan QR to Continue
            </>
          ) : (
            <>
              <ShoppingBag size={18} />
              Proceed to Checkout
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
