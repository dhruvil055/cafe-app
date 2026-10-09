import {
  LayoutDashboard, Store, CreditCard, ScrollText, UserCheck,
  Settings, Smartphone, LogOut, ChevronLeft, ChevronRight,
  ShieldCheck, Moon, Sun, X
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'tenants', label: 'Cafés Directory', icon: Store, badgeKey: 'tenantCount' },
  { id: 'plans', label: 'Plans & Billing', icon: CreditCard },
  { id: 'audit', label: 'Audit Trail', icon: ScrollText },
  { id: 'impersonation', label: 'Impersonations', icon: UserCheck },
  { id: 'settings', label: 'Platform Settings', icon: Settings },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  tenantCount = 0,
  adminUser = null,
  onLogout,
  onOpenUserPanels,
  onToggleTheme,
}) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Container: Sticky 100vh on desktop, fixed slide-over on mobile */}
      <aside
        className="fixed inset-y-0 left-0 z-40 flex flex-col h-screen shrink-0 border-r transition-all duration-300 lg:sticky lg:top-0 custom-scrollbar
          bg-[var(--sidebar-bg)] border-[var(--sidebar-border)] text-[var(--sidebar-text)]
          shadow-xl
          ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}"
      >
        {/* ── 1. Top Brand Header (h-16 pinned) ───────────────── */}
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-[var(--sidebar-border)]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/10 border border-amber-500/40 text-amber-500 font-bold shadow-inner">
              <ShieldCheck size={20} />
            </div>

            {!isCollapsed && (
              <div className="truncate">
                <span className="font-display text-sm font-bold tracking-tight text-[var(--sidebar-text)] block truncate">
                  Brewhaus Core
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 block">
                  Super Admin
                </span>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--sidebar-border)] text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)] transition"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] transition rounded-lg hover:bg-[var(--sidebar-hover-bg)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── 2. Middle: Navigation Items List (Scrollable) ───── */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
          {!isCollapsed && (
            <div className="px-2 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--sidebar-text-muted)]">
              Platform Modules
            </div>
          )}

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition group ${
                    isActive
                      ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] border border-[var(--sidebar-active-border)] shadow-sm'
                      : 'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)] border border-transparent'
                  }`}
                >
                  <Icon
                    size={17}
                    className={`shrink-0 transition ${
                      isActive
                        ? 'text-[var(--sidebar-active-border)]'
                        : 'text-[var(--sidebar-text-muted)] group-hover:text-[var(--sidebar-text)]'
                    }`}
                  />

                  {!isCollapsed && (
                    <div className="flex flex-1 items-center justify-between truncate">
                      <span className="truncate">{item.label}</span>
                      {item.badgeKey === 'tenantCount' && tenantCount > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isActive
                              ? 'bg-[var(--sidebar-active-border)]/30 text-[var(--sidebar-active-text)]'
                              : 'bg-[var(--sidebar-hover-bg)] text-[var(--sidebar-text-muted)]'
                          }`}
                        >
                          {tenantCount}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── 3. Bottom Section: Pinned at bottom of screen ────── */}
        <div className="shrink-0 p-3 space-y-2 border-t border-[var(--sidebar-border)] bg-[var(--sidebar-hover-bg)]/60">
          {/* Workstation Launcher */}
          <button
            onClick={() => {
              onOpenUserPanels();
              if (onCloseMobile) onCloseMobile();
            }}
            title={isCollapsed ? 'User Panel Workstation' : undefined}
            className={`w-full flex items-center gap-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-2.5 px-3 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <Smartphone size={16} className="shrink-0 text-cyan-600 dark:text-cyan-400" />
            {!isCollapsed && <span className="truncate font-bold">User Panel Workstation</span>}
          </button>

          {/* Theme Switcher Quick Toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={isCollapsed ? (document.documentElement.getAttribute('data-theme') === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode') : undefined}
              className={`w-full flex items-center gap-2.5 rounded-xl border border-[var(--sidebar-border)] bg-[var(--bg-surface)] py-2 px-3 text-xs font-semibold text-[var(--sidebar-text)] hover:border-amber-500/40 transition shadow-2xs ${
                isCollapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              <div className="flex items-center gap-2">
                {document.documentElement.getAttribute('data-theme') === 'dark' ? (
                  <Sun size={15} className="text-amber-400 shrink-0" />
                ) : (
                  <Moon size={15} className="text-slate-600 shrink-0" />
                )}
                {!isCollapsed && (
                  <span>{document.documentElement.getAttribute('data-theme') === 'dark' ? 'Dark Theme' : 'Light Theme'}</span>
                )}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] uppercase font-bold text-[var(--sidebar-text-muted)]">
                  Toggle
                </span>
              )}
            </button>
          )}

          {/* Admin User Profile Chip & Logout */}
          <div className={`pt-2 border-t border-[var(--sidebar-border)]/80 flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs">
              SA
            </div>

            {!isCollapsed && (
              <div className="flex-1 truncate">
                <div className="text-xs font-bold text-[var(--sidebar-text)] truncate">
                  {adminUser?.name || 'Platform Admin'}
                </div>
                <div className="text-[10px] text-[var(--sidebar-text-muted)] font-mono truncate">
                  {adminUser?.email || 'admin@brewhaus.com'}
                </div>
              </div>
            )}

            {!isCollapsed && (
              <button
                onClick={onLogout}
                className="p-1.5 text-[var(--sidebar-text-muted)] hover:text-red-600 dark:hover:text-red-400 transition rounded-lg hover:bg-[var(--sidebar-hover-bg)]"
                title="Sign out of Super Admin"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}