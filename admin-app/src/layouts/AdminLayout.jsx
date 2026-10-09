import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Monitor, ShoppingBag, UtensilsCrossed, Tag,
  Users, Star, BadgePercent, Bell, Package, PackageCheck, Truck,
  TrendingDown, BarChart2, Settings, CreditCard, LogOut, ChevronLeft,
  ChevronRight, Menu, RefreshCw, Store, Sparkles, Smartphone, Wifi,
  WifiOff, Search, Clock, Shield, AlertTriangle, CheckCircle2, ChevronDown,
  Layers, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { canAccessPos, canManageMenu, canManageTeam, canViewOrders } from '../utils/roles';
import api from '../services/api';
import AiAssistantModal from '../components/AiAssistantModal';
import CommandPaletteModal from '../components/common/CommandPaletteModal';

// 5 Grouped Navigation Modules
const NAV_GROUPS = [
  {
    title: 'Operations',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', access: 'any' },
      { to: '/pos', icon: Monitor, label: 'POS Terminal', access: 'pos' },
      { to: '/orders', icon: ShoppingBag, label: 'Orders', access: 'orders' },
      { to: '/orders/kitchen', icon: Clock, label: 'Kitchen Display', access: 'orders' },
      { to: '/tables', icon: Layers, label: 'Tables & Floor', access: 'menu' },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { to: '/products', icon: UtensilsCrossed, label: 'Products', access: 'menu' },
      { to: '/categories', icon: Tag, label: 'Categories', access: 'menu' },
      { to: '/inventory', icon: Package, label: 'Inventory', access: 'menu' },
    ],
  },
  {
    title: 'Growth',
    items: [
      { to: '/customers', icon: Users, label: 'Customers CRM', access: 'menu' },
      { to: '/reviews', icon: Star, label: 'Reviews', access: 'menu' },
      { to: '/coupons', icon: BadgePercent, label: 'Coupons & Offers', access: 'menu' },
      { to: '/notifications', icon: Bell, label: 'Notifications', access: 'menu' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/purchases', icon: PackageCheck, label: 'Purchases / PO', access: 'menu' },
      { to: '/suppliers', icon: Truck, label: 'Suppliers', access: 'menu' },
      { to: '/expenses', icon: TrendingDown, label: 'Expenses', access: 'menu' },
      { to: '/analytics', icon: BarChart2, label: 'Analytics', access: 'menu' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/team', icon: Shield, label: 'Team & Security', access: 'owner' },
      { to: '/billing', icon: CreditCard, label: 'Plan & Billing', access: 'owner' },
      { to: '/settings', icon: Settings, label: 'Café Settings', access: 'owner' },
      { to: '/user-panel', icon: Smartphone, label: 'User Panel Preview', access: 'any' },
    ],
  },
];

export default function AdminLayout({ children, title }) {
  const { user, logout } = useAuth();
  const tenant = useTenant();
  const navigate = useNavigate();
  const location = useLocation();

  // Layout states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('cafe_admin_sidebar_collapsed') === 'true');
  const [refreshing, setRefreshing] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Connectivity & Sync status
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Branches
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(() => localStorage.getItem('activeBranchId') || '');

  // Live alerts & billing summary for contextual banners
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [billingSummary, setBillingSummary] = useState(null);

  // Toggle collapse
  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('cafe_admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  // ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load branches
  useEffect(() => {
    api.get('/branches').then(res => {
      const list = res.data?.branches || [];
      setBranches(list);
      if (!selectedBranchId && list.length > 0) {
        const main = list.find(b => b.isMain) || list[0];
        setSelectedBranchId(main._id);
        localStorage.setItem('activeBranchId', main._id);
        api.defaults.headers.common['X-Branch-Id'] = main._id;
      } else if (selectedBranchId) {
        api.defaults.headers.common['X-Branch-Id'] = selectedBranchId;
      }
    }).catch(() => {});
  }, []);

  // Poll pending orders count and check billing usage
  useEffect(() => {
    const checkLiveCounters = () => {
      api.get('/orders?status=pending&limit=1').then(res => {
        setPendingOrdersCount(res.data?.total || res.data?.orders?.length || 0);
      }).catch(() => {});

      if (user?.role === 'owner') {
        api.get('/tenant/billing/summary').then(res => {
          setBillingSummary(res.data);
        }).catch(() => {});
      }
    };

    checkLiveCounters();
    const interval = setInterval(checkLiveCounters, 30000);
    return () => clearInterval(interval);
  }, [user?.role]);

  const handleBranchChange = (newBranchId) => {
    setSelectedBranchId(newBranchId);
    localStorage.setItem('activeBranchId', newBranchId);
    api.defaults.headers.common['X-Branch-Id'] = newBranchId;
    window.location.reload();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    window.location.reload();
  };

  // Role check helper
  const canAccessItem = (access) => {
    if (access === 'any') return true;
    if (access === 'pos') return canAccessPos(user?.role);
    if (access === 'orders') return canViewOrders(user?.role);
    if (access === 'menu') return canManageMenu(user?.role);
    if (access === 'owner') return canManageTeam(user?.role);
    return true;
  };

  // Check if over plan limits
  const isOverMenuLimit = billingSummary?.usage?.menuItems > billingSummary?.limits?.menuItems;
  const isTrialActive = billingSummary?.subscription?.status === 'trial';
  const trialDaysRemaining = billingSummary?.subscription?.trialDaysRemaining;

  return (
    <div className="flex h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] overflow-hidden font-body select-none">
      {/* ── Left Sidebar ────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col h-screen shrink-0 border-r transition-all duration-300 z-30 custom-scrollbar ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text)',
        }}
      >
        {/* 1. Tenant Brand Header */}
        <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b"
          style={{ borderColor: 'rgba(46, 42, 37, 0.5)' }}
        >
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-display text-base font-bold text-white shadow-sm overflow-hidden border"
              style={{ backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary-border)' }}
            >
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                tenant.name?.charAt(0)?.toUpperCase() || 'B'
              )}
            </div>

            {!isCollapsed && (
              <div className="min-w-0 truncate">
                <div className="truncate font-display text-sm font-bold text-[var(--sidebar-text)] tracking-wide">
                  {tenant.name || 'Brewhaus Café'}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="truncate">Branch Console</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleCollapse}
            className="p-1 rounded-lg text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] transition"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse to icon rail'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* 2. Grouped Navigation Modules (Scrollable independently) */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar min-h-0">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(item => canAccessItem(item.access));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-300/60">
                    {group.title}
                  </div>
                )}

                {visibleItems.map(({ to, icon: Icon, label }) => {
                  const isActive = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to) && to !== '/orders');
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      title={isCollapsed ? label : undefined}
                      className={({ isActive: directActive }) => {
                        const active = directActive || isActive;
                        return `w-full flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition group ${
                          active
                            ? 'bg-[var(--brand-primary-subtle)] text-white font-bold border-l-3 border-amber-400 shadow-2xs'
                            : `text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)] border-l-3 border-transparent`
                        } ${isCollapsed ? 'justify-center' : ''}`;
                      }}
                    >
                      <Icon
                        size={17}
                        className={`shrink-0 transition ${
                          isActive ? 'text-amber-300' : `text-[var(--sidebar-text-muted)] group-hover:text-[var(--sidebar-text)]`
                        }`}
                      />
                      {!isCollapsed && <span className="truncate">{label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* 3. Sticky User Profile & Sign Out Footer */}
        <div className="border-t p-3 bg-[var(--sidebar-hover-bg)]/80 shrink-0 space-y-2"
          style={{ borderColor: 'rgba(46, 42, 37, 0.5)' }}
        >
          <NavLink
            to="/profile"
            title={isCollapsed ? `${user?.name} (${user?.role})` : undefined}
            className={`flex items-center gap-3 rounded-xl p-2 transition hover:bg-[var(--sidebar-hover-bg)] ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-amber-200 font-bold text-xs"
              style={{ backgroundColor: 'var(--brand-primary-subtle)', borderColor: 'var(--brand-primary-border)' }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 truncate">
                <div className="truncate text-xs font-bold text-[var(--sidebar-text)] flex items-center gap-1.5">
                  <span className="truncate">{user?.name || 'Staff Member'}</span>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-mono"
                    style={{ backgroundColor: 'var(--sidebar-hover-bg)', color: 'var(--sidebar-text-muted)' }}
                  >
                    {user?.role || 'staff'}
                  </span>
                </div>
                <div className="truncate text-[10px] text-[var(--sidebar-text-muted)] font-mono">
                  {user?.email || ''}
                </div>
              </div>
            )}
          </NavLink>

          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Sign out' : undefined}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition hover:bg-red-500/20 hover:text-red-200 border ${
              isCollapsed ? 'justify-center' : ''
            }`}
            style={{ borderColor: 'rgba(46, 42, 37, 0.5)', color: 'var(--sidebar-text-muted)' }}
          >
            <LogOut size={14} className="shrink-0" />
            {!isCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer ───────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 md:hidden"
              style={{ backgroundColor: 'var(--drawer-backdrop)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="fixed inset-y-0 left-0 z-50 w-64 md:hidden flex flex-col custom-scrollbar"
              style={{
                backgroundColor: 'var(--sidebar-bg)',
                borderColor: 'var(--sidebar-border)',
                color: 'var(--sidebar-text)',
              }}
            >
              {/* Mobile Header */}
              <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b"
                style={{ borderColor: 'rgba(46, 42, 37, 0.5)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[var(--brand-primary)] flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    {tenant.logoUrl ? (
                      <img src={tenant.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      tenant.name?.charAt(0)?.toUpperCase() || 'B'
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[var(--sidebar-text)]">{tenant.name || 'Brewhaus Café'}</div>
                    <div className="text-[10px] text-amber-300">Admin Console</div>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded-lg text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              {/* Mobile Nav */}
              <nav className="flex-1 overflow-y-auto p-3 space-y-4">
                {NAV_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-300/60">
                      {group.title}
                    </div>
                    {group.items.filter(item => canAccessItem(item.access)).map(({ to, icon: Icon, label }) => (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                            isActive
                              ? 'bg-[var(--brand-primary-subtle)] text-white font-bold border-l-3 border-amber-400'
                              : 'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)]'
                          }`
                        }
                      >
                        <Icon size={16} />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                  </div>
                ))}
              </nav>

              {/* Mobile Footer */}
              <div className="border-t p-3 bg-[var(--sidebar-hover-bg)]/80"
                style={{ borderColor: 'rgba(46, 42, 37, 0.5)' }}
              >
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl p-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content Area ───────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
        {/* Impersonation Banner if active */}
        {user?.impersonatedBy && (
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-white text-xs font-semibold flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">🕵️</span>
              <span>Platform Impersonation Mode: viewing café as Super Admin ({user.impersonatedBy})</span>
            </div>
            <button
              onClick={() => { window.location.href = '/super-admin'; }}
              className="bg-black/30 hover:bg-black/50 text-white rounded-lg px-2.5 py-1 text-[11px] font-bold transition"
            >
              Exit to Super Admin
            </button>
          </div>
        )}

        {/* Offline Warning Banner */}
        {!isOnline && (
          <div className="bg-amber-600 px-4 py-1.5 text-white text-xs font-semibold flex items-center justify-between shrink-0 shadow-sm animate-pulse">
            <div className="flex items-center gap-2">
              <WifiOff size={14} />
              <span>Offline Mode Active: New POS orders are saved locally and will auto-sync when connected.</span>
            </div>
          </div>
        )}

        {/* Plan Limit Warning Banner (e.g. Menu Items 35/15) */}
        {isOverMenuLimit && (
          <div className="bg-red-500 px-4 py-1.5 text-white text-xs font-semibold flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} />
              <span>
                Plan Quota Exceeded: Menu Items ({billingSummary.usage.menuItems} / {billingSummary.limits.menuItems}). Upgrade plan to lift restrictions.
              </span>
            </div>
            <NavLink
              to="/billing"
              className="bg-white text-red-700 hover:bg-red-50 rounded-lg px-2.5 py-0.5 text-[11px] font-bold transition shadow-xs"
            >
              Upgrade to Pro
            </NavLink>
          </div>
        )}

        {/* Top Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 shadow-2xs md:px-6"
          style={{
            backgroundColor: 'var(--header-bg)',
            borderColor: 'var(--header-border)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Left: Mobile Toggle & Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border p-2 md:hidden hover:bg-[var(--hover-bg)]"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--header-text-muted)' }}
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--header-text-muted)] uppercase tracking-wider">
                <span>{tenant.name || 'Café'}</span>
                <span>/</span>
                <span className="text-[var(--header-text)]">{title}</span>
              </div>
              <h1 className="min-w-0 truncate font-display text-lg font-bold text-[var(--header-text)] sm:text-xl leading-tight">
                {title}
              </h1>
            </div>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Global ⌘K Trigger Button */}
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              className="hidden lg:flex items-center gap-2 h-9 px-3 rounded-xl border px-3 py-1.5 text-xs font-medium transition"
              title="Global quick navigation (⌘K)"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--hover-bg)',
                color: 'var(--header-text-muted)',
              }}
            >
              <Search size={14} />
              <span>Search or jump...</span>
              <kbd className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-[var(--header-text-muted)] font-mono"
                style={{ backgroundColor: 'var(--border-primary)' }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Branch Switcher */}
            {branches.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 border"
                style={{
                  backgroundColor: 'var(--hover-bg)',
                  borderColor: 'var(--border-primary)',
                }}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <Store size={13} className="text-[var(--header-text-muted)] shrink-0" />
                <select
                  value={selectedBranchId}
                  onChange={e => handleBranchChange(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[var(--header-text)] focus:outline-none cursor-pointer max-w-[140px] truncate"
                  title="Switch Branch Outlet"
                >
                  {branches.map(b => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.code}){b.isMain ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Online / Sync Badge */}
            <div
              className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200 animate-pulse'
              }`}
              title={isOnline ? 'Online: System synced in real-time' : 'Offline mode'}
            >
              {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span className="text-[11px]">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </div>

            {/* Live Orders Notification Bell */}
            <NavLink
              to="/orders"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-[var(--bg-surface)] text-[var(--header-text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--header-text)] transition shadow-2xs"
              title={`${pendingOrdersCount} pending orders`}
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <Bell size={16} />
              {pendingOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs animate-bounce">
                  {pendingOrdersCount}
                </span>
              )}
            </NavLink>

            {/* Quick "Open POS" CTA Button */}
            {canAccessPos(user?.role) && (
              <NavLink
                to="/pos"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-98 transition"
                title="Launch Fast POS Terminal"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <Monitor size={14} />
                <span className="hidden sm:inline">Open POS</span>
              </NavLink>
            )}

            {/* AI Advisor Button */}
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white shadow-xs transition"
              title="Ask InfiniGrow AI Business Advisor"
              style={{ background: 'linear-gradient(to right, var(--brand-primary), var(--brand-primary-hover))' }}
            >
              <Sparkles size={13} className="text-amber-300 animate-pulse" />
              <span className="hidden md:inline">AI Advisor</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh all admin data"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-[var(--bg-surface)] text-[var(--header-text-muted)] hover:border-amber-500/40 hover:bg-[var(--hover-bg)] hover:text-[var(--header-text)] disabled:cursor-wait transition shadow-2xs"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-canvas)' }}>
          {children}
        </main>

        {/* Global Modals */}
        <AiAssistantModal isOpen={showAiModal} onClose={() => setShowAiModal(false)} />
        <CommandPaletteModal isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
      </div>
    </div>
  );
}