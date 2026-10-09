import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, LayoutDashboard, Monitor, ShoppingBag, UtensilsCrossed,
  Tag, Users, BarChart2, Settings, CreditCard, Bell, Star,
  Plus, Smartphone, ArrowRight, X, Clock, HelpCircle
} from 'lucide-react';

const ACTIONS = [
  { id: 'pos', title: 'Open POS Terminal', subtitle: 'Take counter, dine-in, or takeaway order', icon: Monitor, to: '/pos', category: 'Operations' },
  { id: 'orders', title: 'View Live Orders', subtitle: 'Active kitchen tickets & table orders', icon: ShoppingBag, to: '/orders', category: 'Operations' },
  { id: 'kds', title: 'Kitchen Display (KDS)', subtitle: 'Fullscreen ticket view for chef & bar', icon: Clock, to: '/orders/kitchen', category: 'Operations' },
  { id: 'tables', title: 'Tables & Floor Plan', subtitle: 'View floor occupancy & QR codes', icon: UtensilsCrossed, to: '/tables', category: 'Operations' },
  { id: 'new-product', title: 'Add New Menu Item', subtitle: 'Create product with price & variants', icon: Plus, to: '/products?create=true', category: 'Catalog' },
  { id: 'products', title: 'Products Directory', subtitle: 'Manage prices, veg badges & availability', icon: UtensilsCrossed, to: '/products', category: 'Catalog' },
  { id: 'categories', title: 'Categories & Sort', subtitle: 'Organize menu sections & display order', icon: Tag, to: '/categories', category: 'Catalog' },
  { id: 'customers', title: 'Customers CRM', subtitle: 'Customer orders, tags & loyalty', icon: Users, to: '/customers', category: 'Growth' },
  { id: 'coupons', title: 'Coupons & Discounts', subtitle: 'Create promo codes and checkout offers', icon: Tag, to: '/coupons', category: 'Growth' },
  { id: 'notifications', title: 'Send Push Notification', subtitle: 'Compose blast to customer browsers', icon: Bell, to: '/notifications', category: 'Growth' },
  { id: 'reviews', title: 'Customer Reviews', subtitle: 'View ratings and reply to feedback', icon: Star, to: '/reviews', category: 'Growth' },
  { id: 'analytics', title: 'Analytics & Reports', subtitle: 'Daily revenue, hourly peak & GST exports', icon: BarChart2, to: '/analytics', category: 'Finance' },
  { id: 'billing', title: 'Plan & Billing', subtitle: 'View usage limits, quotas & invoices', icon: CreditCard, to: '/billing', category: 'Admin' },
  { id: 'settings', title: 'Café Settings', subtitle: 'Brand colors, logo, taxes & hours', icon: Settings, to: '/settings', category: 'Admin' },
  { id: 'user-panel', title: 'Customer Storefront Preview', subtitle: 'Interactive diner table simulation', icon: Smartphone, to: '/user-panel', category: 'Storefront' },
];

export default function CommandPaletteModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = ACTIONS.filter(action => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      action.title.toLowerCase().includes(q) ||
      action.subtitle.toLowerCase().includes(q) ||
      action.category.toLowerCase().includes(q)
    );
  });

  const handleSelect = (action) => {
    if (action.to) {
      navigate(action.to);
    }
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4"
      style={{ backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden custom-scrollbar"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b"
          style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--hover-bg)/50' }}
        >
          <Search size={18} className="text-amber-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, actions, or jump to section (e.g. POS, menu, GST)..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
          />
          <kbd className="hidden sm:inline-block rounded-md px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]"
            style={{ backgroundColor: 'var(--border-primary)/80' }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[360px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              No matching pages or actions found for "{query}".
            </div>
          ) : (
            filtered.map((action, idx) => {
              const Icon = action.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={action.id}
                  onClick={() => handleSelect(action)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-left transition ${
                    isSelected
                      ? 'bg-[var(--brand-primary-subtle)] text-amber-900 dark:text-white shadow-2xs font-semibold'
                      : 'hover:bg-[var(--hover-bg)] text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      isSelected ? 'bg-amber-500 text-white shadow-sm' : 'bg-[var(--hover-bg)] text-[var(--text-muted)]'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">{action.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate">{action.subtitle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--hover-bg)' }}
                    >
                      {action.category}
                    </span>
                    <ArrowRight size={13} className={`transition ${isSelected ? 'text-amber-500 translate-x-0.5' : 'text-[var(--text-muted)]'}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t text-[11px] text-[var(--text-muted)]"
          style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--hover-bg)' }}
        >
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono font-bold px-1.5 py-0.5 rounded border text-[10px]" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono font-bold px-1.5 py-0.5 rounded border text-[10px]" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>↵</kbd> Select</span>
          </div>
          <span className="text-amber-600 dark:text-amber-500/80 font-mono font-bold">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}