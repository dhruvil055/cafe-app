import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed,
  Tag, Grid3X3, LogOut, Menu, X
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
  { to: '/admin/menu', icon: UtensilsCrossed, label: 'Menu Items' },
  { to: '/admin/categories', icon: Tag, label: 'Categories' },
  { to: '/admin/tables', icon: Grid3X3, label: 'Tables & QR' },
];

export default function AdminLayout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full ${mobile ? '' : 'bg-espresso-950'}`}>
      {/* Logo */}
      <div className="p-6 border-b border-espresso-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brew-500 rounded-xl flex items-center justify-center">
            <span className="text-white font-display font-bold text-sm">B</span>
          </div>
          <div>
            <p className="text-cream font-display font-bold text-sm leading-tight">Brewhaus</p>
            <p className="text-espresso-400 text-xs">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium
              ${isActive
                ? 'bg-brew-500/20 text-brew-300 border border-brew-500/30'
                : 'text-espresso-400 hover:text-cream hover:bg-espresso-800'
              }`
            }
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-espresso-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-brew-500/30 rounded-full flex items-center justify-center">
            <span className="text-brew-300 text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-cream text-xs font-medium truncate">{user?.name}</p>
            <p className="text-espresso-400 text-[10px] truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-espresso-400 hover:text-red-400
                     hover:bg-red-500/10 rounded-xl text-xs font-medium transition-all"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-56 flex-col bg-espresso-950 flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-espresso-950 z-50 md:hidden flex flex-col"
            >
              <Sidebar mobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center"
          >
            <Menu size={18} className="text-gray-600" />
          </button>
          <h1 className="font-display text-lg font-bold text-espresso-900">{title}</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
