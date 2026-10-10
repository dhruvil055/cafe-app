import { useState, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  SlidersHorizontal,
  Leaf,
  Star,
  ChevronDown,
  X,
  AlertCircle,
  ScanLine,
  CheckCircle2,
  RotateCcw,
  Clock,
  MapPin,
  ShoppingBag,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
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
import { formatMoney } from '../../utils/money';

const ProductModal = lazy(() => import('../../components/menu/ProductModal'));
const QrScannerModal = lazy(() => import('../../components/ui/QrScannerModal'));

const SORT_OPTIONS = [
  { value: '', label: 'Featured / Default' },
  { value: 'popular', label: 'Most Popular First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function MenuPage() {
  const tenant = useTenant();
  usePageMeta(
    `${tenant.name || 'Café'} — Artisanal Menu & Table Ordering`,
    'Explore our freshly prepared specialty coffees, handcrafted beverages, gourmet snacks, and chef specials. Order directly from your table.'
  );
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableTokenParam = searchParams.get('token') || searchParams.get('tableToken');

  const {
    items,
    tableNumber,
    tableToken,
    setTable,
    setDiningSessionToken,
    openQuickCart,
    isScannerOpen,
    openScanner,
    closeScanner,
  } = useCartStore();

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
        } catch {
          // Ignore sessionStorage access errors
        }
        setTableConnectedAnim(true);
        setTimeout(() => setTableConnectedAnim(false), 3000);
      })
      .catch(() => {
        api.get('/tables/qr/validate', { params: { token: tableTokenParam } })
          .then(({ data }) => {
            if (!active || !data.valid) return;
            setTable(data.table.tableNumber, tableTokenParam);
            try {
              sessionStorage.setItem('cafe_table_token', tableTokenParam);
              sessionStorage.setItem('cafe_table_number', String(data.table.tableNumber));
            } catch {
              // Ignore sessionStorage access errors
            }
            setTableConnectedAnim(true);
            setTimeout(() => setTableConnectedAnim(false), 3000);
          })
          .catch(() => {
            try {
              sessionStorage.removeItem('cafe_table_token');
              sessionStorage.removeItem('cafe_table_number');
              sessionStorage.removeItem('cafe_table_id');
            } catch {
              // Ignore sessionStorage access errors
            }
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

  // Subscribe to real-time menu events
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
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Long loading indicator for cold starts
  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setIsLongLoading(true), 3000);
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

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts = { all: products.length };
    categories.forEach((cat) => {
      counts[cat._id] = products.filter(p => p.category === cat._id || p.category?._id === cat._id).length;
    });
    return counts;
  }, [categories, products]);

  const activeTable = tableNumber;

  return (
    <div className="min-h-screen bg-cream/90 flex flex-col">
      {/* ─── Hero Section ──────────────────────────────────────────────────────── */}
      <section
        aria-label="Café Overview & Details"
        className="relative bg-espresso-950 overflow-hidden text-cream"
      >
        {/* Background Visuals */}
        {tenant.slug === 'brewhaus' ? (
          <video
            className="absolute inset-0 z-0 h-full w-full object-cover opacity-60"
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
            className="absolute inset-0 z-0 h-full w-full object-cover opacity-65"
          />
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#160b06] via-[#241309] to-[#0d0603]" />
        )}

        {/* Multi-stage Luxury Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-espresso-950 via-espresso-950/60 to-black/35 z-0 pointer-events-none" />

        {/* Hero Content Container */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            {/* Café Branding & Hours */}
            <div className="space-y-3 max-w-2xl">
              {/* Tagline / Subtitle */}
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 border border-white/10 text-xs font-semibold text-brew-300">
                <Sparkles size={13} className="text-brew-400" />
                <span className="uppercase tracking-[0.16em]">{tenant.tagline || 'Artisanal Food & Fine Coffee'}</span>
              </div>

              {/* Title / Logo */}
              <div>
                {tenant.logoUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={tenant.logoUrl}
                      alt={tenant.name}
                      className="max-h-14 sm:max-h-16 w-auto object-contain object-left drop-shadow-md"
                    />
                    <h1 className="sr-only">{tenant.name} Menu</h1>
                  </div>
                ) : (
                  <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
                    {tenant.name}
                  </h1>
                )}
              </div>

              {/* Operational metadata (Hours & Location) */}
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-cream/75 pt-1">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Kitchen Open Today</span>
                </span>
                <span className="text-white/30">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={13} className="text-brew-400" />
                  <span>8:00 AM – 11:00 PM</span>
                </span>
                {tenant.address && (
                  <>
                    <span className="text-white/30 hidden sm:inline">•</span>
                    <span className="hidden sm:inline-flex items-center gap-1 text-cream/70 truncate max-w-xs">
                      <MapPin size={13} className="text-brew-400 shrink-0" />
                      <span className="truncate">{tenant.address}</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Table Connection Badge / Scan Prompt */}
            <div className="flex-shrink-0">
              <AnimatePresence mode="wait">
                {activeTable ? (
                  <motion.div
                    key="table-connected-hero"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    className={`inline-flex items-center gap-3 rounded-2xl p-2.5 sm:p-3 border backdrop-blur-xl transition-all ${
                      tableConnectedAnim
                        ? 'bg-emerald-950/70 border-emerald-400/80 text-emerald-100 ring-2 ring-emerald-400/40'
                        : 'bg-white/10 border-white/20 text-cream shadow-lg'
                    }`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-emerald-300/90 font-semibold">
                        Ordering Active
                      </p>
                      <p className="font-display text-base sm:text-lg font-bold text-white leading-tight">
                        Table {String(activeTable).padStart(2, '0')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openScanner}
                      className="ml-2 rounded-xl bg-white/15 hover:bg-white/25 px-2.5 py-1.5 text-xs font-medium text-cream transition"
                      title="Switch to another table"
                    >
                      Change
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="no-table-hero"
                    type="button"
                    onClick={openScanner}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="group inline-flex min-h-[48px] items-center gap-3 rounded-2xl bg-gradient-to-r from-brew-500 to-brew-600 px-4 sm:px-5 py-3 text-white shadow-xl shadow-brew-500/20 transition-all hover:from-brew-600 hover:to-brew-700 focus:outline-none focus:ring-2 focus:ring-brew-400"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white">
                      <ScanLine size={18} />
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/80 leading-none">
                        Dine-in Customer?
                      </p>
                      <p className="text-sm font-bold text-white leading-tight">
                        Scan Table QR to Order
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-white/80 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Optional Table Service actions when sitting at table */}
      {activeTable && <TableServiceActions />}

      {/* ─── Sticky Search, Categories & Filter Header ───────────────────────── */}
      <section
        aria-label="Menu Filters & Categories"
        className="sticky top-[58px] sm:top-[65px] z-30 bg-cream/95 backdrop-blur-xl border-b border-foam/90 px-3.5 py-2.5 sm:px-6 sm:py-3 shadow-xs space-y-2.5"
      >
        <div className="mx-auto max-w-7xl">
          {/* Search bar + Filter toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-espresso-400 pointer-events-none"
              />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search food, coffee & beverages..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-10 pr-9 py-2.5 text-sm rounded-2xl bg-white shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-espresso-400 hover:text-espresso-800 transition rounded-full"
                  aria-label="Clear search query"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Veg Only Toggle Pill */}
            <button
              type="button"
              onClick={() => setVegOnly(!vegOnly)}
              aria-pressed={vegOnly}
              className={`min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all active:scale-95 whitespace-nowrap shadow-2xs ${
                vegOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20'
                  : 'bg-white text-espresso-800 border-espresso-200/80 hover:border-espresso-300'
              }`}
            >
              <Leaf size={14} className={vegOnly ? 'text-white' : 'text-emerald-600'} />
              <span>Veg</span>
            </button>

            {/* Filter / Sort Button */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              aria-label="Toggle menu sorting and options"
              className={`min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-all active:scale-95 shadow-2xs ${
                showFilters || sort
                  ? 'bg-espresso-900 text-cream border-espresso-900'
                  : 'bg-white text-espresso-800 border-espresso-200/80 hover:border-espresso-300'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span className="hidden sm:inline">Sort</span>
            </button>
          </div>

          {/* Expandable Sort & Filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pt-2"
              >
                <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-white border border-foam">
                  <span className="text-xs font-semibold text-espresso-500 px-2">Sort by:</span>
                  <div className="relative flex-1 min-w-[180px]">
                    <select
                      value={sort}
                      onChange={e => setSort(e.target.value)}
                      aria-label="Sort menu items"
                      className="w-full min-h-[40px] text-xs font-medium border border-foam rounded-xl px-3 py-2 bg-cream/50 text-espresso-800 appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-brew-500"
                    >
                      {SORT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso-400 pointer-events-none" />
                  </div>
                  {(vegOnly || sort || search) && (
                    <button
                      type="button"
                      onClick={() => { setVegOnly(false); setSort(''); setSearch(''); }}
                      className="text-xs font-semibold text-brew-700 hover:text-espresso-950 px-2 py-1 transition"
                    >
                      Reset all
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Horizontally scrollable Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1.5 scrollbar-hide -mx-1 px-1">
            {/* All category tab */}
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`relative flex-shrink-0 min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 border ${
                selectedCategory === 'all'
                  ? 'bg-espresso-900 text-cream border-espresso-900 shadow-sm'
                  : 'bg-white text-espresso-700 border-foam/90 hover:border-espresso-300'
              }`}
            >
              <span>All Items</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-foam text-espresso-600'
              }`}>
                {categoryCounts.all || 0}
              </span>
            </button>

            {/* Individual categories */}
            {categories.map((cat) => {
              const count = categoryCounts[cat._id] || 0;
              const isSelected = selectedCategory === cat._id;
              return (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => setSelectedCategory(cat._id)}
                  className={`relative flex-shrink-0 min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 border whitespace-nowrap ${
                    isSelected
                      ? 'bg-espresso-900 text-cream border-espresso-900 shadow-sm'
                      : 'bg-white text-espresso-700 border-foam/90 hover:border-espresso-300'
                  }`}
                >
                  {cat.icon && <span className="text-sm leading-none">{cat.icon}</span>}
                  <span>{cat.name}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-foam text-espresso-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Product Menu Grid ─────────────────────────────────────────────────── */}
      <main
        id="menu-catalog"
        className={`flex-1 mx-auto max-w-7xl w-full px-3.5 py-5 sm:px-6 lg:px-8 ${
          itemCount > 0 ? 'pb-32 sm:pb-28' : 'pb-16'
        }`}
      >
        {loading ? (
          /* Loading Skeleton Grid */
          <div className="space-y-4">
            {isLongLoading && (
              <div className="mx-auto max-w-md text-center py-2 px-4 text-xs font-medium text-amber-900 bg-amber-50 rounded-full border border-amber-200/80 shadow-xs animate-pulse">
                ☕ Connecting to café kitchen, fetching live menu...
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        ) : menuError ? (
          /* Error State */
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-red-50 flex items-center justify-center text-red-500 mb-4 border border-red-100 shadow-sm">
              <AlertCircle size={30} />
            </div>
            <h2 className="font-display text-2xl font-bold text-espresso-900">Unable to load the menu</h2>
            <p className="text-espresso-500 text-sm mt-1.5 max-w-md mx-auto">{menuError}</p>
            <button
              type="button"
              onClick={() => {
                clearClientCache();
                setLoading(true);
                setMenuError('');
                setReloadKey(k => k + 1);
              }}
              className="mt-6 inline-flex min-h-[44px] items-center gap-2 px-6 py-2.5 bg-espresso-900 hover:bg-espresso-800 text-cream rounded-full text-sm font-bold shadow-md transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-brew-500"
            >
              <RotateCcw size={16} />
              <span>Try Again</span>
            </button>
          </div>
        ) : products.length === 0 ? (
          /* Empty Search / Filter State */
          debouncedSearch || vegOnly || sort || selectedCategory !== 'all' ? (
            <div className="text-center py-20 px-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-foam flex items-center justify-center text-3xl mb-3 shadow-inner">
                🔍
              </div>
              <h2 className="font-display text-2xl font-bold text-espresso-900">No matches found</h2>
              <p className="text-espresso-500 text-sm mt-1 max-w-sm mx-auto">
                We couldn&apos;t find any items matching &ldquo;{debouncedSearch || 'current filter'}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => { setSearch(''); setVegOnly(false); setSort(''); setSelectedCategory('all'); }}
                className="mt-5 btn-secondary text-xs uppercase tracking-wider py-2.5 px-6"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="text-center py-20 px-4">
              <span className="text-5xl" role="img" aria-label="Coffee cup">☕</span>
              <h2 className="mt-4 font-display text-2xl font-bold text-espresso-900">Fresh menu arriving shortly</h2>
              <p className="text-espresso-500 text-sm mt-1.5 max-w-md mx-auto">
                The café team is currently updating available items. Please check back in a few moments.
              </p>
            </div>
          )
        ) : (
          /* Products Grid */
          <motion.div
            layout
            className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
          >
            <AnimatePresence mode="popLayout">
              {products.map((product, idx) => (
                <MenuCard
                  key={product._id}
                  product={product}
                  priority={idx < 4}
                  onSelect={() => setSelectedProduct(product)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* ─── Mobile Sticky Cart Floating Bar ──────────────────────────────────── */}
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-4 left-3.5 right-3.5 sm:left-auto sm:right-6 sm:w-96 z-40"
          >
            <Link
              to="/cart"
              aria-label={`View Cart with ${itemCount} items`}
              className="flex min-h-[52px] items-center justify-between gap-3 bg-espresso-950 text-cream
                         rounded-2xl pl-3.5 pr-4 py-3 shadow-[0_16px_36px_rgba(20,10,5,0.28)] border border-espresso-800/80 hover:bg-espresso-900 transition-all active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-brew-500"
            >
              {/* Left Item Count & Subtotal */}
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brew-500 text-xs font-bold text-white shadow-xs">
                  {itemCount}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cream/90 leading-none">
                    View Cart
                  </span>
                  <span className="text-[10px] text-cream/50 mt-0.5">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'} ready
                  </span>
                </div>
              </div>

              {/* Right Total & Arrow */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-brew-300">
                  {formatMoney(grandTotal, tenant.currency)}
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white">
                  <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Details Customization Modal */}
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

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {(showScanner || isScannerOpen) && (
          <Suspense fallback={null}>
            <QrScannerModal
              onClose={() => {
                setShowScanner(false);
                closeScanner();
              }}
              onTableFound={(tableNum, token) => {
                setShowScanner(false);
                closeScanner();
                setTable(tableNum, token);
                navigate(`/menu?tableToken=${encodeURIComponent(token)}`, { replace: true });
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
