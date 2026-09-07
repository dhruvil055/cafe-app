import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Minus, ShoppingBag, Star, Clock, AlertTriangle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore from '../../context/cartStore';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80';

export default function ProductModal({ product, onClose }) {
  const { addItem, tableNumber, openScanner } = useCartStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [instructions, setInstructions] = useState('');

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const addons = Array.isArray(product?.addons) ? product.addons : [];

  // Inventory-based availability
  const isAvailable = product.available && product.inventoryAvailable !== false;
  const maxQty = product.maxOrderableQty ?? 99; // null = unlimited
  const isLimited = product.maxOrderableQty !== null && product.maxOrderableQty !== undefined && product.maxOrderableQty <= 10;

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

  const changeQty = (delta) => {
    setQuantity(prev => Math.min(maxQty, Math.max(1, prev + delta)));
  };

  const basePrice = selectedVariant ? selectedVariant.price : product.price;
  const addonTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const unitPrice = basePrice + addonTotal;
  const total = unitPrice * quantity;

  const handleAdd = () => {
    if (!isAvailable) return;
    if (!tableNumber) {
      toast.error('Please scan your table QR code to unlock ordering!');
      openScanner();
      return;
    }
    if (quantity > maxQty) {
      toast.error(`Only ${maxQty} available. Please reduce your quantity.`);
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
            className={`w-full h-full object-cover ${!isAvailable ? 'opacity-50' : ''}`}
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
            {product.popular && isAvailable && (
              <span className="bg-brew-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Star size={10} fill="white" /> Popular
              </span>
            )}
            {!isAvailable && (
              <span className="bg-espresso-900/90 text-foam text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Out of Stock
              </span>
            )}
            {isAvailable && isLimited && (
              <span className="bg-amber-500/90 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                Only {product.maxOrderableQty} left!
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-espresso-900">{product.name}</h2>
              {product.prepTime && (
                <span className="flex items-center gap-1 text-xs text-espresso-400 flex-shrink-0">
                  <Clock size={12} /> {product.prepTime}m
                </span>
              )}
            </div>
            {product.description && (
              <p className="text-espresso-500 text-sm mt-1">{product.description}</p>
            )}
          </div>

          {/* Variants */}
          {variants.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-espresso-400 mb-2">Size / Variant</p>
              <div className="flex gap-2 flex-wrap">
                {variants.map(v => (
                  <button
                    key={v.name}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      selectedVariant?.name === v.name
                        ? 'bg-brew-500 text-white border-brew-500'
                        : 'border-foam text-espresso-700 bg-white hover:border-brew-300'
                    }`}
                  >
                    {v.name} {v.price > 0 && `(+${String.fromCharCode(8377)}${v.price})`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Addons */}
          {addons.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-espresso-400 mb-2">Add-ons</p>
              <div className="space-y-2">
                {addons.map(addon => {
                  const selected = selectedAddons.some(a => a.name === addon.name);
                  return (
                    <button
                      key={addon.name}
                      onClick={() => toggleAddon(addon)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-sm transition-colors ${
                        selected
                          ? 'border-brew-400 bg-brew-50/60 text-espresso-900'
                          : 'border-foam bg-white text-espresso-600 hover:border-brew-200'
                      }`}
                    >
                      <span className="font-medium text-xs">{addon.name}</span>
                      <span className="text-xs text-brew-600 font-semibold">+{String.fromCharCode(8377)}{addon.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-espresso-400 mb-1.5">Special Instructions</p>
            <input
              type="text"
              placeholder="e.g. Extra hot, no sugar..."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              maxLength={120}
              className="w-full text-xs bg-white border border-foam rounded-xl p-2.5 text-espresso-800
                         placeholder:text-espresso-300 focus:outline-none focus:border-brew-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-foam bg-white flex items-center gap-3 flex-shrink-0">
          {/* Quantity */}
          <div className="flex items-center gap-2 border border-foam rounded-xl px-2 py-1.5 bg-cream">
            <button
              className="qty-btn"
              onClick={() => changeQty(-1)}
              disabled={!isAvailable}
            >
              <Minus size={12} />
            </button>
            <span className="w-6 text-center font-medium text-sm text-espresso-900">{quantity}</span>
            <button
              className="qty-btn"
              onClick={() => changeQty(1)}
              disabled={!isAvailable || quantity >= maxQty}
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Add to cart / Scan to order */}
          <motion.button
            whileTap={isAvailable ? { scale: 0.97 } : {}}
            onClick={handleAdd}
            disabled={!isAvailable}
            className={`flex-1 flex items-center justify-between py-3.5 rounded-2xl px-5 font-semibold text-sm transition-all
              ${!isAvailable
                ? 'bg-espresso-200 text-espresso-400 cursor-not-allowed'
                : !tableNumber
                ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-md active:scale-95'
                : 'bg-espresso-900 text-cream hover:bg-brew-700 active:scale-95 shadow-md'
              }`}
          >
            <div className="flex items-center gap-2">
              {!isAvailable ? (
                <span>Out of Stock</span>
              ) : !tableNumber ? (
                <>
                  <Lock size={16} className="text-amber-200" strokeWidth={2.3} />
                  <span>Scan Table to Order</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={16} />
                  <span>Add to Cart</span>
                </>
              )}
            </div>
            {isAvailable && (
              <span className={`font-mono text-base font-semibold ${!tableNumber ? 'text-amber-100' : 'text-brew-300'}`}>
                {String.fromCharCode(8377)}{total}
              </span>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
