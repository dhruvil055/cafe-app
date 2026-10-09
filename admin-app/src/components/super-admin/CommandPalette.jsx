import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Store, LayoutDashboard, CreditCard, ScrollText,
  UserCheck, Settings, Eye, ArrowUpRight, LogOut, Sun, Moon,
  RefreshCw, Smartphone, X, CornerDownLeft
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function CommandPalette({
  isOpen,
  onClose,
  tenants = [],
  onSelectTenant,
  onNavigateTab,
  onToggleTheme,
  onRefresh,
  onLogout,
  onOpenUserPanels,
}) {
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build searchable items
  const items = [];

  // 1. Navigation items
  items.push(
    { id: 'nav-overview', type: 'Navigation', title: 'Go to Overview', subtitle: 'Platform KPIs & Charts', icon: LayoutDashboard, action: () => onNavigateTab('overview') },
    { id: 'nav-tenants', type: 'Navigation', title: 'Go to Cafés Directory', subtitle: 'Manage all tenant accounts', icon: Store, action: () => onNavigateTab('tenants') },
    { id: 'nav-plans', type: 'Navigation', title: 'Go to Plans & Billing', subtitle: 'Subscription tiers & MRR', icon: CreditCard, action: () => onNavigateTab('plans') },
    { id: 'nav-audit', type: 'Navigation', title: 'Go to Audit Log', subtitle: 'Platform activity & security records', icon: ScrollText, action: () => onNavigateTab('audit') },
    { id: 'nav-impersonation', type: 'Navigation', title: 'Go to Impersonation Sessions', subtitle: 'Support sessions & audit', icon: UserCheck, action: () => onNavigateTab('impersonation') },
    { id: 'nav-settings', type: 'Navigation', title: 'Go to Platform Settings', subtitle: 'Global configurations', icon: Settings, action: () => onNavigateTab('settings') }
  );

  // 2. Global Actions
  items.push(
    { id: 'act-user-panels', type: 'Action', title: 'View All User Panels Workstation', subtitle: 'Responsive tablet/mobile tester', icon: Smartphone, action: onOpenUserPanels },
    { id: 'act-refresh', type: 'Action', title: 'Refresh Platform Data', subtitle: 'Reload latest metrics & tenants', icon: RefreshCw, action: onRefresh },
    { id: 'act-theme', type: 'Action', title: `Switch to ${isDark ? 'Light' : 'Dark'} Theme`, subtitle: 'Toggle design system theme', icon: isDark ? Sun : Moon, action: onToggleTheme },
    { id: 'act-logout', type: 'Action', title: 'Sign Out of Super Admin', subtitle: 'Terminate platform session', icon: LogOut, action: onLogout }
  );

  // 3. Cafés items
  tenants.forEach((t) => {
    items.push({
      id: `cafe-${t.id}`,
      type: 'Café',
      title: t.name,
      subtitle: `${t.slug}.localhost:5173 · ${t.plan || 'starter'} · ${t.status}`,
      icon: Store,
      badge: t.status,
      action: () => onSelectTenant(t),
    });
  });

  const filteredItems = items.filter((item) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      item.type.toLowerCase().includes(q)
    );
  });

  // Handle keyboard arrows and Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((idx) => (idx + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((idx) => (idx - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          selected.action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0"
          style={{ backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(8px)' }}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="relative w-full max-w-2xl rounded-2xl border shadow-2xl text-[var(--text-primary)] overflow-hidden z-10 custom-scrollbar"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          {/* Search bar */}
          <div className="flex items-center gap-3 border-b border-[var(--border-primary)] px-4 py-3.5 bg-[var(--hover-bg)]/70">
            <Search size={18} className="text-amber-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search anything... (type a café name, view, or command)"
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
            />
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* Results list */}
          <div className="max-h-96 overflow-y-auto p-2 space-y-1">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                No matching café, navigation, or action found for "{query}".
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const Icon = item.icon;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 cursor-pointer text-xs transition ${
                      isSelected
                        ? 'bg-[var(--brand-primary-subtle)] border border-amber-300 dark:border-amber-500/30 text-[var(--text-primary)] font-semibold'
                        : 'hover:bg-[var(--hover-bg)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                          isSelected
                            ? 'border-amber-400/50 bg-amber-100 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300'
                            : 'border-[var(--border-primary)] bg-[var(--hover-bg)] text-[var(--text-muted)]'
                        }`}
                      >
                        <Icon size={14} />
                      </div>

                      <div>
                        <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                          <span>{item.title}</span>
                          {item.badge && (
                            <span
                              className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold uppercase border ${
                                item.badge === 'active'
                                  ? 'bg-[var(--status-active-bg)] text-[var(--status-active-text)] border-[var(--status-active-border)]'
                                  : 'bg-[var(--status-suspended-bg)] text-[var(--status-suspended-text)] border-[var(--status-suspended-border)]'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">{item.subtitle}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[var(--hover-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        {item.type}
                      </span>
                      {isSelected && <CornerDownLeft size={13} className="text-amber-500" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer tips */}
          <div className="flex items-center justify-between border-t border-[var(--border-primary)] bg-[var(--hover-bg)] px-4 py-2.5 text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="rounded border border-[var(--border-primary)] bg-[var(--bg-surface)] px-1 py-0.5 text-[10px] text-[var(--text-secondary)] font-mono font-bold">
                  ↑
                </kbd>{' '}
                <kbd className="rounded border border-[var(--border-primary)] bg-[var(--bg-surface)] px-1 py-0.5 text-[10px] text-[var(--text-secondary)] font-mono font-bold">
                  ↓
                </kbd>{' '}
                to navigate
              </span>
              <span>
                <kbd className="rounded border border-[var(--border-primary)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] font-mono font-bold">
                  ↵
                </kbd>{' '}
                to select
              </span>
              <span>
                <kbd className="rounded border border-[var(--border-primary)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] font-mono font-bold">
                  esc
                </kbd>{' '}
                to close
              </span>
            </div>

            <span className="text-amber-600 dark:text-amber-500/80 font-mono font-bold">⌘K / Ctrl+K</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}