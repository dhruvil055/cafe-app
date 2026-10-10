import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Minus, ShoppingBag, Star, Clock, AlertTriangle, Lock, Check, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore from '../../context/cartStore';
import { useTenant } from '../../context/TenantContext';
import { formatMoney } from '../../utils/money';

const PLACEHOLDER = '/images/coffee-placeholder.svg';

const INSTRUCTION_PRESETS = [
  'Extra hot',
  'Less ice',
  'No sugar',
  'Mild spicy',
  'Keep sauce separate',
];

export default function ProductModal({ product, onClose }) {
  const tenant = useTenant();
  const { addItem, tableNumber, openScanner } = useCartStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [instructions, setInstructions] = useState('');

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const addons = Array.isArray(product?.addons) ? product.addons : [];
  const milkAddons = addons.filter((addon) => /milk/i.test(addon.name));
  const regularAddons = addons.filter((addon) => !/milk/i.test(addon.name));

  // Inventory-based availability
  const isAvailable = product.available && product.scheduledAvailable !== false && product.inventoryAvailable !== false;
  const maxQty = product.maxOrderableQty ?? 99;
  const isLimited = product.maxOrderableQty !== null && product.maxOrderableQty !== undefined && product.maxOrderableQty <= 10;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    if (variants.length) setSelectedVariant(variants[0]);
    return () => { document.body.style.overflow = ''; };
  }, [variants]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleAddon = (addon) => {
    setSelectedAddons((previous) => {
      const selected = previous.some((item) => item.name === addon.name);
      if (/milk/i.test(addon.name)) {
        return [...previous.filter((item) => !/milk/i.test(item.name)), ...(selected ? [] : [addon])];
      }
      return selected
        ? previous.filter((item) => item.name !== addon.name)
        : [...previous, addon];
    });
  };

  const changeQty = (delta) => {
    setQuantity(prev => Math.min(maxQty, Math.max(1, prev + delta)));
  };

  const handlePresetInstruction = (text) => {
    setInstructions(prev => {
      if (!prev) return text;
      if (prev.toLowerCase().includes(text.toLowerCase())) return prev;
      return `${prev}, ${text}`;
    });
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
      className="fixed inset-0 bg-espresso-950/70 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 360 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden
                   max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-foam"
      >
        {/* Mobile Swipe / Drag Handle */}
        <div className="sm:hidden flex items-center justify-center pt-2 pb-1 bg-white">
          <div className="w-10 h-1 rounded-full bg-espresso-200" />
        </div>

        {/* Hero Image Section */}
        <div className="relative h-56 sm:h-64 flex-shrink-0 bg-foam overflow-hidden">
          <img
            src={product.image || PLACEHOLDER}
            alt={product.name}
            className={`w-full h-full object-cover transition-opacity ${!isAvailable ? 'opacity-50 grayscale' : ''}`}
            onError={e => { e.currentTarget.src = PLACEHOLDER; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-espresso-950/80 via-espresso-950/20 to-black/30" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product modal"
            className="absolute top-3.5 right-3.5 min-h-[40px] min-w-[40px] w-10 h-10 bg-white/90 backdrop-blur-md rounded-full
                       flex items-center justify-center shadow-md hover:bg-white text-espresso-900 transition-all active:scale-90 focus:outline-none focus:ring-2 focus:ring-brew-500"
          >
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>

          {/* Badges on Hero */}
          <div className="absolute top-3.5 left-4 flex flex-wrap items-center gap-1.5">
            {product.isVeg !== false ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-md px-2 py-0.5 text-[11px] font-bold text-emerald-800 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>VEG</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-md px-2 py-0.5 text-[11px] font-bold text-amber-900 shadow-xs">
                <span className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-amber-800" />
                <span>NON-VEG</span>
              </span>
            )}

            {product.popular && isAvailable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brew-500 text-white px-2 py-0.5 text-[11px] font-bold shadow-xs">
                <Star size={10} fill="currentColor" />
                <span>POPULAR</span>
              </span>
            )}
          </div>

          {/* Bottom title & price overlay */}
          <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white drop-shadow-sm leading-tight">
                {product.name}
              </h2>
              {product.prepTime && (
                <span className="inline-flex items-center gap-1 text-xs text-cream/80 mt-0.5">
                  <Clock size={12} /> Prep time: ~{product.prepTime} mins
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="price-tag text-lg sm:text-xl font-bold text-cream drop-shadow-sm">
                {formatMoney(basePrice, tenant.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5 bg-white">
          {product.description && (
            <div className="rounded-2xl bg-foam/50 p-3.5 border border-foam">
              <p className="text-espresso-700 text-sm leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Variants / Sizes */}
          {variants.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-espresso-700">
                  Select Size / Option <span className="text-red-500">*</span>
                </p>
                <span className="text-[11px] text-espresso-400">Required</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {variants.map(v => {
                  const isSelected = selectedVariant?.name === v.name;
                  return (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`min-h-[48px] flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
                        isSelected
                          ? 'border-brew-500 bg-brew-50/80 text-espresso-950 ring-1 ring-brew-500 shadow-2xs'
                          : 'border-foam bg-cream/40 text-espresso-800 hover:border-espresso-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-brew-600 bg-brew-600' : 'border-espresso-300'
                        }`}>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-xs font-semibold">{v.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-espresso-900">
                        {v.price > 0 ? `+${formatMoney(v.price, tenant.currency)}` : 'Standard'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Milk Options */}
          {milkAddons.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-espresso-700 mb-2">
                Choice of Milk
              </p>
              <div className="grid grid-cols-2 gap-2">
                {milkAddons.map((milk) => {
                  const selected = selectedAddons.some((addon) => addon.name === milk.name);
                  return (
                    <button
                      key={milk.name}
                      type="button"
                      onClick={() => toggleAddon(milk)}
                      aria-pressed={selected}
                      className={`min-h-[44px] flex items-center justify-between p-3 rounded-2xl border text-xs transition-all ${
                        selected
                          ? 'border-brew-500 bg-brew-50/80 text-espresso-950 ring-1 ring-brew-500 font-semibold'
                          : 'border-foam bg-cream/40 text-espresso-700 hover:border-espresso-300'
                      }`}
                    >
                      <span>{milk.name}</span>
                      <span className="text-brew-700 font-mono font-bold">
                        +{formatMoney(milk.price, tenant.currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons & Extras */}
          {regularAddons.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-espresso-700 mb-2">
                Add-ons &amp; Extras
              </p>
              <div className="space-y-2">
                {regularAddons.map(addon => {
                  const selected = selectedAddons.some(a => a.name === addon.name);
                  return (
                    <button
                      key={addon.name}
                      type="button"
                      onClick={() => toggleAddon(addon)}
                      className={`min-h-[48px] w-full flex items-center justify-between p-3.5 rounded-2xl border text-sm transition-all ${
                        selected
                          ? 'border-brew-500 bg-brew-50/70 text-espresso-950 ring-1 ring-brew-400'
                          : 'border-foam bg-cream/40 text-espresso-800 hover:border-espresso-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                          selected ? 'border-brew-600 bg-brew-600 text-white' : 'border-espresso-300 bg-white'
                        }`}>
                          {selected && <Check size={11} strokeWidth={3} />}
                        </div>
                        <span className="font-medium text-xs sm:text-sm">{addon.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-brew-700">
                        +{formatMoney(addon.price, tenant.currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Instructions & Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-espresso-700">
                Special Instructions
              </p>
              <span className="text-[11px] text-espresso-400">{instructions.length}/120</span>
            </div>

            {/* Quick preset chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {INSTRUCTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetInstruction(preset)}
                  className="rounded-full border border-foam bg-cream/60 px-2.5 py-1 text-[11px] font-medium text-espresso-700 hover:bg-espresso-100 transition active:scale-95"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="e.g. Extra hot, no sugar, separate sauce..."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              maxLength={120}
              className="input-field"
            />
          </div>
        </div>

        {/* Modal Sticky Footer Action */}
        <div className="p-4 sm:p-5 border-t border-foam bg-cream/70 flex items-center gap-3 flex-shrink-0">
          {/* Quantity Stepper */}
          <div className="flex items-center gap-1 border border-espresso-200 bg-white rounded-2xl p-1 shadow-2xs">
            <button
              type="button"
              className="qty-btn"
              onClick={() => changeQty(-1)}
              disabled={!isAvailable || quantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus size={15} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <span className="w-8 text-center font-bold text-sm text-espresso-950 font-mono">
              {quantity}
            </span>
            <button
              type="button"
              className="qty-btn"
              onClick={() => changeQty(1)}
              disabled={!isAvailable || quantity >= maxQty}
              aria-label="Increase quantity"
            >
              <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>

          {/* Add to Cart CTA */}
          <motion.button
            type="button"
            whileTap={isAvailable ? { scale: 0.98 } : {}}
            onClick={handleAdd}
            disabled={!isAvailable}
            className={`flex-1 min-h-[50px] flex items-center justify-between py-3.5 rounded-2xl px-5 font-bold text-sm transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-brew-500
              ${!isAvailable
                ? 'bg-espresso-200 text-espresso-400 cursor-not-allowed'
                : !tableNumber
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-espresso-900 text-cream hover:bg-espresso-800 active:scale-[0.98]'
              }`}
          >
            <div className="flex items-center gap-2">
              {!isAvailable ? (
                <span>Out of Stock</span>
              ) : !tableNumber ? (
                <>
                  <Lock size={17} className="text-amber-200" strokeWidth={2.4} aria-hidden="true" />
                  <span>Scan Table to Order</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={17} aria-hidden="true" />
                  <span>Add to Order</span>
                </>
              )}
            </div>
            {isAvailable && (
              <span className={`font-mono text-base font-bold ${!tableNumber ? 'text-amber-100' : 'text-brew-300'}`}>
                {formatMoney(total, tenant.currency)}
              </span>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
