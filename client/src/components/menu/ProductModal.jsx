import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Minus, ShoppingBag, Star, Clock, ScanLine, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore from '../../context/cartStore';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80';

export default function ProductModal({ product, onClose }) {
  const { addItem, tableNumber, diningSessionToken, sessionExpired, openScanner } = useCartStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [instructions, setInstructions] = useState('');

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const addons = Array.isArray(product?.addons) ? product.addons : [];

  // True session = has table + valid (non-expired) token
  const hasValidSession = Boolean(tableNumber && diningSessionToken && !sessionExpired);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    if (variants.length) setSelectedVariant(variants[0]);
    return () => { document.body.style.overflow = ''; };
  }, [variants]);

  const toggleAddon = (addon) => {
    setSelectedAddons(prev =>
      prev.find(a => a.name === addon.name)
        ? prev.filter(a => a.name !== addon.name)
        : [...prev, addon]
    );
  };

  const basePrice = selectedVariant ? selectedVariant.price : product.price;
  const addonTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const unitPrice = basePrice + addonTotal;
  const total = unitPrice * quantity;

  const handleAdd = () => {
    if (!hasValidSession) {
      if (sessionExpired) {
        toast.error('Your table session has expired. Please scan the table QR code again.', {
          id: 'session-expired',
          duration: 5000,
        });
      } else {
        toast.error('Please scan your table QR code to start ordering.');
      }
      openScanner();
      return;
    }
    const added = addItem(product, quantity, selectedAddons, selectedVariant, instructions);
    if (added) {
      toast.success(`${product.name} added to cart!`);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-espresso-950/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 400 }}
        onClick={e => e.stopPropagation()}
        className="bg-cream w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden
                   max-h-[92vh] flex flex-col shadow-2xl"
      >
        {/* Image */}
        <div className="relative h-52 flex-shrink-0 bg-foam">
          <img
            src={product.image || PLACEHOLDER}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={e => { e.target.src = PLACEHOLDER; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-espresso-950/40 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full
                       flex items-center justify-center shadow-md hover:bg-white transition-colors"
          >
            <X size={16} className="text-espresso-900" />
          </button>

          {/* Badges */}
          <div className="absolute bottom-3 left-4 flex items-center gap-2">
            {product.popular && (
              <span className="bg-brew-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Star size={10} fill="white" /> Popular
              </span>
            )}
            {!hasValidSession && (
              <span className="bg-espresso-950/80 backdrop-blur-sm text-foam text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                <Lock size={10} />
                {sessionExpired ? 'Session expired' : 'Scan QR to order'}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* Name & price */}
            <div>
              <h2 className="font-display text-2xl font-bold text-espresso-900">{product.name}</h2>
              {product.description && (
                <p className="text-espresso-500 text-sm mt-1 leading-relaxed">{product.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="price-tag text-xl sm:text-2xl">{String.fromCharCode(8377)}{basePrice}</span>
                {product.prepTime && (
                  <span className="flex items-center gap-1 text-xs text-espresso-400">
                    <Clock size={12} /> {product.prepTime} min
                  </span>
                )}
              </div>
            </div>

            {/* Variants */}
            {variants.length > 0 && (
              <div>
                <h3 className="font-medium text-espresso-900 text-sm mb-2">Size</h3>
                <div className="flex flex-wrap gap-2">
                  {variants.map(v => (
                    <button
                      key={v.name}
                      onClick={() => setSelectedVariant(v)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
                        ${selectedVariant?.name === v.name
                          ? 'bg-espresso-900 text-cream border-espresso-900'
                          : 'bg-white text-espresso-700 border-foam hover:border-espresso-300'
                        }`}
                    >
                      {v.name} {String.fromCharCode(183)} {String.fromCharCode(8377)}{v.price}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add-ons */}
            {addons.length > 0 && (
              <div>
                <h3 className="font-medium text-espresso-900 text-sm mb-2">Add-ons</h3>
                <div className="space-y-2">
                  {addons.map(addon => {
                    const selected = selectedAddons.find(a => a.name === addon.name);
                    return (
                      <button
                        key={addon.name}
                        onClick={() => toggleAddon(addon)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border
                                   transition-all text-sm ${selected
                          ? 'bg-espresso-900 text-cream border-espresso-900'
                          : 'bg-white text-espresso-700 border-foam hover:border-espresso-300'}`}
                      >
                        <span>{addon.name}</span>
                        <span className="font-medium">
                          {addon.price === 0 ? 'Free' : `+${String.fromCharCode(8377)}${addon.price}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special instructions */}
            <div>
              <h3 className="font-medium text-espresso-900 text-sm mb-2">Special Instructions</h3>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Any allergies, extra requests...?"
                rows={2}
                className="input-field resize-none text-sm"
              />
            </div>

            {/* Session warning inline */}
            {!hasValidSession && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-4 flex items-start gap-3 ${
                  sessionExpired
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-amber-50 border border-amber-200'
                }`}
              >
                <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                  sessionExpired ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                }`}>
                  {sessionExpired ? <Lock size={16} /> : <ScanLine size={16} />}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${sessionExpired ? 'text-red-800' : 'text-amber-900'}`}>
                    {sessionExpired ? 'Table session expired' : 'Table QR required'}
                  </p>
                  <p className={`text-xs mt-0.5 ${sessionExpired ? 'text-red-600' : 'text-amber-700'}`}>
                    {sessionExpired
                      ? 'Please scan the QR code at your table again to continue ordering.'
                      : 'Please scan the QR code at your table to add items to your order.'}
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-foam bg-white flex items-center gap-3 flex-shrink-0">
          {/* Quantity */}
          <div className="flex items-center gap-2 border border-foam rounded-xl px-2 py-1.5 bg-cream">
            <button className="qty-btn" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
              <Minus size={12} />
            </button>
            <span className="w-6 text-center font-medium text-sm text-espresso-900">{quantity}</span>
            <button className="qty-btn" onClick={() => setQuantity(quantity + 1)}>
              <Plus size={12} />
            </button>
          </div>

          {/* Add to cart / Scan QR */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAdd}
            disabled={!product.available}
            className={`flex-1 flex items-center justify-between py-3.5 rounded-2xl px-5 font-semibold text-sm transition-all
              ${!product.available
                ? 'bg-espresso-200 text-espresso-400 cursor-not-allowed'
                : hasValidSession
                  ? 'bg-espresso-900 text-cream hover:bg-brew-700'
                  : sessionExpired
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-brew-600 text-white hover:bg-brew-700'
              }`}
          >
            <div className="flex items-center gap-2">
              {hasValidSession || !product.available ? (
                <ShoppingBag size={16} />
              ) : (
                <ScanLine size={16} />
              )}
              <span>
                {!product.available
                  ? 'Unavailable'
                  : hasValidSession
                    ? 'Add to Cart'
                    : sessionExpired
                      ? 'Scan QR — Session Expired'
                      : 'Scan Table QR to Order'}
              </span>
            </div>
            {product.available && (
              <span className="font-display text-lg">{String.fromCharCode(8377)}{total}</span>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
