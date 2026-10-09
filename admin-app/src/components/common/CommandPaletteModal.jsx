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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-stone-100 bg-stone-50/50">
          <Search size={18} className="text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, actions, or jump to section (e.g. POS, menu, GST)..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-block rounded-md bg-stone-200/80 px-2 py-0.5 text-[10px] font-bold text-stone-600">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[360px] overflow-y-auto p-2 space-y-1 custom-sidebar-scroll">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-400">
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
                      ? 'bg-brew-500/15 text-brew-900 shadow-2xs font-semibold'
                      : 'hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      isSelected ? 'bg-brew-500 text-white shadow-sm' : 'bg-stone-100 text-stone-600'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-stone-900 truncate">{action.title}</div>
                      <div className="text-[11px] text-stone-500 truncate">{action.subtitle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                      {action.category}
                    </span>
                    <ArrowRight size={13} className={`transition ${isSelected ? 'text-brew-600 translate-x-0.5' : 'text-stone-300'}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-stone-100 bg-stone-50 text-[11px] text-stone-400">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-stone-200">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-stone-200">↵</kbd> Select</span>
          </div>
          <span>Brewhaus Navigator</span>
        </div>
      </div>
    </div>
  );
}
