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

export default function Navbar() {
  const tenant = useTenant();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);

  const { tableNumber, openScanner } = useCartStore();
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

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-xl border-b border-foam/90 shadow-2xs transition-all duration-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3.5 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link
            to="/menu"
            aria-label={`${tenant.name || 'Café'} - Homepage`}
            className="group flex items-center gap-2.5 sm:gap-3 rounded-xl transition-transform active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brew-500 min-w-0"
          >
            {tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={`${tenant.name || 'Café'} Logo`}
                className="h-9 w-auto max-w-[130px] sm:max-w-[160px] object-contain transition-transform group-hover:scale-102 flex-shrink-0"
                width={150}
                height={36}
              />
            ) : (
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brew-500 to-brew-600 text-white shadow-sm shadow-brew-500/20 flex-shrink-0">
                <Coffee size={20} className="stroke-[2.2]" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-display text-base sm:text-lg font-bold tracking-tight leading-tight text-espresso-950 group-hover:text-brew-700 transition-colors truncate">
                {tenant.name || 'Café'}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-brew-700 font-bold leading-none truncate">
                {tenant.tagline || 'Artisanal Food & Coffee'}
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
                className={`relative px-4 py-2 text-xs font-bold tracking-wide rounded-full transition-all duration-200 ${
                  isActive
                    ? 'text-espresso-950 bg-foam shadow-xs font-bold'
                    : 'text-espresso-700 hover:text-espresso-950 hover:bg-espresso-50/90 font-medium'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Quick Actions (Table status, Cart button, Mobile drawer toggle) */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
          {/* Table indicator or scan button */}
          {tableNumber ? (
            <button
              type="button"
              onClick={openScanner}
              title="Tap to change table"
              className="inline-flex min-h-[40px] items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border border-emerald-300 bg-emerald-50/90 text-emerald-950 hover:bg-emerald-100 transition-all active:scale-95 shadow-2xs"
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
              className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border border-espresso-200/90 bg-white text-espresso-900 hover:bg-espresso-50 transition-all active:scale-95 shadow-2xs"
            >
              <ScanLine size={15} className="text-brew-600" />
              <span className="hidden sm:inline">Scan Table</span>
            </button>
          )}

          {/* Cart Icon Link */}
          <Link
            to="/cart"
            aria-label={`Open Cart (${itemCount} items)`}
            className="relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full border border-espresso-200/90 bg-white text-espresso-950 hover:bg-espresso-50/90 shadow-2xs transition-all active:scale-95"
          >
            <ShoppingBag size={18} className="stroke-[2.2]" />
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
            className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full border border-espresso-200/90 bg-white text-espresso-950 hover:bg-espresso-50/90 shadow-2xs transition-all active:scale-95"
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
              className="fixed inset-0 top-[61px] z-40 bg-black/50 backdrop-blur-xs lg:hidden"
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
              className="fixed inset-x-0 top-[61px] z-50 border-b border-foam bg-white px-5 py-6 text-espresso-950 shadow-2xl lg:hidden max-h-[calc(100vh-61px)] overflow-y-auto"
            >
              {/* Table Info or QR Scan button in drawer */}
              <div className="mb-5 rounded-2xl border border-foam bg-cream/70 p-3.5">
                {tableNumber ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-brew-700">Connected</p>
                      <p className="text-sm font-bold text-espresso-950">Table {String(tableNumber).padStart(2, '0')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMobileMenuOpen(false); openScanner(); }}
                      className="rounded-full border border-espresso-200 bg-white px-3 py-1.5 text-xs font-bold text-espresso-800 hover:bg-espresso-50 transition min-h-[40px] flex items-center justify-center shadow-2xs"
                    >
                      Change Table
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); openScanner(); }}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-brew-500 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-brew-600 transition shadow-xs"
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
                      className={`min-h-[44px] flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-foam text-espresso-950 font-bold border border-espresso-200/60'
                          : 'text-espresso-700 hover:bg-cream hover:text-espresso-950'
                      }`}
                    >
                      <Icon size={18} className={isActive ? 'text-brew-600' : 'text-espresso-400'} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Legal and quick contact in drawer */}
              <div className="mt-6 border-t border-foam pt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-espresso-500">
                <Link to="/privacy" onClick={() => setMobileMenuOpen(false)} className="hover:text-espresso-900">
                  Privacy
                </Link>
                <Link to="/terms" onClick={() => setMobileMenuOpen(false)} className="hover:text-espresso-900">
                  Terms
                </Link>
                <Link to="/refund-policy" onClick={() => setMobileMenuOpen(false)} className="hover:text-espresso-900">
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
