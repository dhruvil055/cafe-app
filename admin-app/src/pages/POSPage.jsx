import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, PauseCircle, PlayCircle,
  Printer, CheckCircle2, AlertCircle, Wifi, WifiOff, X, CreditCard,
  Banknote, QrCode, Split, User, Phone, Tag, Clock, RefreshCw, Loader2,
  UtensilsCrossed, Store, Sparkles, ChevronDown, Flame, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { formatMoney } from '../utils/money';
import ImageWithFallback from '../components/common/ImageWithFallback';
import {
  saveOfflineOrder,
  getPendingOfflineOrders,
  removeOfflineOrder,
  cacheCatalog,
  getCachedCatalog,
} from '../utils/posOfflineStorage';

const STATIONS = ['ALL', 'KITCHEN', 'BAR', 'BAKERY', 'DESSERT'];
const ORDER_TYPES = [
  { id: 'counter', label: 'Counter ⚡' },
  { id: 'dine_in', label: 'Dine-in 🍽️' },
  { id: 'takeaway', label: 'Takeaway 🛍️' },
  { id: 'delivery', label: 'Delivery 🛵' },
];

export default function POSPage() {
  const tenant = useTenant();
  const currency = tenant?.currency || '₹';

  // Catalog State
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Cart / Current Order State
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('counter');
  const [tableNumber, setTableNumber] = useState('');
  const [tables, setTables] = useState([]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [manualDiscount, setManualDiscount] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Modals & UI States
  const [activeProductForModifier, setActiveProductForModifier] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [modifierNote, setModifierNote] = useState('');
  const [modifierQty, setModifierQty] = useState(1);

  const [heldOrders, setHeldOrders] = useState([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitCashAmount, setSplitCashAmount] = useState('');
  const [splitUpiAmount, setSplitUpiAmount] = useState('');
  const [splitCardAmount, setSplitCardAmount] = useState('');

  const [lastReceipt, setLastReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [processingOrder, setProcessingOrder] = useState(false);

  // Connectivity
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);

  // Sync offline connectivity status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Internet restored. Syncing offline orders...');
      syncPendingOfflineOrders();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Offline mode: Orders will be queued and synced automatically.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    checkPendingOfflineQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkPendingOfflineQueue = async () => {
    try {
      const pending = await getPendingOfflineOrders();
      setPendingSyncCount(pending.length);
    } catch (_err) {}
  };

  const syncPendingOfflineOrders = async () => {
    if (!navigator.onLine || syncingOffline) return;
    setSyncingOffline(true);
    setSyncFailed(false);
    try {
      const pending = await getPendingOfflineOrders();
      if (pending.length === 0) {
        setPendingSyncCount(0);
        return;
      }

      const { data } = await api.post('/pos/sync', { orders: pending });
      if (data.synced && Array.isArray(data.synced)) {
        for (const item of data.synced) {
          await removeOfflineOrder(item.syncId);
        }
        toast.success(`Successfully synced ${data.synced.length} offline order(s)!`);
      }
      if (data.failed && data.failed.length > 0) {
        setSyncFailed(true);
        toast.error(`${data.failed.length} offline order(s) failed to sync.`);
      }
      await checkPendingOfflineQueue();
    } catch (err) {
      console.warn('[POS Sync Error]:', err.message);
      setSyncFailed(true);
      toast.error('Sync failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSyncingOffline(false);
    }
  };

  // Fetch Menu, Tables, and Held orders (FIX BUG 3: use /menu instead of 404 /menu/all)
  const loadInitialData = async () => {
    setLoadingCatalog(true);
    try {
      const [catsRes, prodsRes, tablesRes, heldRes] = await Promise.all([
        api.get('/categories/all').catch(() => api.get('/categories')).catch(() => ({ data: { categories: [] } })),
        api.get('/menu').catch(() => ({ data: { products: [] } })),
        api.get('/tables/all').catch(() => ({ data: { tables: [] } })),
        api.get('/pos/held-orders').catch(() => ({ data: { orders: [] } })),
      ]);

      const catList = catsRes.data?.categories || (Array.isArray(catsRes.data) ? catsRes.data : []);
      const prodList = prodsRes.data?.products || (Array.isArray(prodsRes.data) ? prodsRes.data : []);

      setCategories(catList);
      setProducts(prodList);
      setTables(tablesRes.data?.tables || []);
      setHeldOrders(heldRes.data?.orders || []);

      // Cache for offline usage
      await cacheCatalog(catList, prodList);
    } catch (err) {
      const cached = await getCachedCatalog();
      if (cached.products.length > 0) {
        setCategories(cached.categories);
        setProducts(cached.products);
        toast('Loaded menu from offline cache', { icon: '📦' });
      } else {
        toast.error('Unable to load menu. Please check connection.');
      }
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (selectedCategory !== 'ALL' && String(prod.category?._id || prod.category) !== selectedCategory) {
        return false;
      }
      if (selectedStation !== 'ALL' && prod.kitchenStation !== selectedStation) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = prod.name.toLowerCase().includes(q);
        const matchesSku = prod.sku?.toLowerCase().includes(q);
        return matchesName || matchesSku;
      }
      return true;
    });
  }, [products, selectedCategory, selectedStation, searchQuery]);

  // Cart Management
  const handleProductClick = (prod) => {
    const hasVariants = prod.variants && prod.variants.length > 0;
    const hasAddons = prod.addons && prod.addons.length > 0;

    if (hasVariants || hasAddons) {
      setActiveProductForModifier(prod);
      setSelectedVariant(hasVariants ? prod.variants[0] : null);
      setSelectedAddons([]);
      setModifierNote('');
      setModifierQty(1);
    } else {
      addToCartDirect(prod);
    }
  };

  const addToCartDirect = (prod, qty = 1, variant = null, addons = [], notes = '') => {
    const variantPrice = variant ? variant.price : prod.price;
    const addonsPrice = addons.reduce((sum, a) => sum + (a.price || 0), 0);
    const unitPrice = variantPrice + addonsPrice;

    const cartKey = `${prod._id}_${variant?._id || 'novar'}_${addons.map(a => a._id).sort().join('-')}_${notes}`;

    setCart((prev) => {
      const existingIdx = prev.findIndex(item => item.cartKey === cartKey);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += qty;
        updated[existingIdx].itemTotal = Number((updated[existingIdx].quantity * unitPrice).toFixed(2));
        return updated;
      }
      return [
        ...prev,
        {
          cartKey,
          productId: prod._id,
          name: prod.name,
          image: prod.image,
          unitPrice,
          quantity: qty,
          variant,
          addons,
          specialInstructions: notes,
          itemTotal: Number((qty * unitPrice).toFixed(2)),
          kitchenStation: prod.kitchenStation || 'KITCHEN',
        },
      ];
    });
  };

  const handleConfirmModifier = () => {
    if (!activeProductForModifier) return;
    addToCartDirect(
      activeProductForModifier,
      modifierQty,
      selectedVariant,
      selectedAddons,
      modifierNote
    );
    setActiveProductForModifier(null);
  };

  const updateCartQty = (cartKey, delta) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.cartKey === cartKey) {
            const newQty = item.quantity + delta;
            return newQty > 0
              ? { ...item, quantity: newQty, itemTotal: Number((newQty * item.unitPrice).toFixed(2)) }
              : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const removeCartItem = (cartKey) => {
    setCart(prev => prev.filter(item => item.cartKey !== cartKey));
  };

  const clearCart = () => {
    setCart([]);
    setTableNumber('');
    setCustomerPhone('');
    setCustomerName('');
    setCustomerGstin('');
    setManualDiscount('');
    setCouponCode('');
    setOrderNotes('');
  };

  // Pricing & Tax Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.itemTotal, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const manual = Number(manualDiscount) || 0;
    return Math.min(manual, subtotal);
  }, [manualDiscount, subtotal]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxRate = Number(tenant?.settings?.taxRate ?? 5);
  const taxAmount = Number(((taxableAmount * taxRate) / 100).toFixed(2));
  const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));

  // Customer phone lookup
  const handlePhoneChange = async (val) => {
    setCustomerPhone(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length === 10 && isOnline) {
      try {
        const { data } = await api.get(`/customers/lookup?phone=${clean}`).catch(() => ({ data: null }));
        if (data?.customer?.name) {
          setCustomerName(data.customer.name);
          toast.success(`Welcome back, ${data.customer.name}!`);
        }
      } catch (_err) {}
    }
  };

  // Hold Order
  const handleHoldOrder = async () => {
    if (cart.length === 0) {
      toast.error('Add items to hold this order');
      return;
    }

    try {
      const payload = {
        tableNumber: Number(tableNumber) || 0,
        orderType,
        customer: { name: customerName, phone: customerPhone },
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variant?._id,
          addonIds: item.addons.map(a => a._id),
          specialInstructions: item.specialInstructions,
        })),
        notes: orderNotes,
      };

      const { data } = await api.post('/pos/orders/hold', payload);
      setHeldOrders(prev => [data.order, ...prev]);
      clearCart();
      toast.success('Order held successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to hold order');
    }
  };

  // Resume Held Order
  const handleResumeHeldOrder = (held) => {
    setOrderType(held.orderType || 'counter');
    setTableNumber(held.tableNumber ? String(held.tableNumber) : '');
    setCustomerName(held.customer?.name || '');
    setCustomerPhone(held.customer?.phone || '');
    setOrderNotes(held.notes || '');

    const restoredCart = held.items.map(item => ({
      cartKey: `${item.product?._id || item.product}_${Date.now()}_${Math.random()}`,
      productId: item.product?._id || item.product,
      name: item.name,
      image: item.image,
      unitPrice: item.price,
      quantity: item.quantity,
      variant: item.variant,
      addons: item.addons || [],
      specialInstructions: item.specialInstructions || '',
      itemTotal: item.itemTotal || (item.price * item.quantity),
      kitchenStation: 'KITCHEN',
    }));

    setCart(restoredCart);
    setShowHeldModal(false);
    api.delete(`/pos/held-orders/${held._id}`).catch(() => {});
    setHeldOrders(prev => prev.filter(o => o._id !== held._id));
    toast.success('Held order resumed');
  };

  // Submit Order & Process Payment
  const handleCheckout = async (paymentMethod, splitPayments = []) => {
    if (cart.length === 0) {
      toast.error('Add items to the cart');
      return;
    }

    if (orderType === 'dine_in' && !tableNumber) {
      toast.error('Please specify a Table number for Dine-in orders');
      return;
    }

    setProcessingOrder(true);
    const syncId = `pos_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const orderPayload = {
      tableNumber: Number(tableNumber) || 0,
      orderType,
      customer: {
        name: customerName || 'Walk-in Customer',
        phone: customerPhone || '9999999999',
      },
      customerGstin: customerGstin.trim().toUpperCase(),
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        variantId: item.variant?._id,
        addonIds: item.addons.map(a => a._id),
        specialInstructions: item.specialInstructions,
      })),
      paymentMethod,
      splitPayments,
      manualDiscount: discountAmount,
      couponCode,
      notes: orderNotes,
      autoComplete: true,
      isPaid: true,
      syncId,
    };

    if (!isOnline) {
      try {
        await saveOfflineOrder(orderPayload);
        await checkPendingOfflineQueue();
        toast.success('Order recorded offline! Will sync automatically when connected.', { icon: '💾' });
        clearCart();
      } catch (err) {
        toast.error('Failed to store offline order: ' + err.message);
      } finally {
        setProcessingOrder(false);
      }
      return;
    }

    try {
      const { data } = await api.post('/pos/orders', orderPayload);
      toast.success(`Order #${data.order.orderNumber} confirmed!`, { icon: '✅' });
      setLastReceipt(data.receipt || { order: data.order });
      setShowReceiptModal(true);
      clearCart();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Checkout failed');
    } finally {
      setProcessingOrder(false);
    }
  };

  // Handle Split Payment Submit
  const handleConfirmSplitPayment = () => {
    const cash = Number(splitCashAmount) || 0;
    const upi = Number(splitUpiAmount) || 0;
    const card = Number(splitCardAmount) || 0;
    const splitSum = cash + upi + card;

    if (Math.abs(splitSum - totalAmount) > 0.01) {
      toast.error(`Split amounts (₹${splitSum}) must equal total (₹${totalAmount})`);
      return;
    }

    const splits = [];
    if (cash > 0) splits.push({ method: 'cash', amount: cash });
    if (upi > 0) splits.push({ method: 'upi', amount: upi });
    if (card > 0) splits.push({ method: 'card', amount: card });

    setShowSplitModal(false);
    handleCheckout('split', splits);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] overflow-hidden bg-stone-100 -m-4 sm:-m-6 lg:-m-8">
      {/* ── Top Bar: Order Type Segmented Control + Status Badges ──── */}
      <div className="bg-espresso-950 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
          {/* Order Type Segmented Control */}
          <div className="flex bg-espresso-900 rounded-xl p-1 border border-espresso-800">
            {ORDER_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setOrderType(type.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap min-h-[36px] ${
                  orderType === type.id
                    ? 'bg-brew-500 text-white shadow-sm'
                    : 'text-espresso-200 hover:text-white'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Held Orders Quick Launcher */}
          {heldOrders.length > 0 && (
            <button
              onClick={() => setShowHeldModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-espresso-950 shadow-sm hover:bg-amber-400 transition min-h-[36px]"
            >
              <PauseCircle size={15} />
              <span>{heldOrders.length} Held Orders</span>
            </button>
          )}
        </div>

        {/* Sync & Online Status Pill */}
        <div className="flex items-center gap-2 text-xs">
          {pendingSyncCount > 0 ? (
            <button
              onClick={syncPendingOfflineOrders}
              disabled={syncingOffline || !isOnline}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition min-h-[36px]"
              title="Click to sync offline orders now"
            >
              <RefreshCw size={13} className={syncingOffline ? 'animate-spin' : ''} />
              <span>{pendingSyncCount} queued ({syncingOffline ? 'Syncing...' : 'Sync Now'})</span>
            </button>
          ) : !isOnline ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse min-h-[36px]">
              <WifiOff size={13} />
              <span>OFFLINE (Saved Locally)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 min-h-[36px]">
              <Wifi size={13} />
              <span>ONLINE</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main 3-Pane POS Workstation ─────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* PANE 1: Category Rail (Leftmost) */}
        <div className="w-full md:w-48 lg:w-56 shrink-0 bg-white border-r border-stone-200 flex flex-col overflow-hidden">
          {/* Station Selector */}
          <div className="p-3 border-b border-stone-100 bg-stone-50/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
              Kitchen Station
            </span>
            <div className="flex flex-wrap gap-1">
              {STATIONS.map(st => (
                <button
                  key={st}
                  onClick={() => setSelectedStation(st)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                    selectedStation === st
                      ? 'bg-espresso-900 text-white shadow-2xs'
                      : 'bg-stone-200/70 text-stone-600 hover:bg-stone-300/70'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Categories List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-sidebar-scroll">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                selectedCategory === 'ALL'
                  ? 'bg-brew-500 text-white shadow-sm'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <span>All Products</span>
              <span className="text-[10px] opacity-80">{products.length}</span>
            </button>

            {categories.map(cat => {
              const count = products.filter(p => String(p.category?._id || p.category) === String(cat._id)).length;
              const isSelected = selectedCategory === String(cat._id);
              return (
                <button
                  key={cat._id}
                  onClick={() => setSelectedCategory(String(cat._id))}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-brew-500 text-white shadow-sm font-bold'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span>{cat.icon || '☕'}</span>
                    <span className="truncate">{cat.name}</span>
                  </div>
                  <span className="text-[10px] opacity-75 font-mono">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PANE 2: Product Grid with Instant Search (Middle) */}
        <div className="flex-1 flex flex-col min-w-0 bg-stone-50 border-r border-stone-200 overflow-hidden">
          {/* Instant Search Bar */}
          <div className="p-3 bg-white border-b border-stone-200 flex items-center gap-2 shrink-0">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-3 text-stone-400" />
              <input
                type="text"
                placeholder="Search dish name, ingredients or SKU (e.g. Latte, Croissant)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-stone-100 rounded-xl text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brew-500/20 border border-stone-200"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-2 text-stone-400 hover:text-stone-700"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 auto-rows-max custom-sidebar-scroll">
            {loadingCatalog ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-stone-400">
                <Loader2 className="animate-spin mb-2" size={32} />
                <span className="text-xs">Loading fresh catalog...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-20 text-center text-stone-400 text-xs flex flex-col items-center gap-2">
                <UtensilsCrossed size={32} className="text-stone-300" />
                <span>No matching menu items found in this section.</span>
              </div>
            ) : (
              filteredProducts.map(prod => {
                const hasVariants = prod.variants && prod.variants.length > 0;
                const isAvail = prod.available !== false;

                return (
                  <button
                    key={prod._id}
                    onClick={() => isAvail && handleProductClick(prod)}
                    disabled={!isAvail}
                    className={`flex flex-col text-left rounded-2xl border transition-all overflow-hidden bg-white shadow-2xs hover:shadow-md active:scale-98 relative group ${
                      !isAvail ? 'opacity-50 cursor-not-allowed border-stone-200' : 'border-stone-200/90 hover:border-brew-400'
                    }`}
                  >
                    {/* Food Image */}
                    <div className="relative h-28 w-full bg-stone-100 overflow-hidden">
                      <ImageWithFallback
                        src={prod.image}
                        alt={prod.name}
                        fallbackText={prod.name}
                        className="h-full w-full"
                      />

                      {/* Veg Badge */}
                      <span className="absolute top-2 left-2 flex h-4 w-4 items-center justify-center rounded-[4px] border border-emerald-600 bg-white/90 p-[2px]" title="100% Vegetarian">
                        <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      </span>

                      {/* Variants Tag */}
                      {hasVariants && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-stone-900/80 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white">
                          {prod.variants.length} Sizes
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div className="font-semibold text-xs text-stone-900 line-clamp-2 leading-tight">
                        {prod.name}
                      </div>

                      <div className="mt-2 flex items-center justify-between pt-1 border-t border-stone-100">
                        <span className="font-extrabold text-sm text-espresso-950 font-mono">
                          {formatMoney(prod.price, currency)}
                        </span>
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brew-50 text-brew-700 font-bold text-xs group-hover:bg-brew-500 group-hover:text-white transition">
                          <Plus size={14} />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* PANE 3: Persistent Cart & Charge Button (Right) */}
        <div className="w-full md:w-80 lg:w-96 shrink-0 bg-white border-l border-stone-200 flex flex-col h-full overflow-hidden shadow-lg">
          {/* Order Meta Form (Table & Customer) */}
          <div className="p-3 bg-stone-50/80 border-b border-stone-200 space-y-2.5 shrink-0">
            <div className="flex gap-2">
              {/* Table Selector */}
              {orderType === 'dine_in' ? (
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">Table *</label>
                  <select
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                    className="w-full bg-white rounded-xl border border-stone-300 py-1.5 px-2.5 text-xs font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-brew-500"
                  >
                    <option value="">Select Table</option>
                    {tables.map(t => (
                      <option key={t._id || t.number} value={t.number}>
                        Table {t.number} ({t.name || `Seats ${t.seats || 4}`})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">Mode</label>
                  <div className="w-full bg-stone-200/80 rounded-xl py-1.5 px-2.5 text-xs font-bold text-stone-700 capitalize">
                    {orderType.replace('_', ' ')} Order
                  </div>
                </div>
              )}

              {/* Customer Mobile */}
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">Customer Mobile</label>
                <div className="relative">
                  <Phone size={12} className="absolute left-2.5 top-2 text-stone-400" />
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={customerPhone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    className="w-full bg-white rounded-xl border border-stone-300 py-1.5 pl-7 pr-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-1 focus:ring-brew-500"
                  />
                </div>
              </div>
            </div>

            {/* Customer Name if known */}
            {customerName && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded-lg">
                <Check size={12} />
                <span>Customer: {customerName}</span>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-sidebar-scroll">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-stone-400 p-6 space-y-2">
                <ShoppingCart size={36} className="text-stone-300" />
                <div className="font-semibold text-xs text-stone-600">Cart is empty</div>
                <div className="text-[11px] text-stone-400">Tap items on the left to add them to this ticket.</div>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.cartKey}
                  className="rounded-2xl border border-stone-200 bg-stone-50/50 p-2.5 space-y-1.5 transition hover:bg-stone-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-stone-900 truncate">{item.name}</div>
                      {item.variant && (
                        <div className="text-[10px] text-amber-700 font-medium">Size: {item.variant.name}</div>
                      )}
                      {item.addons && item.addons.length > 0 && (
                        <div className="text-[10px] text-stone-500">
                          +{item.addons.map(a => a.name).join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-xs text-stone-900 font-mono">
                        {formatMoney(item.itemTotal, currency)}
                      </div>
                    </div>
                  </div>

                  {/* Quantity Controls (48px Touch Target) */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-200/60">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateCartQty(item.cartKey, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 active:scale-95 transition"
                        title="Decrease"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-8 text-center font-bold text-xs font-mono text-stone-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.cartKey, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 active:scale-95 transition"
                        title="Increase"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <button
                      onClick={() => removeCartItem(item.cartKey)}
                      className="p-1.5 text-stone-400 hover:text-red-600 transition"
                      title="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Master Charge Button */}
          <div className="p-3.5 bg-stone-50 border-t border-stone-200 space-y-3 shrink-0">
            {/* Quick Discount Presets */}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-stone-500 mr-1 font-semibold">Discount:</span>
              <button
                onClick={() => setManualDiscount(String(Math.round(subtotal * 0.05)))}
                className="px-2 py-0.5 rounded-md bg-stone-200 text-stone-700 font-semibold hover:bg-stone-300"
              >
                5%
              </button>
              <button
                onClick={() => setManualDiscount(String(Math.round(subtotal * 0.10)))}
                className="px-2 py-0.5 rounded-md bg-stone-200 text-stone-700 font-semibold hover:bg-stone-300"
              >
                10%
              </button>
              <button
                onClick={() => setManualDiscount('50')}
                className="px-2 py-0.5 rounded-md bg-stone-200 text-stone-700 font-semibold hover:bg-stone-300"
              >
                ₹50
              </button>
              {discountAmount > 0 && (
                <button
                  onClick={() => setManualDiscount('')}
                  className="text-red-500 ml-auto font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal</span>
                <span className="font-mono">{formatMoney(subtotal, currency)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span className="font-mono">-{formatMoney(discountAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-500 text-[11px]">
                <span>GST ({taxRate}%)</span>
                <span className="font-mono">+{formatMoney(taxAmount, currency)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-stone-900 pt-1.5 border-t border-stone-200">
                <span>Total Payable</span>
                <span className="text-brew-700 font-mono">{formatMoney(totalAmount, currency)}</span>
              </div>
            </div>

            {/* Master High-Contrast Action Buttons */}
            <div className="space-y-2 pt-1">
              {/* Master CHARGE CTA */}
              <button
                onClick={() => handleCheckout('cash')}
                disabled={cart.length === 0 || processingOrder}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-espresso-950 hover:bg-black text-white font-extrabold shadow-md transition active:scale-98 disabled:opacity-50 min-h-[48px]"
              >
                <span className="text-xs uppercase tracking-wider text-amber-400">Confirm Order</span>
                <span className="text-base font-mono">Charge {formatMoney(totalAmount, currency)} →</span>
              </button>

              {/* 4 High-Contrast Payment Method Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleCheckout('cash')}
                  disabled={cart.length === 0 || processingOrder}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 disabled:opacity-50 transition active:scale-95 shadow-2xs min-h-[48px]"
                >
                  <Banknote size={16} />
                  <span className="text-[10px] mt-0.5">Cash</span>
                </button>
                <button
                  onClick={() => handleCheckout('upi')}
                  disabled={cart.length === 0 || processingOrder}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-purple-700 text-white font-bold hover:bg-purple-800 disabled:opacity-50 transition active:scale-95 shadow-2xs min-h-[48px]"
                >
                  <QrCode size={16} />
                  <span className="text-[10px] mt-0.5">UPI</span>
                </button>
                <button
                  onClick={() => handleCheckout('card')}
                  disabled={cart.length === 0 || processingOrder}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-blue-700 text-white font-bold hover:bg-blue-800 disabled:opacity-50 transition active:scale-95 shadow-2xs min-h-[48px]"
                >
                  <CreditCard size={16} />
                  <span className="text-[10px] mt-0.5">Card</span>
                </button>
                <button
                  onClick={() => {
                    setSplitCashAmount('');
                    setSplitUpiAmount('');
                    setSplitCardAmount('');
                    setShowSplitModal(true);
                  }}
                  disabled={cart.length === 0 || processingOrder}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-stone-800 text-white font-bold hover:bg-stone-900 disabled:opacity-50 transition active:scale-95 shadow-2xs min-h-[48px]"
                >
                  <Split size={16} />
                  <span className="text-[10px] mt-0.5">Split</span>
                </button>
              </div>

              {/* Hold & Clear */}
              <div className="flex gap-2 pt-1 text-xs">
                <button
                  onClick={handleHoldOrder}
                  disabled={cart.length === 0}
                  className="flex-1 py-1.5 rounded-xl border border-stone-300 font-semibold text-stone-700 bg-white hover:bg-stone-100 disabled:opacity-50 transition"
                >
                  Hold Order
                </button>
                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="px-4 py-1.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 font-semibold disabled:opacity-50 transition"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals: Modifiers / Held / Split / Receipt ─────────────── */}
      {/* 1. Modifier Bottom Sheet */}
      {activeProductForModifier && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-display text-lg font-bold text-stone-900">{activeProductForModifier.name}</h3>
                <p className="text-xs text-stone-500">Select variant and optional add-ons</p>
              </div>
              <button onClick={() => setActiveProductForModifier(null)} className="p-1 text-stone-400 hover:text-stone-700">
                <X size={18} />
              </button>
            </div>

            {/* Variants */}
            {activeProductForModifier.variants?.length > 0 && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-600 block mb-2">Sizes / Variants</span>
                <div className="grid grid-cols-2 gap-2">
                  {activeProductForModifier.variants.map((v) => (
                    <button
                      key={v._id || v.name}
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition ${
                        selectedVariant?.name === v.name
                          ? 'border-brew-600 bg-brew-50 text-brew-900 ring-2 ring-brew-500/20'
                          : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <div className="truncate">{v.name}</div>
                      <div className="font-bold text-stone-900 font-mono mt-0.5">{formatMoney(v.price, currency)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add-ons */}
            {activeProductForModifier.addons?.length > 0 && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-600 block mb-2">Add-ons & Extras</span>
                <div className="grid grid-cols-2 gap-2">
                  {activeProductForModifier.addons.map((addon) => {
                    const isChecked = selectedAddons.some(a => a._id === addon._id);
                    return (
                      <button
                        key={addon._id || addon.name}
                        onClick={() => {
                          setSelectedAddons(prev =>
                            isChecked ? prev.filter(a => a._id !== addon._id) : [...prev, addon]
                          );
                        }}
                        className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition ${
                          isChecked
                            ? 'border-brew-600 bg-brew-50 text-brew-900'
                            : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{addon.name}</span>
                          {isChecked && <Check size={14} className="text-brew-600 shrink-0" />}
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono">+{formatMoney(addon.price || 0, currency)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special Instruction */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-600 block mb-1">Kitchen Note</label>
              <input
                type="text"
                placeholder="e.g. Extra hot, oat milk, no sugar..."
                value={modifierNote}
                onChange={e => setModifierNote(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-1 focus:ring-brew-500"
              />
            </div>

            <button
              onClick={handleConfirmModifier}
              className="w-full py-3 rounded-2xl bg-espresso-950 hover:bg-black text-white font-bold text-xs uppercase tracking-wider shadow-md transition"
            >
              Add to Ticket
            </button>
          </div>
        </div>
      )}

      {/* 2. Held Orders Modal */}
      {showHeldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-display text-lg font-bold text-stone-900">Held Orders ({heldOrders.length})</h3>
              <button onClick={() => setShowHeldModal(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              {heldOrders.map((held) => (
                <div key={held._id} className="p-3 rounded-2xl border border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-stone-900">
                      {held.orderType.toUpperCase()} {held.tableNumber ? `· Table ${held.tableNumber}` : ''}
                    </div>
                    <div className="text-[11px] text-stone-500">{held.items?.length} items · {held.customer?.name || 'Walk-in'}</div>
                  </div>
                  <button
                    onClick={() => handleResumeHeldOrder(held)}
                    className="px-3 py-1.5 rounded-xl bg-brew-600 text-white font-bold text-xs hover:bg-brew-700 transition"
                  >
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Split Payment Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-display text-lg font-bold text-stone-900">Split Payment</h3>
                <p className="text-xs text-stone-500">Total Due: {formatMoney(totalAmount, currency)}</p>
              </div>
              <button onClick={() => setShowSplitModal(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">Cash Amount (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={splitCashAmount}
                  onChange={e => setSplitCashAmount(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">UPI Amount (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={splitUpiAmount}
                  onChange={e => setSplitUpiAmount(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">Card Amount (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={splitCardAmount}
                  onChange={e => setSplitCardAmount(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <button
              onClick={handleConfirmSplitPayment}
              className="w-full py-3 rounded-2xl bg-espresso-950 text-white font-bold text-xs uppercase tracking-wider"
            >
              Confirm Split & Charge
            </button>
          </div>
        </div>
      )}

      {/* 4. Receipt Preview Modal */}
      {showReceiptModal && lastReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="text-center pb-3 border-b border-dashed border-stone-300">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
              <h3 className="font-display text-lg font-bold text-stone-900">{tenant.name || 'Brewhaus Café'}</h3>
              <p className="text-xs text-stone-500 font-mono">Order #{lastReceipt.order?.orderNumber}</p>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Total Paid:</span>
                <span className="font-bold text-stone-900 font-mono">{formatMoney(lastReceipt.order?.total, currency)}</span>
              </div>
              <div className="flex justify-between text-stone-500 text-[11px]">
                <span>Payment Mode:</span>
                <span className="capitalize">{lastReceipt.order?.paymentMethod || 'Paid'}</span>
              </div>
              <div className="flex justify-between text-stone-500 text-[11px]">
                <span>Date & Time:</span>
                <span>{new Date().toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-espresso-950 text-white font-bold text-xs"
              >
                <Printer size={15} /> Print Receipt
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-semibold text-xs hover:bg-stone-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
