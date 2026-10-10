import { forwardRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Star, Lock, Sparkles, Clock, SlidersHorizontal } from 'lucide-react';
import useCartStore from '../../context/cartStore';
import toast from 'react-hot-toast';
import { useTenant } from '../../context/TenantContext';
import { formatMoney } from '../../utils/money';

const PLACEHOLDER = '/images/coffee-placeholder.svg';

function getOptimizedImageProps(rawUrl) {
  const url = rawUrl || PLACEHOLDER;
  if (url.includes('images.unsplash.com')) {
    const base = url.split('?')[0];
    return {
      src: `${base}?auto=format&fit=crop&w=480&q=75`,
      srcSet: `${base}?auto=format&fit=crop&w=320&q=75 320w, ${base}?auto=format&fit=crop&w=480&q=75 480w, ${base}?auto=format&fit=crop&w=640&q=75 640w`,
      sizes: '(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 22vw',
    };
  }
  return { src: url, srcSet: undefined, sizes: undefined };
}

const MenuCard = forwardRef(function MenuCard({ product, onSelect, priority = false }, ref) {
  const tenant = useTenant();
  const { items, addItem, updateQuantity, tableNumber, openScanner } = useCartStore();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const imageProps = getOptimizedImageProps(imgError ? PLACEHOLDER : product.image);

  // inventoryAvailable: true = has stock or no mapping, false = out of stock from inventory
  const isAvailable = product.available && product.scheduledAvailable !== false && product.inventoryAvailable !== false;
  const isLimited = product.maxOrderableQty !== null && product.maxOrderableQty !== undefined && product.maxOrderableQty <= 5 && product.maxOrderableQty > 0;
  const hasCustomizations = (product.addons && product.addons.length > 0) || (product.variants && product.variants.length > 0);

  // Calculate items of this product in cart
  const cartItemsForProduct = items.filter(i => i.product === product._id);
  const totalQtyInCart = cartItemsForProduct.reduce((sum, i) => sum + i.quantity, 0);

  const handleQuickAdd = (e) => {
    e.stopPropagation();
    if (!isAvailable) return;

    if (!tableNumber) {
      toast.error('Please scan your table QR code to unlock ordering!');
      openScanner();
      return;
    }

    if (hasCustomizations) {
      onSelect();
      return;
    }

    const added = addItem(product, 1, [], null, '');
    if (added) {
      toast.success(`${product.name} added!`);
    }
  };

  const handleIncrement = (e) => {
    e.stopPropagation();
    if (!isAvailable) return;
    if (hasCustomizations) {
      onSelect();
      return;
    }
    const added = addItem(product, 1, [], null, '');
    if (added) {
      toast.success(`Added another ${product.name}`);
    }
  };

  const handleDecrement = (e) => {
    e.stopPropagation();
    if (hasCustomizations) {
      // If customized, opening modal or reducing the latest item
      if (cartItemsForProduct.length === 1) {
        updateQuantity(cartItemsForProduct[0].key, cartItemsForProduct[0].quantity - 1);
      } else {
        onSelect();
      }
      return;
    }
    if (cartItemsForProduct.length > 0) {
      const targetItem = cartItemsForProduct[0];
      updateQuantity(targetItem.key, targetItem.quantity - 1);
    }
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={isAvailable ? { y: -4 } : {}}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      onClick={isAvailable ? onSelect : undefined}
      className={`card group flex flex-col justify-between transition-all duration-300 ${
        isAvailable
          ? 'cursor-pointer hover:shadow-[0_12px_28px_-4px_rgba(26,15,8,0.12),0_4px_8px_rgba(26,15,8,0.04)] hover:border-espresso-300 active:scale-[0.985]'
          : 'cursor-default opacity-85'
      }`}
    >
      {/* Top Image Section */}
      <div className="relative aspect-square w-full overflow-hidden bg-foam/90">
        {!imgLoaded && (
          <div className="absolute inset-0 skeleton" />
        )}
        <img
          src={imageProps.src}
          srcSet={imageProps.srcSet}
          sizes={imageProps.sizes}
          alt={product.name}
          width="400"
          height="400"
          style={{ aspectRatio: '1 / 1' }}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchpriority={priority ? 'high' : undefined}
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            setImgError(true);
            setImgLoaded(true);
          }}
          className={`h-full w-full object-cover transition-transform duration-500 will-change-transform ${
            isAvailable ? 'group-hover:scale-106' : 'grayscale opacity-50'
          } ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Ambient Dark Gradient on bottom of image for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

        {/* Top Badges (Veg/Non-Veg & Popular) */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
          {/* Veg / Non-Veg Emblem */}
          {product.isVeg !== false ? (
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] border-[1.5px] border-emerald-600 bg-white/95 p-[2px] shadow-xs"
              title="100% Vegetarian"
              aria-label="Vegetarian"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
            </span>
          ) : (
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded-[4px] border-[1.5px] border-amber-800 bg-white/95 p-[2px] shadow-xs"
              title="Non-Vegetarian"
              aria-label="Non-Vegetarian"
            >
              <span className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[7px] border-b-amber-800" />
            </span>
          )}

          {/* Popular / Hot Badge */}
          {product.popular && isAvailable && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brew-500/95 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
              <Star size={9} fill="currentColor" />
              <span>POPULAR</span>
            </span>
          )}
        </div>

        {/* Out of Stock Overlay */}
        {!isAvailable && (
          <div className="absolute inset-0 bg-espresso-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 text-center">
            <span className="rounded-full bg-espresso-900/90 border border-white/20 px-3 py-1 text-xs font-semibold text-foam shadow-md">
              Sold Out
            </span>
            <span className="mt-1 text-[11px] text-cream/70">Check back later</span>
          </div>
        )}

        {/* Bottom Image Badges (Limited stock / Prep time) */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          {isAvailable && isLimited && (
            <span className="rounded-full bg-amber-600/95 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
              Only {product.maxOrderableQty} left
            </span>
          )}
          {product.prepTime && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-medium text-cream/90">
              <Clock size={10} />
              <span>{product.prepTime}m</span>
            </span>
          )}
        </div>
      </div>

      {/* Card Info Section */}
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5">
        <div>
          <div className="flex items-start justify-between gap-1.5">
            <h3 className="font-display text-sm sm:text-base font-bold text-espresso-950 leading-snug line-clamp-1 group-hover:text-brew-700 transition-colors">
              {product.name}
            </h3>
          </div>

          {product.description && (
            <p className="mt-1 text-xs text-espresso-500 leading-relaxed line-clamp-2">
              {product.description}
            </p>
          )}

          {hasCustomizations && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-brew-700">
              <SlidersHorizontal size={10} />
              <span>Customisable</span>
            </div>
          )}
        </div>

        {/* Price & Action Row */}
        <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-foam/70">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="price-tag text-base sm:text-lg font-bold text-espresso-950">
                {formatMoney(product.price, tenant.currency)}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-xs text-espresso-400 line-through tabular-nums">
                  {formatMoney(product.originalPrice, tenant.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Interactive Add / Stepper Control */}
          <div className="flex items-center">
            {!isAvailable ? (
              <span className="text-[11px] font-semibold text-espresso-400 uppercase tracking-wider px-2 py-1">
                Unavailable
              </span>
            ) : totalQtyInCart > 0 && !hasCustomizations ? (
              /* Inline Quantity Stepper for Simple Products */
              <div
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-h-[36px] items-center rounded-xl bg-espresso-900 text-cream p-0.5 shadow-sm"
              >
                <button
                  type="button"
                  onClick={handleDecrement}
                  aria-label={`Decrease quantity of ${product.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-espresso-800 transition active:scale-90"
                >
                  <Minus size={13} strokeWidth={2.5} />
                </button>
                <span className="w-6 text-center text-xs font-bold font-mono">
                  {totalQtyInCart}
                </span>
                <button
                  type="button"
                  onClick={handleIncrement}
                  aria-label={`Increase quantity of ${product.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-espresso-800 transition active:scale-90"
                >
                  <Plus size={13} strokeWidth={2.5} />
                </button>
              </div>
            ) : totalQtyInCart > 0 && hasCustomizations ? (
              /* Customizable items already in cart */
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                }}
                aria-label={`Item in cart, tap to customize ${product.name}`}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl bg-brew-600 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition hover:bg-brew-700 focus:outline-none focus:ring-2 focus:ring-brew-400"
              >
                <span>{totalQtyInCart} in Cart</span>
                <Plus size={12} strokeWidth={3} />
              </motion.button>
            ) : (
              /* Prominent, high-contrast Add Button */
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={handleQuickAdd}
                aria-label={`Add ${product.name} to cart`}
                className="min-h-[36px] inline-flex items-center gap-1 rounded-xl bg-espresso-900 text-cream px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all hover:bg-espresso-800 active:scale-95 shadow-xs focus:outline-none focus:ring-2 focus:ring-brew-500"
              >
                <span>ADD</span>
                <Plus size={13} strokeWidth={2.6} />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default MenuCard;
