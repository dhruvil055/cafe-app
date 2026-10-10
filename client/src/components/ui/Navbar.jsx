import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ShoppingBag, ScanLine, Coffee, UtensilsCrossed, Sparkles, Image, Phone, Clock } from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import useCartStore, { cartItemCount } from '../../context/cartStore';

const NAV_LINKS = [
  { to: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/about', label: 'About', icon: Coffee },
  { to: '/offers', label: 'Offers', icon: Sparkles },
  { to: '/gallery', label: 'Gallery', icon: Image },
  { to: '/contact', label: 'Contact', icon: Phone },
  { to: '/orders', label: 'Orders', icon: Clock },
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
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        isDark
          ? 'bg-[#140b07]/92 text-cream border-b border-espresso-800/80 backdrop-blur-xl shadow-md'
          : 'bg-white/92 text-espresso-950 border-b border-foam/80 backdrop-blur-xl shadow-xs'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3.5 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link
            to="/"
            aria-label={`${tenant.name} - Homepage`}
            className="group flex items-center gap-2.5 rounded-xl transition-transform active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brew-500"
          >
            {tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={`${tenant.name} Logo`}
                className="h-9 w-auto max-w-[130px] sm:max-w-[160px] object-contain transition-transform group-hover:scale-102"
                width={150}
                height={36}
              />
            ) : (
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brew-500 to-brew-600 text-white shadow-sm shadow-brew-500/20">
                <Coffee size={20} className="stroke-[2.2]" />
              </div>
            )}
            <div className="flex flex-col">
              <span className={`font-display text-base sm:text-lg font-bold tracking-[0.04em] leading-tight transition-colors ${
                isDark ? 'text-cream group-hover:text-brew-200' : 'text-espresso-950 group-hover:text-brew-700'
              }`}>
                {tenant.name}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-brew-500/90 font-semibold leading-none">
                {tenant.tagline || 'Artisanal Café'}
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-1 xl:gap-1.5">
          {NAV_LINKS.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3.5 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                  isActive
                    ? isDark
                      ? 'text-brew-200 bg-white/10 font-semibold shadow-inner'
                      : 'text-espresso-950 bg-foam/90 font-semibold shadow-2xs'
                    : isDark
                    ? 'text-cream/75 hover:text-cream hover:bg-white/5'
                    : 'text-espresso-700 hover:text-espresso-950 hover:bg-espresso-50/70'
                }`}
              >
                {link.label}
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute bottom-1 left-4 right-4 h-0.5 bg-brew-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Actions (Table status, Cart button, Mobile drawer toggle) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Table indicator or scan button */}
          {tableNumber ? (
            <button
              type="button"
              onClick={openScanner}
              title="Tap to change table"
              className={`inline-flex min-h-[40px] items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                isDark
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 hover:bg-emerald-900/40'
                  : 'bg-emerald-50/90 border-emerald-200 text-emerald-900 hover:bg-emerald-100/80 shadow-2xs'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="tracking-wide">Table {String(tableNumber).padStart(2, '0')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openScanner}
              aria-label="Scan Table QR Code"
              className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                isDark
                  ? 'border-brew-400/40 bg-brew-500/15 text-cream hover:bg-brew-500/25'
                  : 'border-espresso-200/80 bg-white text-espresso-800 hover:bg-espresso-50 shadow-2xs'
              }`}
            >
              <ScanLine size={15} className="text-brew-500" />
              <span className="hidden sm:inline">Scan Table</span>
            </button>
          )}

          {/* Cart Icon Link with reactive bounce */}
          <Link
            to="/cart"
            aria-label={`Open Cart (${itemCount} items)`}
            className={`relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full border transition-all active:scale-95 ${
              isDark
                ? 'border-white/15 bg-white/10 text-cream hover:bg-white/20'
                : 'border-espresso-200/80 bg-white text-espresso-900 hover:bg-espresso-50/80 shadow-2xs'
            }`}
          >
            <ShoppingBag size={18} className="stroke-[2.1]" />
            <AnimatePresence>
              {itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brew-500 text-[11px] font-bold text-white shadow-sm ring-2 ring-white"
                >
                  {itemCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          {/* Mobile Hamburger Button */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            className={`lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full border transition-all active:scale-95 ${
              isDark
                ? 'border-white/15 bg-white/10 text-cream hover:bg-white/20'
                : 'border-espresso-200/80 bg-white text-espresso-900 hover:bg-espresso-50/80 shadow-2xs'
            }`}
          >
            {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
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
