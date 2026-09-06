import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Star, Lock } from 'lucide-react';
import useCartStore from '../../context/cartStore';
import toast from 'react-hot-toast';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80';

const MenuCard = forwardRef(function MenuCard({ product, onSelect }, ref) {
  const { addItem, tableNumber, diningSessionToken, sessionExpired, openScanner } = useCartStore();

  // True session = has table + valid (non-expired) token
  const hasValidSession = Boolean(tableNumber && diningSessionToken && !sessionExpired);

  const handleQuickAdd = (e) => {
    e.stopPropagation();
    if (!product.available) return;

    if (!hasValidSession) {
      if (sessionExpired) {
        toast.error('Your table session has expired. Please scan the table QR code again.', {
          id: 'session-expired',
          duration: 5000,
        });
      } else {
        toast.error('Please scan your table QR code to add items & order.');
      }
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
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25 }}
      onClick={onSelect}
      className="card cursor-pointer group active:scale-98 transition-transform"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-foam">
        <img
          src={product.image || PLACEHOLDER}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={e => { e.target.src = PLACEHOLDER; }}
        />

        {product.popular && (
          <div className="absolute top-2 right-2">
            <span className="bg-brew-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Star size={8} fill="white" />
              HOT
            </span>
          </div>
        )}

        {!product.available && (
          <div className="absolute inset-0 bg-espresso-950/60 flex items-center justify-center">
            <span className="text-foam text-xs font-medium bg-espresso-900/80 px-2 py-1 rounded-full">
              Unavailable
            </span>
          </div>
        )}

        {/* Lock overlay when no valid session */}
        {!hasValidSession && product.available && (
          <div className="absolute bottom-2 left-2">
            <span className="flex items-center gap-1 bg-espresso-950/70 backdrop-blur-sm text-foam text-[10px] font-medium px-1.5 py-0.5 rounded-full">
              <Lock size={9} />
              Scan QR
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
            whileTap={{ scale: 0.85 }}
            onClick={handleQuickAdd}
            disabled={!product.available}
            aria-label={hasValidSession ? `Add ${product.name} to cart` : 'Scan table QR to add items'}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all
              ${!product.available
                ? 'bg-espresso-200 text-espresso-400 cursor-not-allowed'
                : hasValidSession
                  ? 'bg-espresso-900 text-cream hover:bg-brew-600 active:scale-90'
                  : 'bg-amber-100 text-amber-600 hover:bg-amber-200 border border-amber-300'
              }`}
          >
            {hasValidSession || !product.available ? (
              <Plus size={14} strokeWidth={2.5} />
            ) : (
              <Lock size={12} strokeWidth={2.5} />
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});

export default MenuCard;
