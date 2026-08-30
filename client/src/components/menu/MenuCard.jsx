import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Star } from 'lucide-react';
import useCartStore from '../../context/cartStore';
import toast from 'react-hot-toast';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80';

const MenuCard = forwardRef(function MenuCard({ product, onSelect }, ref) {
  const { addItem } = useCartStore();

  const handleQuickAdd = (e) => {
    e.stopPropagation();
    if (!product.available) return;
    if (product.addons?.length > 0 || product.variants?.length > 0) {
      onSelect();
      return;
    }
    addItem(product, 1, [], null, '');
    toast.success(`${product.name} added!`);
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

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span className={`w-4 h-4 rounded-sm border flex items-center justify-center
            ${product.isVeg ? 'border-green-600 bg-white' : 'border-red-600 bg-white'}`}>
            <span className={`w-2 h-2 rounded-full ${product.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
          </span>
        </div>

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
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="font-medium text-espresso-900 text-sm leading-tight line-clamp-1">
          {product.name}
        </p>
        {product.description && (
          <p className="text-espresso-400 text-xs mt-0.5 line-clamp-1">{product.description}</p>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="font-display font-semibold text-espresso-900 text-sm">
            ₹{product.price}
          </span>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleQuickAdd}
            disabled={!product.available}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all
              ${product.available
                ? 'bg-espresso-900 text-cream hover:bg-brew-600 active:scale-90'
                : 'bg-espresso-200 text-espresso-400 cursor-not-allowed'
              }`}
          >
            <Plus size={14} strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});

export default MenuCard;
