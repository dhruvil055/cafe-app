import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, Leaf, Star, ChevronDown, X, AlertCircle, ScanLine, CheckCircle2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useCartStore, { cartItemCount } from '../../context/cartStore';
import MenuCard from '../../components/menu/MenuCard';
import SkeletonCard from '../../components/ui/SkeletonCard';
import { getCached, setCached, CATEGORIES_TTL_MS, DEFAULT_TTL_MS, clearClientCache } from '../../utils/menuCache';
import { subscribeToLiveStream } from '../../utils/liveStream';
import TableServiceActions from '../../components/table/TableServiceActions';
import { useTenant } from '../../context/TenantContext';
import usePageMeta from '../../hooks/usePageMeta';

const ProductModal = lazy(() => import('../../components/menu/ProductModal'));
const QrScannerModal = lazy(() => import('../../components/ui/QrScannerModal'));

const SORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'popular', label: 'Popular First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function MenuPage() {
  const tenant = useTenant();
  usePageMeta(
    'Artisanal Coffee & Gourmet Food Menu',
    'Discover our freshly brewed espresso beverages, specialty pour-overs, handcrafted pastries, and gourmet chef specials.'
  );
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableTokenParam = searchParams.get('token') || searchParams.get('tableToken');

  const { items, tableNumber, tableToken, setTable, setDiningSessionToken, openQuickCart, isScannerOpen, openScanner, closeScanner } = useCartStore();
  // Reactive item count via selector
  const itemCount = useCartStore(cartItemCount);
  const subtotal = items.reduce((s, i) => s + (i.itemTotal || 0), 0);
  const tax = Number(((subtotal * Number(tenant.taxRate || 0)) / 100).toFixed(2));
  const grandTotal = (subtotal + tax).toFixed(2);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLongLoading, setIsLongLoading] = useState(false);
  const [menuError, setMenuError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
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

  // Authoritative server resolution of the table QR token
  useEffect(() => {
    if (!tableTokenParam) return;
    let active = true;
    api.get('/public/cafes/resolve', { params: { token: tableTokenParam } })
      .then(({ data }) => {
        if (!active || !data.data?.table) return;
        const resolvedTable = data.data.table;
        setTable(resolvedTable.number, tableTokenParam);
        try {
          sessionStorage.setItem('cafe_table_token', tableTokenParam);
          sessionStorage.setItem('cafe_table_number', String(resolvedTable.number));
          sessionStorage.setItem('cafe_table_id', String(resolvedTable.id));
        } catch {}
        setTableConnectedAnim(true);
        setTimeout(() => setTableConnectedAnim(false), 3000);
      })
      .catch(() => {
        // Fallback to legacy validation endpoint if needed
        api.get('/tables/qr/validate', { params: { token: tableTokenParam } })
          .then(({ data }) => {
            if (!active || !data.valid) return;
            setTable(data.table.tableNumber, tableTokenParam);
            try {
              sessionStorage.setItem('cafe_table_token', tableTokenParam);
              sessionStorage.setItem('cafe_table_number', String(data.table.tableNumber));
            } catch {}
            setTableConnectedAnim(true);
            setTimeout(() => setTableConnectedAnim(false), 3000);
          })
          .catch(() => {
            try {
              sessionStorage.removeItem('cafe_table_token');
              sessionStorage.removeItem('cafe_table_number');
              sessionStorage.removeItem('cafe_table_id');
            } catch {}
            if (active) toast.error('This table QR code is invalid or expired. Ask staff for a new QR code.');
          });
      });
    return () => { active = false; };
  }, [tableTokenParam, setTable]);

  useEffect(() => {
    if (!tableToken || !tableNumber) return undefined;
    let active = true;
    api.post('/session', {
      tableNumber,
      tableToken,
      ...(useCartStore.getState().diningSessionToken && { diningSessionToken: useCartStore.getState().diningSessionToken }),
    }).then(({ data }) => {
      if (active && data.diningSessionToken) setDiningSessionToken(data.diningSessionToken);
    }).catch((error) => {
      if (active) toast.error(error.message || 'Unable to start your table session.');
    });
    return () => { active = false; };
  }, [tableNumber, tableToken, setDiningSessionToken]);

  useEffect(() => subscribeToLiveStream('/menu/events', {
    onEvent: (type, payload) => {
      if (type === 'connected') {
        setReloadKey((current) => current + 1);
      } else if (type === 'availability') {
        clearClientCache();
        setProducts((current) => current.map((product) => String(product._id) === payload.productId
          ? { ...product, available: payload.available }
          : product));
      } else if (type === 'removed') {
        clearClientCache();
        setProducts((current) => current.filter((product) => String(product._id) !== payload.productId));
      }
    },
  }), []);

  useEffect(() => {
    const refreshScheduledAvailability = () => {
      const now = Date.now();
      setProducts((current) => current.map((product) => {
        const startsAt = product.availableFrom ? new Date(product.availableFrom).getTime() : null;
        const endsAt = product.availableUntil ? new Date(product.availableUntil).getTime() : null;
        const scheduledAvailable = (!startsAt || now >= startsAt) && (!endsAt || now < endsAt);
        return product.scheduledAvailable === scheduledAvailable ? product : { ...product, scheduledAvailable };
      }));
    };
    const timer = window.setInterval(refreshScheduledAvailability, 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Fetch categories with client cache
  useEffect(() => {
    const cachedCats = getCached('categories');
    if (cachedCats && cachedCats.length > 0) {
      setCategories(cachedCats);
    }
    api.get('/categories')
      .then(res => {
        const cats = Array.isArray(res.data.categories) ? res.data.categories : [];
        setCategories(cats);
        setCached('categories', cats, CATEGORIES_TTL_MS);
      })
      .catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Long loading indicator for cold starts
  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setIsLongLoading(true), 3500);
    } else {
      setIsLongLoading(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  // Fetch products with stale-while-revalidate client cache
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.append('category', selectedCategory);
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (vegOnly) params.append('veg', 'true');
    if (sort) params.append('sort', sort);

    const cacheKey = `menu_${params.toString()}`;
    const cachedProducts = getCached(cacheKey);

    if (cachedProducts && cachedProducts.length > 0) {
      setProducts(cachedProducts);
      setLoading(false);
      setMenuError('');
    } else {
      setLoading(true);
      setMenuError('');
    }

    api.get(`/menu?${params}`)
      .then(res => {
        const prods = Array.isArray(res.data.products) ? res.data.products : [];
        setProducts(prods);
        setCached(cacheKey, prods, DEFAULT_TTL_MS);
      })
      .catch(error => {
        if (!cachedProducts || cachedProducts.length === 0) {
          setProducts([]);
          setMenuError(error.message || 'Unable to connect to the menu service.');
          toast.error('Failed to load menu');
        }
      })
      .finally(() => setLoading(false));
  }, [selectedCategory, debouncedSearch, vegOnly, sort, reloadKey]);

  const activeTable = tableNumber;


  return (
    <div className="min-h-screen bg-cream">
      {/* Hero Section */}
      <div className="relative bg-espresso-950 overflow-hidden" style={{ minHeight: '260px', height: 'auto' }}>
        {/* Tenant backdrop: Brewhaus video only for brewhaus slug, else tenant hero image or luxury coffee gradient */}
        {tenant.slug === 'brewhaus' ? (
          <video
            className="absolute inset-0 z-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/images/hero-poster.webp"
            aria-hidden="true"
          >
            <source src="/BrewHaus.mp4" type="video/mp4" />
          </video>
        ) : tenant.heroImageUrl ? (
          <img
            src={tenant.heroImageUrl}
            alt={tenant.name}
            className="absolute inset-0 z-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-espresso-950 via-espresso-900 to-[#1e1008]" />
        )}

        {/* Overlay content */}
        <div className="absolute inset-0 bg-gradient-to-b from-espresso-950/40 via-espresso-950/20 to-espresso-950/85" />
        <div className="relative z-10 px-4 py-8 sm:px-6 sm:py-10 max-w-7xl mx-auto flex flex-col justify-end min-h-[260px]">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
          >
            <div>
              <p className="text-brew-400 text-xs font-semibold tracking-widest uppercase mb-1">
                {tenant.tagline || 'Fine Coffee & Dining'}
              </p>
              <Link to="/" aria-label={`${tenant.name} home`} className="inline-block focus:outline-none focus:ring-2 focus:ring-brew-400 rounded-lg">
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} alt={tenant.name} className="max-h-12 max-w-48 object-contain object-left" />
                ) : (
                  <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-cream leading-tight hover:text-brew-200 transition-colors">{tenant.name}</h1>
                )}
              </Link>
            </div>

            {/* Table connected indicator or scan prompt - strictly aligned so no overlap */}
            <div className="flex-shrink-0">
              <AnimatePresence mode="wait">
                {activeTable ? (
                  <motion.div
                    key="table-connected"
                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`inline-flex items-center gap-2 backdrop-blur-sm
                               border rounded-full px-3.5 py-1.5 ${
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
                    <span className="text-cream text-xs sm:text-sm font-medium">
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
                    className="inline-flex min-h-[44px] items-center gap-2 backdrop-blur-sm bg-amber-500/20 border border-amber-400/40 rounded-full px-4 py-2 text-cream text-xs sm:text-sm font-medium hover:bg-amber-500/30 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <ScanLine size={15} className="text-amber-400" />
                    <span>Scan Table QR to Order</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {activeTable && <TableServiceActions />}

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
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-espresso-400 hover:text-espresso-700 focus:outline-none focus:ring-2 focus:ring-brew-500 rounded-full"
                aria-label="Clear search query"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            className={`flex min-h-[44px] items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brew-500
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
                  type="button"
                  onClick={() => setVegOnly(!vegOnly)}
                  className={`flex min-h-[44px] items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-green-500
                    ${vegOnly ? 'bg-green-600 text-white border-green-600' : 'border-foam text-espresso-700 bg-white'}`}
                >
                  <Leaf size={14} />
                  Veg Only
                </button>

                <div className="relative flex-1">
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                    aria-label="Sort menu items"
                    className="w-full min-h-[44px] text-xs border border-foam rounded-full px-3.5 py-2 bg-white
                               text-espresso-700 appearance-none pr-7 focus:outline-none focus:ring-2 focus:ring-brew-500"
                  >
                    {SORT_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso-400 pointer-events-none" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`flex-shrink-0 min-h-[44px] inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all border focus:outline-none focus:ring-2 focus:ring-brew-500
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
              type="button"
              onClick={() => setSelectedCategory(cat._id)}
              className={`flex-shrink-0 min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
                         transition-all border whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brew-500
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
          <div className="space-y-4">
            {isLongLoading && (
              <div className="mx-auto max-w-sm text-center py-2 px-4 text-xs font-medium text-amber-800 bg-amber-50 rounded-full border border-amber-200/80 shadow-sm animate-pulse">
                Waking up café server, please hold on a moment...
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        ) : menuError ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-3 border border-red-100">
              <AlertCircle size={26} />
            </div>
            <p className="font-display text-xl font-bold text-espresso-800">Couldn't load the menu</p>
            <p className="text-espresso-500 text-sm mt-1.5 max-w-md mx-auto">{menuError}</p>
            <button
              type="button"
              onClick={() => {
                clearClientCache();
                setLoading(true);
                setMenuError('');
                setReloadKey(k => k + 1);
              }}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 bg-espresso-900 hover:bg-espresso-800 text-cream rounded-full text-sm font-semibold shadow-md transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-brew-500"
            >
              <RotateCcw size={15} />
              <span>Retry</span>
            </button>
          </div>
        ) : products.length === 0 ? (
          debouncedSearch || vegOnly || sort || selectedCategory !== 'all' ? (
            <div className="text-center py-16">
              <span className="text-5xl" role="img" aria-label="Search icon">🔍</span>
              <p className="mt-4 font-display text-xl text-espresso-700">Nothing found</p>
              <p className="text-espresso-400 text-sm mt-1">Try a different search or filter</p>
              <button
                type="button"
                onClick={() => { setSearch(''); setVegOnly(false); setSort(''); setSelectedCategory('all'); }}
                className="mt-4 btn-secondary text-sm py-2 px-5 min-h-[44px] inline-flex items-center"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="text-center py-16 px-4">
              <span className="text-5xl" role="img" aria-label="Coffee cup">☕</span>
              <p className="mt-4 font-display text-xl font-bold text-espresso-800">Menu is being prepared</p>
              <p className="text-espresso-500 text-sm mt-1.5 max-w-md mx-auto">Please check back soon.</p>
            </div>
          )
        ) : (
          <motion.div
            layout
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            <AnimatePresence mode="popLayout">
              {products.map((product, idx) => (
                <MenuCard
                  key={product._id}
                  product={product}
                  priority={idx < 2}
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
          <Link
            to="/cart"
            aria-label={`View Cart with ${itemCount} items`}
            className="flex min-h-[48px] items-center justify-between gap-4 bg-espresso-900 text-cream
                       rounded-2xl pl-3 pr-5 py-3 font-medium shadow-2xl min-w-[180px] hover:bg-espresso-800 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-brew-500"
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
              ₹{grandTotal}
            </span>
          </Link>
        </motion.div>
      )}

      {/* Product modal — loaded lazily */}
      <AnimatePresence>
        {selectedProduct && (
          <Suspense fallback={null}>
            <ProductModal
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* QR Scanner modal — loaded lazily, keeps html5-qrcode out of initial bundle */}
      <AnimatePresence>
        {(showScanner || isScannerOpen) && (
          <Suspense fallback={null}>
            <QrScannerModal
              onClose={() => {
                setShowScanner(false);
                closeScanner();
              }}
              onTableFound={(tableNum, tableToken) => {
                setShowScanner(false);
                closeScanner();
                setTable(tableNum, tableToken);
                navigate(`/menu?tableToken=${encodeURIComponent(tableToken)}`, { replace: true });
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
