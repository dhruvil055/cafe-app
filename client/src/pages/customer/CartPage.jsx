import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, QrCode, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore, { cartItemCount } from '../../context/cartStore';
import QrScannerModal from '../../components/ui/QrScannerModal';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&q=70';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, tableNumber, removeItem, updateQuantity, clearCart, isScannerOpen, openScanner, closeScanner } = useCartStore();
  const itemCount = useCartStore(cartItemCount);

  const subtotal = items.reduce((s, i) => s + i.itemTotal, 0);
  const tax = Math.round(subtotal * 0.05);
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
          {tableNumber ? (
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
              <span>Scan Table</span>
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

      {/* No table warning */}
      {!tableNumber && (
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
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-2xl p-4 border border-foam shadow-sm flex gap-3"
              >
                <img
                  src={item.image || PLACEHOLDER}
                  alt={item.name}
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  onError={e => { e.target.src = PLACEHOLDER; }}
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

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2 bg-cream rounded-full px-2 py-1">
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-espresso-600 hover:text-espresso-900"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-xs font-bold text-espresso-900 min-w-[16px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-espresso-600 hover:text-espresso-900"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="price-tag text-sm font-semibold">
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
        </div>
      </div>

      {/* Bill summary + checkout */}
      <div className="bottom-safe fixed bottom-0 left-0 right-0 bg-white border-t border-foam p-4 space-y-3 shadow-2xl">
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-espresso-600">
            <span>Subtotal</span>
            <span className="price-tag text-sm">{String.fromCharCode(8377)}{subtotal}</span>
          </div>
          <div className="flex justify-between text-sm text-espresso-600">
            <span>GST (5%)</span>
            <span className="price-tag text-sm">{String.fromCharCode(8377)}{tax}</span>
          </div>
          <div className="flex justify-between font-bold text-espresso-900 text-base pt-1 border-t border-foam">
            <span>Total</span>
            <span className="price-tag text-base">{String.fromCharCode(8377)}{total}</span>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleProceedCheckout}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm transition-all btn-primary"
        >
          <ShoppingBag size={18} />
          Proceed to Checkout
        </motion.button>
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
