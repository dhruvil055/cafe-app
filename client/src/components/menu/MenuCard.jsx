import { forwardRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Star, Lock } from 'lucide-react';
import useCartStore from '../../context/cartStore';
import toast from 'react-hot-toast';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=75';

function getOptimizedImageProps(rawUrl) {
  const url = rawUrl || PLACEHOLDER;
  if (url.includes('images.unsplash.com')) {
    const base = url.split('?')[0];
    return {
      src: `${base}?auto=format&fit=crop&w=400&q=75`,
      srcSet: `${base}?auto=format&fit=crop&w=320&q=75 320w, ${base}?auto=format&fit=crop&w=480&q=75 480w, ${base}?auto=format&fit=crop&w=640&q=75 640w`,
      sizes: '(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 22vw',
    };
  }
  return { src: url, srcSet: undefined, sizes: undefined };
}

const MenuCard = forwardRef(function MenuCard({ product, onSelect, priority = false }, ref) {
  const { addItem, tableNumber, openScanner } = useCartStore();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const imageProps = getOptimizedImageProps(imgError ? PLACEHOLDER : product.image);

  // inventoryAvailable: true = has stock or no mapping, false = out of stock from inventory
  const isAvailable = product.available && product.inventoryAvailable !== false;
  const isLimited = product.maxOrderableQty !== null && product.maxOrderableQty !== undefined && product.maxOrderableQty <= 5 && product.maxOrderableQty > 0;

  const handleQuickAdd = (e) => {
    e.stopPropagation();
    if (!isAvailable) return;

    if (!tableNumber) {
      toast.error('Please scan your table QR code to unlock ordering!');
      openScanner();
      return;
    }

    if (product.addons?.length > 0 || product.variants?.length > 0) {
      onSelect();
      return;
    }
    const added = addItem(product, 1, [], null, '');
    if (added) {
      toast.success(`${product.name} added!`);
    }
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={isAvailable ? { y: -3 } : {}}
      transition={{ duration: 0.25 }}
      onClick={isAvailable ? onSelect : undefined}
      className={`card group transition-transform ${isAvailable ? 'cursor-pointer active:scale-98' : 'cursor-default'}`}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-foam">
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
          className={`w-full h-full object-cover transition-all duration-300 ${isAvailable ? 'group-hover:scale-105' : 'opacity-60'} ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
        />

        {product.popular && isAvailable && (
          <div className="absolute top-2 right-2">
            <span className="bg-brew-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Star size={8} fill="white" />
              HOT
            </span>
          </div>
        )}

        {/* Out of stock overlay (from inventory or product.available = false) */}
        {!isAvailable && (
          <div className="absolute inset-0 bg-espresso-950/60 flex items-center justify-center">
            <span className="text-foam text-xs font-semibold bg-espresso-900/80 px-2.5 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}

        {/* Limited stock badge */}
        {isAvailable && isLimited && (
          <div className="absolute bottom-2 left-2">
            <span className="flex items-center gap-1 bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              Only {product.maxOrderableQty} left!
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="font-medium text-espresso-900 text-sm leading-tight line-clamp-1">
          {product.name}
        </p>
        {product.description && (
          <p className="text-espresso-400 text-xs mt-0.5 line-clamp-1">{product.description}</p>
        )}

        <div className="flex items-center justify-between mt-2 gap-2">
          <span className="price-tag text-sm sm:text-base">
            {String.fromCharCode(8377)}{product.price}
          </span>
          <motion.button
            whileTap={isAvailable ? { scale: 0.85 } : {}}
            onClick={handleQuickAdd}
            disabled={!isAvailable}
            title={
              !isAvailable
                ? 'Out of stock'
                : !tableNumber
                ? 'Scan Table QR to unlock ordering'
                : `Add ${product.name} to cart`
            }
            aria-label={
              !isAvailable
                ? 'Out of stock'
                : !tableNumber
                ? 'Scan Table QR to unlock ordering'
                : `Add ${product.name} to cart`
            }
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all
              ${!isAvailable
                ? 'bg-espresso-200 text-espresso-400 cursor-not-allowed'
                : !tableNumber
                ? 'bg-amber-100 border border-amber-300 text-amber-800 hover:bg-amber-200 shadow-sm active:scale-90'
                : 'bg-espresso-900 text-cream hover:bg-brew-600 active:scale-90 shadow-sm'
              }`}
          >
            {!tableNumber && isAvailable ? (
              <Lock size={12} strokeWidth={2.4} />
            ) : (
              <Plus size={14} strokeWidth={2.5} />
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});

export default MenuCard;
