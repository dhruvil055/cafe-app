import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, LogOut, Menu, RefreshCw, ShoppingBag, Tag, UtensilsCrossed, BarChart2, Package } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/orders', icon: ShoppingBag, label: 'Orders' },
  { to: '/products', icon: UtensilsCrossed, label: 'Products' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/categories', icon: Tag, label: 'Categories' },
  { to: '/tables', icon: 'T', label: 'Tables' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
];

function Sidebar({ mobile = false, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    if (onClose) onClose();
  };

  return (
    <div className="flex h-full flex-col bg-espresso-900 text-white">
      <div className="border-b border-espresso-700 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brew-500 font-display text-lg font-bold text-white">
            B
          </div>
          <div>
            <div className="font-display text-lg font-bold">Brewhaus</div>
            <div className="text-xs text-espresso-300">Admin Control</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-brew-500/20 text-brew-100' : 'text-espresso-200 hover:bg-espresso-800 hover:text-white'
              }`
            }
          >
            {typeof Icon === 'string' ? <span className="text-base font-bold">{Icon}</span> : <Icon size={17} />}
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-espresso-700 p-4">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `mb-3 flex items-center gap-3 rounded-xl px-2 py-1.5 transition ${
              isActive ? 'bg-brew-500/15' : 'hover:bg-espresso-800'
            }`
          }
          onClick={onClose}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brew-500/20 font-semibold text-brew-100">
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{user?.name || 'Admin'}</div>
            <div className="truncate text-[10px] text-espresso-300">{user?.email || ''}</div>
          </div>
        </NavLink>
        <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-espresso-200 transition hover:bg-red-500/10 hover:text-red-200">
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshAdmin = () => {
    setRefreshing(true);
    window.location.reload();
  };

  return (
    <div className="flex h-screen bg-stone-100 text-stone-800">
      <aside className="hidden w-64 shrink-0 md:block">
        <Sidebar />
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/50 md:hidden" />
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="fixed inset-y-0 left-0 z-50 w-64 md:hidden">
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-4 shadow-sm md:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-600 md:hidden">
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
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 text-sm text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 hover:text-espresso-900 disabled:cursor-wait disabled:opacity-70"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={() => setSidebarOpen(false)} className="hidden rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-600 md:inline-flex">Admin</button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
