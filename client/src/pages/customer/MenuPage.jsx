import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, SlidersHorizontal, Leaf, Star, ChevronDown, X, AlertCircle, ScanLine, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useCartStore, { cartItemCount } from '../../context/cartStore';
import ProductModal from '../../components/menu/ProductModal';
import MenuCard from '../../components/menu/MenuCard';
import SkeletonCard from '../../components/ui/SkeletonCard';
import QrScannerModal from '../../components/ui/QrScannerModal';

const SORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'popular', label: 'Popular First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function MenuPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableParam = searchParams.get('table');

  const { items, tableNumber, setTable, openQuickCart, isScannerOpen, openScanner, closeScanner } = useCartStore();
  // Reactive item count via selector
  const itemCount = useCartStore(cartItemCount);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [sort, setSort] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [tableConnectedAnim, setTableConnectedAnim] = useState(false);

  const searchRef = useRef();
  const debounceRef = useRef();

  // Set table number from URL param (no session creation)
  useEffect(() => {
    if (!tableParam) return;
    const num = Number(tableParam);
    if (!Number.isInteger(num) || num <= 0) return;

    setTable(num);
    setTableConnectedAnim(true);
    setTimeout(() => setTableConnectedAnim(false), 3000);
  }, [tableParam, setTable]);

  // Fetch categories
  useEffect(() => {
    api.get('/categories').then(res => setCategories(Array.isArray(res.data.categories) ? res.data.categories : []));
  }, []);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Fetch products
  useEffect(() => {
    setLoading(true);
    setMenuError('');
    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.append('category', selectedCategory);
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (vegOnly) params.append('veg', 'true');
    if (sort) params.append('sort', sort);

    api.get(`/menu?${params}`)
      .then(res => setProducts(Array.isArray(res.data.products) ? res.data.products : []))
      .catch(error => {
        setProducts([]);
        setMenuError(error.message || 'Unable to connect to the menu service.');
        toast.error('Failed to load menu');
      })
      .finally(() => setLoading(false));
  }, [selectedCategory, debouncedSearch, vegOnly, sort]);

  const activeTable = tableParam || tableNumber;

  // Subtotal for sticky bar
  const subtotal = items.reduce((s, i) => s + i.itemTotal, 0);
  const grandTotal = subtotal + Math.round(subtotal * 0.05);

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero Section */}
      <div className="relative bg-espresso-950 overflow-hidden" style={{ height: '340px' }}>
        {/* Branded motion backdrop */}
        <video
          className="absolute inset-0 z-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src="/BrewHaus.mp4" type="video/mp4" />
        </video>

        {/* Overlay content */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-espresso-950/20 to-espresso-950/70" />
        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-brew-400 text-xs font-medium tracking-widest uppercase mb-1">
              Fine Coffee &amp; Dining
            </p>
            <h1 className="font-display text-3xl font-bold text-cream leading-tight">
              Brewhaus Cafe
            </h1>

            {/* Table connected indicator or scan prompt */}
            <AnimatePresence mode="wait">
              {activeTable ? (
                <motion.div
                  key="table-connected"
                  initial={{ opacity: 0, scale: 0.9, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`inline-flex items-center gap-2 mt-2 backdrop-blur-sm
                             border rounded-full px-3 py-1 ${
                    tableConnectedAnim
                      ? 'bg-green-500/25 border-green-400/50'
                      : 'bg-brew-500/20 border-brew-400/30'
                  }`}
                >
                  {tableConnectedAnim ? (
                    <CheckCircle2 size={13} className="text-green-400" />
                  ) : (
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  )}
                  <span className="text-cream text-sm font-medium">
                    {tableConnectedAnim
                      ? `Table ${String(activeTable).padStart(2, '0')} connected!`
                      : `Table ${String(activeTable).padStart(2, '0')}`}
                  </span>
                </motion.div>
              ) : (
                <motion.button
                  key="no-table"
                  type="button"
                  onClick={openScanner}
                  initial={{ opacity: 0, scale: 0.9, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center gap-2 mt-2 backdrop-blur-sm bg-amber-500/20 border border-amber-400/40 rounded-full px-3.5 py-1 text-cream text-xs font-medium hover:bg-amber-500/30 transition shadow-sm"
                >
                  <ScanLine size={13} className="text-amber-400" />
                  <span>Scan Table QR to Order</span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Top-right buttons */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowScanner(true)}
            aria-label="Scan table QR code"
            title="Scan table QR code"
            className="glass flex items-center gap-2 rounded-full px-3 py-3 text-sm font-medium text-espresso-900 shadow-lg"
          >
            <ScanLine size={19} />
            <span className="hidden sm:inline">Scan QR</span>
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openQuickCart}
            aria-label="Open Cart Quick View"
            className="relative glass rounded-full p-3 shadow-lg text-espresso-900"
          >
            <ShoppingCart size={20} className="text-espresso-900" />
            <AnimatePresence>
              {itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  initial={{ scale: 1.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="absolute -top-1 -right-1 bg-brew-500 text-white text-xs
                             font-bold w-5 h-5 rounded-full flex items-center justify-center"
                >
                  {itemCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      <div className="relative z-30 -mt-7 px-4 sm:px-6">
        <nav className="mx-auto flex max-w-2xl items-center justify-between gap-1 overflow-x-auto rounded-full border border-foam bg-white/90 px-2 py-2 shadow-[0_12px_30px_rgba(26,15,8,0.12)] backdrop-blur-xl">
          <Link to="/menu" className="flex-shrink-0 rounded-full px-2.5 py-2 text-[11px] font-semibold text-espresso-700 transition hover:bg-espresso-50 hover:text-espresso-900 sm:px-4 sm:text-xs">Menu</Link>
          <Link to="/about" className="flex-shrink-0 rounded-full px-2.5 py-2 text-[11px] font-semibold text-espresso-700 transition hover:bg-espresso-50 hover:text-espresso-900 sm:px-4 sm:text-xs">About</Link>
          <Link to="/offers" className="flex-shrink-0 rounded-full px-2.5 py-2 text-[11px] font-semibold text-espresso-700 transition hover:bg-espresso-50 hover:text-espresso-900 sm:px-4 sm:text-xs">Offers</Link>
          <Link to="/gallery" className="flex-shrink-0 rounded-full px-2.5 py-2 text-[11px] font-semibold text-espresso-700 transition hover:bg-espresso-50 hover:text-espresso-900 sm:px-4 sm:text-xs">Gallery</Link>
          <Link to="/contact" className="flex-shrink-0 rounded-full px-2.5 py-2 text-[11px] font-semibold text-espresso-700 transition hover:bg-espresso-50 hover:text-espresso-900 sm:px-4 sm:text-xs">Contact</Link>
          <Link to="/orders" className="flex-shrink-0 rounded-full px-2.5 py-2 text-[11px] font-semibold text-espresso-700 transition hover:bg-espresso-50 hover:text-espresso-900 sm:px-4 sm:text-xs">Orders</Link>
        </nav>
      </div>

      {/* Search + Filters */}
      <div className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm border-b border-foam px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search food &amp; drinks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 py-2.5 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso-400 hover:text-espresso-700"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all
              ${showFilters || vegOnly || sort
                ? 'bg-espresso-900 text-cream border-espresso-900'
                : 'border-foam text-espresso-700 bg-white'
              }`}
          >
            <SlidersHorizontal size={15} />
            Filter
          </button>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 pb-1">
                <button
                  onClick={() => setVegOnly(!vegOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all
                    ${vegOnly ? 'bg-green-600 text-white border-green-600' : 'border-foam text-espresso-700 bg-white'}`}
                >
                  <Leaf size={12} />
                  Veg Only
                </button>

                <div className="relative flex-1">
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                    className="w-full text-xs border border-foam rounded-full px-3 py-1.5 bg-white
                               text-espresso-700 appearance-none pr-6 focus:outline-none"
                  >
                    {SORT_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-espresso-400 pointer-events-none" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border
              ${selectedCategory === 'all'
                ? 'bg-espresso-900 text-cream border-espresso-900'
                : 'bg-white text-espresso-700 border-foam hover:border-espresso-300'
              }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat._id}
              onClick={() => setSelectedCategory(cat._id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium
                         transition-all border whitespace-nowrap
                ${selectedCategory === cat._id
                  ? 'bg-espresso-900 text-cream border-espresso-900'
                  : 'bg-white text-espresso-700 border-foam hover:border-espresso-300'
                }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className={`px-4 py-4 ${itemCount > 0 ? 'pb-28' : ''}`}>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : menuError ? (
          <div className="text-center py-16">
            <AlertCircle size={30} className="mx-auto text-red-500" />
            <p className="mt-4 font-display text-xl text-espresso-700">Menu unavailable</p>
            <p className="text-espresso-400 text-sm mt-1">{menuError}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl">🔍</span>
            <p className="mt-4 font-display text-xl text-espresso-700">Nothing found</p>
            <p className="text-espresso-400 text-sm mt-1">Try a different search or filter</p>
            <button
              onClick={() => { setSearch(''); setVegOnly(false); setSort(''); setSelectedCategory('all'); }}
              className="mt-4 btn-secondary text-sm py-2 px-5"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            <AnimatePresence mode="popLayout">
              {products.map(product => (
                <MenuCard
                  key={product._id}
                  product={product}
                  onSelect={() => setSelectedProduct(product)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Sticky cart bar */}
      {itemCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-5 right-4 z-40"
        >
          <Link to="/cart">
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              aria-label="View Full Cart"
              className="flex items-center justify-between gap-4 bg-espresso-900 text-cream
                         rounded-2xl pl-3 pr-5 py-3 font-medium shadow-2xl min-w-[180px]"
            >
              <div className="flex items-center gap-2">
                <motion.span
                  key={itemCount}
                  initial={{ scale: 1.4 }}
                  animate={{ scale: 1 }}
                  className="bg-brew-500 text-white text-xs font-bold w-6 h-6
                             rounded-full flex items-center justify-center flex-shrink-0"
                >
                  {itemCount}
                </motion.span>
                <span className="text-sm">View Cart</span>
              </div>
              <span className="font-mono text-sm font-semibold text-brew-300">
                {String.fromCharCode(8377)}{grandTotal}
              </span>
            </motion.button>
          </Link>
        </motion.div>
      )}

      {/* Product modal */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </AnimatePresence>

      {/* QR Scanner modal — sets table number only, no session created */}
      <AnimatePresence>
        {(showScanner || isScannerOpen) && (
          <QrScannerModal
            onClose={() => {
              setShowScanner(false);
              closeScanner();
            }}
            onTableFound={(tableNum) => {
              setShowScanner(false);
              closeScanner();
              setTable(tableNum);
              navigate(`/menu?table=${tableNum}`, { replace: true });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
