import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ShoppingBag, ScanLine, Coffee, UtensilsCrossed, Sparkles, Image, Phone, Clock } from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import useCartStore, { cartItemCount } from '../../context/cartStore';

const NAV_LINKS = [
  { to: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/about', label: 'Our Story', icon: Coffee },
  { to: '/offers', label: 'Offers', icon: Sparkles },
  { to: '/gallery', label: 'Moments', icon: Image },
  { to: '/contact', label: 'Contact', icon: Phone },
  { to: '/orders', label: 'My Orders', icon: Clock },
];

export default function Navbar({ variant = 'default' }) {
  const tenant = useTenant();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);

  const { tableNumber, openScanner, openQuickCart } = useCartStore();
  const itemCount = useCartStore(cartItemCount);

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isDark = variant === 'dark' || location.pathname === '/about' || location.pathname === '/menu';

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-colors duration-300 ${
        isDark
          ? 'bg-[#120804]/90 text-cream border-b border-espresso-800/80 backdrop-blur-md'
          : 'bg-white/95 text-espresso-950 border-b border-foam backdrop-blur-md shadow-xs'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label={`${tenant.name} - Homepage`}
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brew-500"
          >
            {tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={`${tenant.name} Logo`}
                className="h-9 w-auto max-w-[140px] object-contain"
                width={140}
                height={36}
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brew-500 text-espresso-950 shadow-xs">
                <Coffee size={20} className="stroke-[2.2]" />
              </div>
            )}
            <div className="flex flex-col">
              <span className={`font-display text-lg font-bold tracking-[0.06em] leading-tight ${isDark ? 'text-cream' : 'text-espresso-950'}`}>
                {tenant.name}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-brew-400 font-semibold leading-none">
                Artisanal Café
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-1 xl:gap-2">
          {NAV_LINKS.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3 py-2 text-sm font-medium rounded-full transition-colors ${
                  isActive
                    ? isDark
                      ? 'text-brew-300 bg-white/10'
                      : 'text-brew-700 bg-espresso-50 font-semibold'
                    : isDark
                    ? 'text-cream/80 hover:text-cream hover:bg-white/5'
                    : 'text-espresso-700 hover:text-espresso-950 hover:bg-espresso-50/60'
                }`}
              >
                {link.label}
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute bottom-0 left-3 right-3 h-0.5 bg-brew-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Actions (Scan QR, Cart, Mobile Hamburger) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Table indicator or scan button */}
          {tableNumber ? (
            <div className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              isDark ? 'bg-brew-500/15 border-brew-400/40 text-brew-200' : 'bg-brew-50 border-brew-200 text-brew-800'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Table {String(tableNumber).padStart(2, '0')}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={openScanner}
              aria-label="Scan Table QR Code"
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${
                isDark
                  ? 'border-brew-400/50 bg-brew-500/20 text-cream hover:bg-brew-500/30'
                  : 'border-espresso-200 bg-white text-espresso-800 hover:bg-espresso-50 shadow-xs'
              }`}
            >
              <ScanLine size={14} className="text-brew-400" />
              <span>Scan QR</span>
            </button>
          )}

          {/* Quick Cart Button */}
          <button
            type="button"
            onClick={openQuickCart}
            aria-label={`Open Cart (${itemCount} items)`}
            className={`relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border transition active:scale-95 ${
              isDark
                ? 'border-white/20 bg-white/10 text-cream hover:bg-white/20'
                : 'border-espresso-200 bg-white text-espresso-900 hover:bg-espresso-50 shadow-xs'
            }`}
          >
            <ShoppingBag size={18} />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brew-500 text-[11px] font-bold text-white shadow-xs">
                {itemCount}
              </span>
            )}
          </button>

          {/* Mobile Hamburger Toggle Button */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            className={`lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border transition active:scale-95 ${
              isDark
                ? 'border-white/20 bg-white/10 text-cream hover:bg-white/20'
                : 'border-espresso-200 bg-white text-espresso-900 hover:bg-espresso-50 shadow-xs'
            }`}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer & Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 top-[61px] z-40 bg-black/70 backdrop-blur-xs lg:hidden"
              aria-hidden="true"
            />

            {/* Drawer */}
            <motion.div
              id="mobile-nav-drawer"
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Mobile Navigation Menu"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 top-[61px] z-50 border-b border-espresso-800 bg-[#160b06] px-5 py-6 text-cream shadow-2xl lg:hidden max-h-[calc(100vh-61px)] overflow-y-auto"
            >
              {/* Table Info or QR Scan button in drawer */}
              <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-3.5">
                {tableNumber ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-brew-300">Connected</p>
                      <p className="text-sm font-bold text-cream">Table {String(tableNumber).padStart(2, '0')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMobileMenuOpen(false); openScanner(); }}
                      className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-white/20 transition min-h-[44px] flex items-center justify-center"
                    >
                      Change Table
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); openScanner(); }}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-brew-500 py-2.5 text-xs font-bold uppercase tracking-wider text-espresso-950 hover:bg-brew-400 transition"
                  >
                    <ScanLine size={16} />
                    <span>Scan Table QR to Order</span>
                  </button>
                )}
              </div>

              {/* Navigation Links List */}
              <nav aria-label="Mobile site links" className="flex flex-col space-y-1">
                {NAV_LINKS.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`min-h-[44px] flex items-center gap-3.5 rounded-xl px-4 py-3 text-base font-medium transition ${
                        isActive
                          ? 'bg-brew-500/20 text-brew-300 font-semibold border border-brew-500/30'
                          : 'text-cream/80 hover:bg-white/10 hover:text-cream'
                      }`}
                    >
                      <Icon size={18} className={isActive ? 'text-brew-400' : 'text-cream/60'} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Legal and quick contact in drawer */}
              <div className="mt-6 border-t border-white/10 pt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-cream/50">
                <Link to="/privacy" onClick={() => setMobileMenuOpen(false)} className="hover:text-cream">
                  Privacy
                </Link>
                <Link to="/terms" onClick={() => setMobileMenuOpen(false)} className="hover:text-cream">
                  Terms
                </Link>
                <Link to="/refund-policy" onClick={() => setMobileMenuOpen(false)} className="hover:text-cream">
                  Refunds
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
