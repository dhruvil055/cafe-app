import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, LogOut, Menu, RefreshCw, ShoppingBag, Tag, UtensilsCrossed, BarChart2, Package, Users, Bell, BadgePercent, Settings, CreditCard } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { canManageMenu, canManageTeam, canViewOrders } from '../utils/roles';
import { useTenant } from '../context/TenantContext';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/orders', icon: ShoppingBag, label: 'Orders' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/coupons', icon: BadgePercent, label: 'Coupons' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/products', icon: UtensilsCrossed, label: 'Products' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/categories', icon: Tag, label: 'Categories' },
  { to: '/tables', icon: 'T', label: 'Tables' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/team', icon: Users, label: 'Team & Security', ownerOnly: true },
  { to: '/billing', icon: CreditCard, label: 'Plan & Billing', ownerOnly: true },
  { to: '/settings', icon: Settings, label: 'Café Settings', ownerOnly: true },
];

function Sidebar({ mobile = false, onClose }) {
  const { user, logout } = useAuth();
  const tenant = useTenant();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    if (onClose) onClose();
  };

  return (
    <div className="flex h-full flex-col bg-espresso-900 text-white select-none">
      <div className="border-b border-espresso-800/80 p-4 sm:p-5 shrink-0 bg-espresso-950/40">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brew-500 font-display text-lg font-bold text-white shadow-sm overflow-hidden">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              tenant.name?.charAt(0)?.toUpperCase() || 'C'
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-base font-bold text-white tracking-wide">
              {tenant.name || 'Café Control'}
            </div>
            <div className="text-xs text-amber-300/80 font-medium flex items-center gap-1.5 mt-0.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
              <span>Admin Console</span>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3 overflow-y-auto custom-sidebar-scroll min-h-0">
        {NAV.filter(({ to, ownerOnly }) => {
          if (ownerOnly) return canManageTeam(user?.role);
          if (to === '/orders') return canViewOrders(user?.role);
          if (['/products', '/categories', '/tables', '/customers', '/coupons', '/notifications', '/inventory', '/analytics', '/dashboard'].includes(to)) return canManageMenu(user?.role);
          return true;
        }).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-brew-500/25 text-brew-100 font-semibold shadow-sm'
                  : 'text-espresso-200 hover:bg-espresso-800 hover:text-white'
              }`
            }
          >
            {typeof Icon === 'string' ? <span className="text-base font-bold">{Icon}</span> : <Icon size={17} />}
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-espresso-800/80 p-3 bg-espresso-950/70 shrink-0">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `mb-2 flex items-center gap-3 rounded-xl p-2 transition ${
              isActive ? 'bg-brew-500/20' : 'hover:bg-espresso-800'
            }`
          }
          onClick={onClose}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brew-500/30 border border-brew-400/30 font-semibold text-brew-100 text-sm">
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-white">{user?.name || 'Admin'}</div>
            <div className="truncate text-[11px] text-espresso-300">{user?.email || ''}</div>
          </div>
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-espresso-200 transition hover:bg-red-500/20 hover:text-red-200 border border-espresso-700/60 hover:border-red-500/30"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children, title }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshAdmin = () => {
    setRefreshing(true);
    window.location.reload();
  };

  return (
    <div className="flex h-screen bg-[#f7f4ef] text-stone-800 overflow-hidden">
      <aside className="hidden w-64 shrink-0 md:flex md:flex-col h-screen bg-espresso-900 border-r border-espresso-950">
        <Sidebar />
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/50 md:hidden" />
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="fixed inset-y-0 left-0 z-50 w-64 md:hidden bg-espresso-900">
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
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
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200/90 bg-white px-4 shadow-sm md:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-600 md:hidden hover:bg-stone-50">
              <Menu size={18} />
            </button>
            <h1 className="min-w-0 truncate font-display text-lg font-bold text-espresso-900 sm:text-2xl">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshAdmin}
              disabled={refreshing}
              title="Refresh all admin data and page"
              aria-label="Refresh all admin data and page"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 hover:text-espresso-900 disabled:cursor-wait disabled:opacity-70"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#f7f4ef]">{children}</main>
      </div>
    </div>
  );
}
