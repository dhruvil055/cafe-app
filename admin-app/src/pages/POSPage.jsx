import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, PauseCircle, PlayCircle,
  Printer, CheckCircle2, AlertCircle, Wifi, WifiOff, X, CreditCard,
  Banknote, QrCode, Split, User, Phone, Tag, Clock, RefreshCw, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { formatMoney } from '../utils/money';
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

  // Connectivity & Offline
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncingOffline, setSyncingOffline] = useState(false);

  const receiptPrintRef = useRef(null);

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

    // Initial check of offline queue
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
    } catch (_err) {
      // offline storage unavailable or not yet initialized
    }
  };

  const syncPendingOfflineOrders = async () => {
    if (!navigator.onLine || syncingOffline) return;
    setSyncingOffline(true);
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
      await checkPendingOfflineQueue();
    } catch (err) {
      console.warn('[POS Sync Error]:', err.message);
    } finally {
      setSyncingOffline(false);
    }
  };

  // Fetch Menu, Tables, and Held orders
  const loadInitialData = async () => {
    setLoadingCatalog(true);
    try {
      const [catsRes, prodsRes, tablesRes, heldRes] = await Promise.all([
        api.get('/categories').catch(() => ({ data: [] })),
        api.get('/menu/all').catch(() => ({ data: [] })),
        api.get('/tables/all').catch(() => ({ data: { tables: [] } })),
        api.get('/pos/held-orders').catch(() => ({ data: { orders: [] } })),
      ]);

      const catList = Array.isArray(catsRes.data) ? catsRes.data : (catsRes.data?.categories || []);
      const prodList = Array.isArray(prodsRes.data) ? prodsRes.data : (prodsRes.data?.products || []);

      setCategories(catList);
      setProducts(prodList);
      setTables(tablesRes.data?.tables || []);
      setHeldOrders(heldRes.data?.orders || []);

      // Cache for offline usage
      await cacheCatalog(catList, prodList);
    } catch (err) {
      // Fallback to IndexedDB cache if offline
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
      if (!prod.available) return false;
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

  // Computations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.itemTotal, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const manual = Math.max(0, Number(manualDiscount) || 0);
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
      } catch (_err) {
        // customer lookup ignored if offline or network error
      }
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

    // Delete from held orders on server
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
      // Offline mode: queue in IndexedDB
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

    // Online mode: direct submission
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

  // Thermal Print Trigger
  const printThermalReceipt = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] overflow-hidden bg-stone-100 -m-4 sm:-m-6 lg:-m-8">
      {/* Top Banner / Controls */}
      <div className="bg-espresso-950 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
          {/* Order Type Tabs */}
          <div className="flex bg-espresso-900 rounded-xl p-1 border border-espresso-800">
            {ORDER_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setOrderType(type.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                  orderType === type.id
                    ? 'bg-brew-500 text-espresso-950 shadow-sm'
                    : 'text-espresso-200 hover:text-white'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Dine-in Table Selection */}
          {orderType === 'dine_in' && (
            <div className="flex items-center gap-1.5 bg-espresso-900 border border-espresso-800 rounded-xl px-2.5 py-1">
              <span className="text-xs text-espresso-300 font-medium">Table:</span>
              <input
                type="number"
                placeholder="No."
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                className="w-14 bg-espresso-950 text-white text-xs px-2 py-0.5 rounded border border-espresso-700 focus:outline-none focus:border-brew-400"
              />
            </div>
          )}
        </div>

        {/* Right Info: Status, Sync, Held */}
        <div className="flex items-center gap-3">
          {/* Held Orders Badge */}
          {heldOrders.length > 0 && (
            <button
              onClick={() => setShowHeldModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold hover:bg-amber-500/30 transition"
            >
              <PauseCircle size={14} />
              <span>Held ({heldOrders.length})</span>
            </button>
          )}

          {/* Offline Sync Status */}
          {pendingSyncCount > 0 && (
            <button
              onClick={syncPendingOfflineOrders}
              disabled={syncingOffline || !isOnline}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold hover:bg-blue-500/30 transition"
              title="Click to sync offline orders now"
            >
              <RefreshCw size={13} className={syncingOffline ? 'animate-spin' : ''} />
              <span>Sync ({pendingSyncCount})</span>
            </button>
          )}

          {/* Online/Offline Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
            }`}
          >
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>
        </div>
      </div>

      {/* Main 2-Pane Work Area */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left Pane: Catalog & Fast Product Grid */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-stone-200 bg-stone-50 overflow-hidden">
          {/* Search & Stations Bar */}
          <div className="p-3 bg-white border-b border-stone-200 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search item name or SKU..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-stone-100 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-brew-500 border border-stone-200"
                />
              </div>

              {/* Station Filter */}
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {STATIONS.map(st => (
                  <button
                    key={st}
                    onClick={() => setSelectedStation(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
                      selectedStation === st
                        ? 'bg-stone-800 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories Horizontal Scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-sidebar-scroll pb-1">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                  selectedCategory === 'ALL'
                    ? 'bg-brew-500 text-white shadow-sm'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                }`}
              >
                All Menu
              </button>
              {categories.map(cat => (
                <button
                  key={cat._id}
                  onClick={() => setSelectedCategory(String(cat._id))}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                    selectedCategory === String(cat._id)
                      ? 'bg-brew-500 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {cat.icon && <span>{cat.icon}</span>}
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 auto-rows-max">
            {loadingCatalog ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-stone-400">
                <Loader2 className="animate-spin mb-2" size={28} />
                <span className="text-xs">Loading menu items...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-stone-400 text-xs">
                No matching menu items found.
              </div>
            ) : (
              filteredProducts.map(prod => (
                <button
                  key={prod._id}
                  onClick={() => handleProductClick(prod)}
                  className="flex flex-col text-left bg-white rounded-2xl p-2.5 border border-stone-200/90 shadow-sm hover:border-brew-400 hover:shadow-md transition active:scale-[0.98] group relative overflow-hidden"
                >
                  {/* Veg / Non-veg marker */}
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={`inline-block w-2.5 h-2.5 rounded-sm border ${
                      prod.isVeg ? 'border-emerald-600 bg-emerald-500' : 'border-red-600 bg-red-500'
                    }`} />
                    {prod.prepTime && (
                      <span className="text-[10px] text-stone-400 flex items-center gap-0.5">
                        <Clock size={10} /> {prod.prepTime}m
                      </span>
                    )}
                  </div>

                  <div className="font-display font-semibold text-xs text-stone-800 line-clamp-1 group-hover:text-brew-600">
                    {prod.name}
                  </div>

                  <div className="mt-auto pt-2 flex items-center justify-between w-full">
                    <span className="font-bold text-xs text-espresso-950">
                      {formatMoney(prod.price, tenant?.settings?.currency)}
                    </span>
                    <span className="p-1 rounded-lg bg-stone-100 text-stone-600 group-hover:bg-brew-500 group-hover:text-white transition">
                      <Plus size={12} />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Pane: Ticket, Customer & Instant Checkout */}
        <div className="w-full md:w-96 lg:w-[420px] bg-white flex flex-col h-full border-t md:border-t-0 shadow-lg shrink-0">
          {/* Customer Bar */}
          <div className="p-3 border-b border-stone-200 bg-stone-50 space-y-2 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Phone size={13} className="absolute left-2.5 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Mobile No."
                  value={customerPhone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-brew-500"
                />
              </div>
              <div className="relative">
                <User size={13} className="absolute left-2.5 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-brew-500"
                />
              </div>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-300 py-12">
                <ShoppingCart size={40} className="stroke-[1.2] mb-2" />
                <p className="text-xs text-stone-400 font-medium">Cart is empty</p>
                <p className="text-[11px] text-stone-400">Click products on the left to add items</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.cartKey}
                  className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200/80 text-xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-semibold text-stone-800 truncate">{item.name}</div>
                    {(item.variant || item.addons.length > 0 || item.specialInstructions) && (
                      <div className="text-[10px] text-stone-500 truncate">
                        {item.variant && <span className="mr-1">[{item.variant.name}]</span>}
                        {item.addons.map(a => a.name).join(', ')}
                        {item.specialInstructions && <span className="italic ml-1">"{item.specialInstructions}"</span>}
                      </div>
                    )}
                    <div className="text-stone-500 text-[11px]">
                      {formatMoney(item.unitPrice, tenant?.settings?.currency)}
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => updateCartQty(item.cartKey, -1)}
                      className="w-6 h-6 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-100"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-5 text-center font-bold text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQty(item.cartKey, 1)}
                      className="w-6 h-6 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-stone-100"
                    >
                      <Plus size={11} />
                    </button>
                    <button
                      onClick={() => removeCartItem(item.cartKey)}
                      className="ml-1 text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bill Calculation & Checkout Footer */}
          <div className="border-t border-stone-200 p-3 bg-stone-50/70 space-y-2 shrink-0">
            {/* Discount / Coupon Bar */}
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Discount (₹)"
                value={manualDiscount}
                onChange={e => setManualDiscount(e.target.value)}
                className="w-1/2 px-2.5 py-1 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-brew-500"
              />
              <input
                type="text"
                placeholder="Coupon Code"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value)}
                className="w-1/2 px-2.5 py-1 text-xs bg-white border border-stone-200 rounded-xl uppercase focus:outline-none focus:border-brew-500"
              />
            </div>

            {/* Price Breakdown */}
            <div className="space-y-1 text-xs text-stone-600 pt-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal, tenant?.settings?.currency)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatMoney(discountAmount, tenant?.settings?.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px] text-stone-500">
                <span>GST ({taxRate}%)</span>
                <span>+{formatMoney(taxAmount, tenant?.settings?.currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-espresso-950 pt-1 border-t border-stone-200">
                <span>Payable Total</span>
                <span className="text-base text-brew-700">{formatMoney(totalAmount, tenant?.settings?.currency)}</span>
              </div>
            </div>

            {/* Hold / Clear Row */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleHoldOrder}
                disabled={cart.length === 0}
                className="flex-1 py-1.5 text-xs font-semibold rounded-xl border border-stone-300 text-stone-700 bg-white hover:bg-stone-100 disabled:opacity-50 transition"
              >
                Hold Order
              </button>
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition"
              >
                Clear
              </button>
            </div>

            {/* Quick Checkout Buttons */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              <button
                onClick={() => handleCheckout('cash')}
                disabled={cart.length === 0 || processingOrder}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition active:scale-95"
              >
                <Banknote size={16} />
                <span className="text-[11px] mt-0.5">Cash</span>
              </button>
              <button
                onClick={() => handleCheckout('upi')}
                disabled={cart.length === 0 || processingOrder}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 transition active:scale-95"
              >
                <QrCode size={16} />
                <span className="text-[11px] mt-0.5">UPI</span>
              </button>
              <button
                onClick={() => handleCheckout('card')}
                disabled={cart.length === 0 || processingOrder}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition active:scale-95"
              >
                <CreditCard size={16} />
                <span className="text-[11px] mt-0.5">Card</span>
              </button>
              <button
                onClick={() => {
                  setSplitCashAmount('');
                  setSplitUpiAmount('');
                  setSplitCardAmount('');
                  setShowSplitModal(true);
                }}
                disabled={cart.length === 0 || processingOrder}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-stone-800 text-white font-semibold hover:bg-stone-900 disabled:opacity-50 transition active:scale-95"
              >
                <Split size={16} />
                <span className="text-[11px] mt-0.5">Split</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Modifiers & Variants */}
      {activeProductForModifier && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-display font-bold text-base text-stone-800">
                {activeProductForModifier.name}
              </h3>
              <button onClick={() => setActiveProductForModifier(null)} className="text-stone-400 hover:text-stone-600">
                <X size={18} />
              </button>
            </div>

            {/* Variants */}
            {activeProductForModifier.variants?.length > 0 && (
              <div>
                <label className="text-xs font-bold text-stone-700 uppercase">Choose Variant</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {activeProductForModifier.variants.map(v => (
                    <button
                      key={v._id}
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2 rounded-xl border text-xs text-left font-medium transition ${
                        selectedVariant?._id === v._id
                          ? 'border-brew-500 bg-brew-50 text-brew-800'
                          : 'border-stone-200 text-stone-700'
                      }`}
                    >
                      <div>{v.name}</div>
                      <div className="font-bold">{formatMoney(v.price, tenant?.settings?.currency)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add-ons */}
            {activeProductForModifier.addons?.length > 0 && (
              <div>
                <label className="text-xs font-bold text-stone-700 uppercase">Add-ons</label>
                <div className="space-y-1.5 mt-1.5">
                  {activeProductForModifier.addons.map(a => {
                    const isSelected = selectedAddons.some(item => item._id === a._id);
                    return (
                      <label
                        key={a._id}
                        className="flex items-center justify-between p-2 rounded-xl border border-stone-200 text-xs cursor-pointer hover:bg-stone-50"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedAddons([...selectedAddons, a]);
                              else setSelectedAddons(selectedAddons.filter(item => item._id !== a._id));
                            }}
                            className="rounded text-brew-600 focus:ring-brew-500"
                          />
                          <span className="font-medium">{a.name}</span>
                        </div>
                        <span className="font-bold">+{formatMoney(a.price, tenant?.settings?.currency)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special Note */}
            <div>
              <label className="text-xs font-bold text-stone-700 uppercase">Special Note</label>
              <input
                type="text"
                placeholder="e.g. Extra hot, Less sugar"
                value={modifierNote}
                onChange={e => setModifierNote(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-brew-500"
              />
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-stone-700 uppercase">Quantity</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModifierQty(Math.max(1, modifierQty - 1))}
                  className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center font-bold"
                >
                  <Minus size={13} />
                </button>
                <span className="w-6 text-center font-bold text-sm">{modifierQty}</span>
                <button
                  onClick={() => setModifierQty(modifierQty + 1)}
                  className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center font-bold"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            <button
              onClick={handleConfirmModifier}
              className="w-full py-2.5 bg-brew-500 text-white font-semibold rounded-xl text-xs hover:bg-brew-600 transition shadow-md"
            >
              Add to Ticket
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Held Orders */}
      {showHeldModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-display font-bold text-base text-stone-800">
                Parked / Held Orders ({heldOrders.length})
              </h3>
              <button onClick={() => setShowHeldModal(false)} className="text-stone-400 hover:text-stone-600">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {heldOrders.length === 0 ? (
                <p className="text-center text-xs text-stone-400 py-6">No held orders found.</p>
              ) : (
                heldOrders.map(held => (
                  <div
                    key={held._id}
                    className="p-3 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-stone-800">
                        {held.orderType.toUpperCase()} {held.tableNumber ? `(Table ${held.tableNumber})` : ''} — {held.customer?.name || 'Walk-in'}
                      </div>
                      <div className="text-stone-500 text-[11px]">
                        {held.items?.length || 0} items • {formatMoney(held.total, tenant?.settings?.currency)} • {new Date(held.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleResumeHeldOrder(held)}
                      className="px-3 py-1.5 bg-brew-500 text-white rounded-lg font-semibold hover:bg-brew-600 text-xs transition"
                    >
                      Resume
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Split Payment */}
      {showSplitModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-display font-bold text-base text-stone-800">
                Split Payment (Total: {formatMoney(totalAmount, tenant?.settings?.currency)})
              </h3>
              <button onClick={() => setShowSplitModal(false)} className="text-stone-400 hover:text-stone-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-xs font-semibold text-stone-600">Cash Amount (₹)</label>
                <input
                  type="number"
                  value={splitCashAmount}
                  onChange={e => setSplitCashAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full mt-1 px-3 py-1.5 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-brew-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600">UPI Amount (₹)</label>
                <input
                  type="number"
                  value={splitUpiAmount}
                  onChange={e => setSplitUpiAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full mt-1 px-3 py-1.5 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-brew-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600">Card Amount (₹)</label>
                <input
                  type="number"
                  value={splitCardAmount}
                  onChange={e => setSplitCardAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full mt-1 px-3 py-1.5 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-brew-500"
                />
              </div>
            </div>

            <button
              onClick={handleConfirmSplitPayment}
              className="w-full py-2.5 bg-brew-500 text-white font-semibold rounded-xl text-xs hover:bg-brew-600 transition shadow-md"
            >
              Confirm Split & Complete
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: Thermal Receipt Preview & Print */}
      {showReceiptModal && lastReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={14} /> Order Paid & Completed
              </span>
              <button onClick={() => setShowReceiptModal(false)} className="text-stone-400 hover:text-stone-600">
                <X size={18} />
              </button>
            </div>

            {/* 80mm Thermal Receipt Content */}
            <div
              ref={receiptPrintRef}
              className="bg-stone-50 border border-dashed border-stone-300 p-3 rounded-lg overflow-y-auto text-stone-900 font-mono text-[11px] leading-tight select-text"
            >
              <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-stone-300">
                <div className="font-bold text-sm tracking-wide">{tenant?.settings?.cafeName || tenant?.name}</div>
                {tenant?.settings?.gstSettings?.gstin && (
                  <div>GSTIN: {tenant.settings.gstSettings.gstin}</div>
                )}
                <div className="text-[10px] text-stone-600">{tenant?.settings?.address}</div>
                <div className="text-[10px] text-stone-600">Ph: {tenant?.settings?.contactPhone}</div>
              </div>

              <div className="py-1.5 space-y-0.5 border-b border-dashed border-stone-300 text-[10px]">
                <div>Inv No: {lastReceipt.order?.gstDetails?.invoiceNumber || lastReceipt.receiptNumber || 'INV-TEMP'}</div>
                <div>Date: {new Date(lastReceipt.order?.createdAt || Date.now()).toLocaleString()}</div>
                <div>Type: {String(lastReceipt.order?.orderType || 'counter').toUpperCase()} {lastReceipt.order?.tableNumber ? `(T-${lastReceipt.order.tableNumber})` : ''}</div>
                <div>Customer: {lastReceipt.order?.customer?.name || 'Walk-in'}</div>
              </div>

              {/* Items List */}
              <div className="py-2 space-y-1 border-b border-dashed border-stone-300">
                {lastReceipt.order?.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate pr-1">{it.name} x{it.quantity}</span>
                    <span className="font-semibold">{formatMoney(it.itemTotal || (it.price * it.quantity), tenant?.settings?.currency)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="py-1.5 space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatMoney(lastReceipt.order?.subtotal, tenant?.settings?.currency)}</span>
                </div>
                {lastReceipt.order?.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>-{formatMoney(lastReceipt.order?.discount, tenant?.settings?.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px]">
                  <span>CGST (2.5%):</span>
                  <span>{formatMoney((lastReceipt.order?.tax || 0) / 2, tenant?.settings?.currency)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>SGST (2.5%):</span>
                  <span>{formatMoney((lastReceipt.order?.tax || 0) / 2, tenant?.settings?.currency)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed border-stone-400">
                  <span>GRAND TOTAL:</span>
                  <span>{formatMoney(lastReceipt.order?.total, tenant?.settings?.currency)}</span>
                </div>
                <div className="flex justify-between text-[10px] pt-0.5">
                  <span>Payment:</span>
                  <span className="uppercase">{lastReceipt.order?.paymentMethod} (PAID)</span>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] text-stone-500">
                *** Thank You! Visit Again ***
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={printThermalReceipt}
                className="flex-1 py-2 bg-espresso-950 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-espresso-800 transition"
              >
                <Printer size={14} /> Print Receipt
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-200 transition"
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
