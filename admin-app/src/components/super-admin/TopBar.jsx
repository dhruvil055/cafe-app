import { useState } from 'react';
import {
  Menu, Search, RefreshCw, Bell, ShieldCheck,
  LogOut, Smartphone, CheckCircle2, ChevronDown, Sparkles
} from 'lucide-react';

export default function TopBar({
  onOpenMobileSidebar,
  onOpenCommandPalette,
  activeTabTitle = 'Overview',
  adminUser,
  onLogout,
  onRefresh,
  loading = false,
  onOpenUserPanels,
  activeAlertCount = 0,
}) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-[var(--header-border)] bg-[var(--header-bg)] backdrop-blur-md px-4 sm:px-6 transition-colors duration-200">
      <div className="flex h-full items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left: Mobile hamburger + Active Section */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] p-2 text-[var(--header-text-muted)] hover:text-[var(--header-text)] transition"
          >
            <Menu size={18} />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[var(--header-text)] tracking-tight">{activeTabTitle}</h1>
              {/* Environment badge */}
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Production
              </span>
            </div>
            <div className="hidden sm:block text-[11px] text-[var(--header-text-muted)]">
              Brewhaus Cloud Multi-Tenant SaaS Engine
            </div>
          </div>
        </div>

        {/* Center: Command Palette Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)]/80 px-3.5 py-2 text-xs text-[var(--header-text-muted)] hover:border-amber-500/40 hover:text-[var(--header-text)] transition shadow-inner"
          >
            <div className="flex items-center gap-2.5">
              <Search size={14} className="text-amber-500" />
              <span>Search cafés, commands or views...</span>
            </div>
            <kbd className="rounded border border-[var(--border-primary)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--header-text-muted)] shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Action Icons & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile search trigger */}
          <button
            onClick={onOpenCommandPalette}
            className="md:hidden rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] p-2 text-[var(--header-text-muted)] hover:text-[var(--header-text)] transition"
            title="Search (⌘K)"
          >
            <Search size={16} />
          </button>

          {/* Refresh Platform Data */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] p-2 text-[var(--header-text-muted)] hover:text-[var(--header-text)] hover:bg-[var(--hover-bg)] transition disabled:opacity-40"
            title="Refresh Platform Telemetry"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Notifications Popover */}
          <div className="relative">
            <button
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="relative rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] p-2 text-[var(--header-text-muted)] hover:text-[var(--header-text)] hover:bg-[var(--hover-bg)] transition"
              title="Notifications"
            >
              <Bell size={15} />
              {activeAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white">
                  {activeAlertCount}
                </span>
              )}
            </button>

            {notificationOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-[var(--border-primary)] bg-[var(--popover-bg)] p-3 shadow-2xl text-xs z-30"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-primary)] font-bold text-[var(--text-primary)]">
                  <span>Platform Notifications</span>
                  <span className="text-[10px] text-amber-500 font-bold">Live</span>
                </div>
                <div className="py-3 space-y-2 text-[var(--text-secondary)]">
                  <div className="flex items-start gap-2 bg-[var(--hover-bg)] p-2.5 rounded-xl border border-[var(--border-primary)]">
                    <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">Platform Health 100%</div>
                      <div className="text-[10px] text-[var(--text-muted)]">All registered café subdomains active and online.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-[var(--hover-bg)] p-2.5 rounded-xl border border-[var(--border-primary)]">
                    <ShieldCheck size={14} className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">Pure Vegetarian Filter</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Zero-meat / zero-egg verification active across all menus.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-[var(--border-primary)] mx-1 hidden sm:block" />

          {/* Admin Avatar Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] py-1.5 px-2.5 text-xs font-semibold text-[var(--header-text)] hover:border-amber-500/40 transition"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                SA
              </div>
              <span className="hidden sm:inline font-bold text-[var(--header-text)]">Super Admin</span>
              <ChevronDown size={12} className="text-[var(--header-text-muted)]" />
            </button>

            {profileDropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-[var(--border-primary)] bg-[var(--popover-bg)] p-1.5 shadow-2xl text-xs z-30"
              >
                <div className="px-3 py-2 border-b border-[var(--border-primary)] text-[11px]">
                  <div className="font-bold text-[var(--text-primary)]">{adminUser?.name || 'Platform Administrator'}</div>
                  <div className="text-[var(--text-muted)] font-mono text-[10px] truncate">{adminUser?.email || 'admin@brewhaus.com'}</div>
                </div>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    onOpenUserPanels();
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-amber-600 dark:hover:text-amber-400 transition"
                >
                  <Smartphone size={13} /> User Panels Workstation
                </button>

                <div className="my-1 border-t border-[var(--border-primary)]" />

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                >
                  <LogOut size={13} /> Exit Platform Admin
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}