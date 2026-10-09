import { useState, useMemo } from 'react';
import {
  Search, Filter, SlidersHorizontal, Download, ArrowUpDown, Copy, Check,
  MoreVertical, Eye, ArrowUpRight, ShieldAlert, CheckCircle2, UserPlus,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Store, ExternalLink,
  Layers, UtensilsCrossed, Calendar, Mail, User, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

// Plan Quota Caps for visual usage progress calculation
const PLAN_LIMITS = {
  starter: { maxTables: 15, maxProducts: 45 },
  pro: { maxTables: 50, maxProducts: 250 },
  enterprise: { maxTables: 150, maxProducts: 500 },
};

function formatRelativeTime(dateString) {
  if (!dateString) return 'Unknown';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

export default function TenantTable({
  tenants = [],
  loading = false,
  onRowClick,
  onOpenPanel,
  onImpersonate,
  onToggleStatus,
  onChangePlan,
  onInviteOwner,
  onViewAudit,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'suspended'
  const [planFilter, setPlanFilter] = useState('all'); // 'all' | 'starter' | 'pro' | 'enterprise'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'name' | 'products'
  const [density, setDensity] = useState('normal'); // 'normal' | 'compact'
  const [visibleColumns, setVisibleColumns] = useState({
    owner: true,
    status: true,
    plan: true,
    usage: true,
    joined: true,
  });

  // Selection & Pagination
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [openActionId, setOpenActionId] = useState(null);

  // Copy subdomain link
  const handleCopySubdomain = (e, slug) => {
    e.stopPropagation();
    const url = `http://${slug}.localhost:5173`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    toast.success(`Copied: ${url}`);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  // Filter & Sort Pipeline
  const filteredTenants = useMemo(() => {
    return tenants
      .filter((t) => {
        const matchesSearch =
          !search ||
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.slug.toLowerCase().includes(search.toLowerCase()) ||
          (t.ownerEmail && t.ownerEmail.toLowerCase().includes(search.toLowerCase()));

        const matchesStatus =
          statusFilter === 'all' || t.status === statusFilter;

        const matchesPlan =
          planFilter === 'all' || (t.plan || 'starter').toLowerCase() === planFilter.toLowerCase();

        return matchesSearch && matchesStatus && matchesPlan;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'products') return (b.productCount || 0) - (a.productCount || 0);
        return 0;
      });
  }, [tenants, search, statusFilter, planFilter, sortBy]);

  // Paginated Slice
  const totalPages = Math.ceil(filteredTenants.length / pageSize) || 1;
  const paginatedTenants = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTenants.slice(start, start + pageSize);
  }, [filteredTenants, page, pageSize]);

  // Bulk Selection Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredTenants.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (e, id) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // CSV Export
  const handleExportCSV = () => {
    const rows = [
      ['ID', 'Name', 'Slug', 'Status', 'Plan', 'Owner Email', 'Tables', 'Products', 'Joined Date'],
      ...filteredTenants.map((t) => [
        t.id,
        t.name,
        t.slug,
        t.status,
        t.plan,
        t.ownerEmail || 'Unassigned',
        t.tableCount || 0,
        t.productCount || 0,
        new Date(t.createdAt).toISOString(),
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `brewhaus_cafes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredTenants.length} cafés to CSV!`);
  };

  // Bulk status update
  const handleBulkStatusChange = (newStatus) => {
    if (selectedIds.size === 0) return;
    toast.success(`Triggered bulk ${newStatus} for ${selectedIds.size} café(s).`);
    selectedIds.forEach((id) => {
      const t = tenants.find((item) => item.id === id);
      if (t && t.status !== newStatus) {
        onToggleStatus(t, `Bulk administrative ${newStatus}`);
      }
    });
    setSelectedIds(new Set());
  };

  // Avatar generator helper
  const getAvatarInitials = (name) => {
    if (!name) return 'CA';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  const getStatusStyles = (status) => {
    if (status === 'active') {
      return {
        bg: 'var(--status-active-bg)',
        text: 'var(--status-active-text)',
        border: 'var(--status-active-border)',
        dot: 'var(--status-active-dot)',
      };
    }
    return {
      bg: 'var(--status-suspended-bg)',
      text: 'var(--status-suspended-text)',
      border: 'var(--status-suspended-border)',
      dot: 'var(--status-suspended-dot)',
    };
  };

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 shadow-xs md:flex-row md:items-center md:justify-between transition-colors">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-3 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search cafés by name, slug, or owner email..."
            className="input-field pl-10"
          />
        </div>

        {/* Right: Filters, Sort, Density, Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input-field min-w-[150px]"
          >
            <option value="all">Status: All</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>

          {/* Plan filter */}
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="input-field min-w-[140px]"
          >
            <option value="all">Plan: All Tiers</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>

          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field min-w-[150px]"
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="name">Sort: Name (A-Z)</option>
            <option value="products">Sort: Menu Size</option>
          </select>

          {/* Density Toggle */}
          <button
            onClick={() => setDensity((d) => (d === 'normal' ? 'compact' : 'normal'))}
            className="rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition"
            title="Toggle Row Density"
          >
            {density === 'normal' ? 'Comfortable' : 'Compact'}
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Bulk Actions Floating Bar ────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/40 bg-[var(--warning-bg)] px-4 py-2.5 text-xs text-[var(--warning-text)] shadow-md animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--warning-text)]">{selectedIds.size}</span>
            <span>café(s) selected across current filter</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkStatusChange('active')}
              className="rounded-lg border border-emerald-500/30 bg-[var(--success-bg)] px-3 py-1 font-semibold text-[var(--success-text)] hover:bg-[var(--success-bg)] transition"
            >
              Reactivate Selected
            </button>
            <button
              onClick={() => handleBulkStatusChange('suspended')}
              className="rounded-lg border border-red-500/30 bg-[var(--danger-bg)] px-3 py-1 font-semibold text-[var(--danger-text)] hover:bg-[var(--danger-bg)] transition"
            >
              Suspend Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg bg-[var(--hover-bg)] px-2.5 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Main Table Card ─────────────────────────────────────── */}
      <div className="table-container">
        {loading ? (
          <div className="p-12 text-center text-[var(--text-muted)] space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <p className="text-xs">Loading registered platform cafés...</p>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="py-16 text-center text-[var(--text-muted)] space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--hover-bg)] text-[var(--text-muted)]">
              <Store size={24} />
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">No cafés found</div>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              No registered cafés match your search query or active filter criteria.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setPlanFilter('all');
              }}
              className="rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header border-b border-[var(--table-border)]">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredTenants.length > 0 &&
                        selectedIds.size === filteredTenants.length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-[var(--border-primary)] bg-[var(--input-bg)] text-amber-500 focus:ring-0"
                    />
                  </th>
                  <th className="py-3 px-4 font-bold text-[var(--text-secondary)]">Café & Subdomain</th>
                  {visibleColumns.owner && <th className="py-3 px-4 font-bold text-[var(--text-secondary)]">Owner</th>}
                  {visibleColumns.status && <th className="py-3 px-4 font-bold text-[var(--text-secondary)]">Status</th>}
                  {visibleColumns.plan && <th className="py-3 px-4 font-bold text-[var(--text-secondary)]">Plan</th>}
                  {visibleColumns.usage && <th className="py-3 px-4 font-bold text-[var(--text-secondary)]">Usage vs Quota</th>}
                  {visibleColumns.joined && <th className="py-3 px-4 font-bold text-[var(--text-secondary)]">Joined</th>}
                  <th className="py-3 px-6 font-bold text-[var(--text-secondary)] text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--table-border)] text-[var(--text-primary)]">
                {paginatedTenants.map((t) => {
                  const isSelected = selectedIds.has(t.id);
                  const isSuspended = t.status === 'suspended';
                  const limits = PLAN_LIMITS[t.plan || 'starter'] || PLAN_LIMITS.starter;
                  const tablePercent = Math.min(100, Math.round(((t.tableCount || 0) / limits.maxTables) * 100));
                  const productPercent = Math.min(100, Math.round(((t.productCount || 0) / limits.maxProducts) * 100));
                  const isOwnerUnassigned = !t.ownerEmail || t.ownerEmail === 'N/A';
                  const statusStyles = getStatusStyles(t.status);

                  return (
                    <tr
                      key={t.id}
                      onClick={() => onRowClick && onRowClick(t)}
                      className={`cursor-pointer transition group ${
                        isSelected
                          ? 'bg-[var(--table-row-selected)]'
                          : 'hover:bg-[var(--table-row-hover)]'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelect(e, t.id)}
                          className="rounded border-[var(--border-primary)] bg-[var(--input-bg)] text-amber-500 focus:ring-0"
                        />
                      </td>

                      {/* Café & Subdomain */}
                      <td className={`${density === 'compact' ? 'py-2.5' : 'py-3.5'} px-4`}>
                        <div className="flex items-center gap-3">
                          {/* Logo / Initial Avatar */}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 font-bold text-xs shadow-inner">
                            {t.settings?.logoUrl ? (
                              <img src={t.settings.logoUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                            ) : (
                              getAvatarInitials(t.name)
                            )}
                          </div>

                          <div>
                            <div className="font-bold text-[var(--text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-300 transition flex items-center gap-1.5">
                              <span>{t.name}</span>
                            </div>

                            {/* Copyable Subdomain link */}
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                                {t.slug}.localhost:5173
                              </span>
                              <button
                                onClick={(e) => handleCopySubdomain(e, t.slug)}
                                className="p-0.5 text-[var(--text-muted)] hover:text-amber-600 dark:hover:text-amber-400 transition"
                                title="Copy subdomain link"
                              >
                                {copiedSlug === t.slug ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      {visibleColumns.owner && (
                        <td className={`${density === 'compact' ? 'py-2.5' : 'py-3.5'} px-4`}>
                          {isOwnerUnassigned ? (
                            <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="rounded-md border border-[var(--border-primary)] bg-[var(--hover-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                                Unassigned
                              </span>
                              <button
                                onClick={() => onInviteOwner && onInviteOwner(t)}
                                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                              >
                                <UserPlus size={11} /> Invite
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium text-[var(--text-primary)] truncate max-w-[170px]">
                                {t.ownerName && t.ownerName !== 'N/A' ? t.ownerName : t.ownerEmail}
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[170px]">{t.ownerEmail}</div>
                            </div>
                          )}
                        </td>
                      )}

                      {/* Status */}
                      {visibleColumns.status && (
                        <td className={`${density === 'compact' ? 'py-2.5' : 'py-3.5'} px-4`}>
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                            style={{
                              backgroundColor: statusStyles.bg,
                              color: statusStyles.text,
                              borderColor: statusStyles.border,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: statusStyles.dot }}
                            />
                            {t.status}
                          </span>
                        </td>
                      )}

                      {/* Plan */}
                      {visibleColumns.plan && (
                        <td className={`${density === 'compact' ? 'py-2.5' : 'py-3.5'} px-4`}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangePlan && onChangePlan(t);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-primary)] bg-[var(--hover-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-300 transition"
                            title="Click to change plan"
                          >
                            <span className="capitalize">{t.plan || 'Starter'}</span>
                            <span className="text-[9px] text-[var(--text-muted)]">✎</span>
                          </button>
                        </td>
                      )}

                      {/* Usage Progress */}
                      {visibleColumns.usage && (
                        <td className={`${density === 'compact' ? 'py-2.5' : 'py-3.5'} px-4`}>
                          <div className="space-y-1.5 min-w-[120px]">
                            {/* Tables Usage */}
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-[var(--text-muted)]">Tables</span>
                              <span className="font-semibold text-[var(--text-primary)]">
                                {t.tableCount || 0}/{limits.maxTables}
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[var(--border-primary)] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  tablePercent > 85 ? 'bg-amber-500' : 'bg-cyan-500'
                                }`}
                                style={{ width: `${tablePercent}%` }}
                              />
                            </div>

                            {/* Products Usage */}
                            <div className="flex items-center justify-between text-[10px] pt-0.5">
                              <span className="text-[var(--text-muted)]">Items</span>
                              <span className="font-semibold text-[var(--text-primary)]">
                                {t.productCount || 0}/{limits.maxProducts}
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[var(--border-primary)] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  productPercent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${productPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Joined Date */}
                      {visibleColumns.joined && (
                        <td className={`${density === 'compact' ? 'py-2.5' : 'py-3.5'} px-4`}>
                          <div className="text-[var(--text-primary)]" title={new Date(t.createdAt).toLocaleString()}>
                            {formatRelativeTime(t.createdAt)}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                      )}

                      {/* Actions */}
                      <td
                        className={`${density === 'compact' ? 'py-2.5' : 'py-3.5'} px-6 text-right`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* Primary: Open User Panel */}
                          <button
                            onClick={() => onOpenPanel && onOpenPanel(t)}
                            className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-[var(--brand-primary-subtle)] px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition"
                            title="Open Customer QR Ordering Panel"
                          >
                            <Eye size={13} />
                            <span>Open panel</span>
                          </button>

                          {/* Overflow Menu */}
                          <div className="relative">
                            <button
                              onClick={() => setOpenActionId(openActionId === t.id ? null : t.id)}
                              className="rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition"
                              title="More options"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {openActionId === t.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="dropdown-menu"
                              >
                                <button
                                  onClick={() => {
                                    setOpenActionId(null);
                                    onImpersonate && onImpersonate(t);
                                  }}
                                  className="dropdown-item"
                                >
                                  <ArrowUpRight size={13} /> Impersonate Session
                                </button>

                                <button
                                  onClick={() => {
                                    setOpenActionId(null);
                                    onChangePlan && onChangePlan(t);
                                  }}
                                  className="dropdown-item"
                                >
                                  <Layers size={13} /> Change Plan Tier
                                </button>

                                <button
                                  onClick={() => {
                                    setOpenActionId(null);
                                    onRowClick && onRowClick(t);
                                  }}
                                  className="dropdown-item"
                                >
                                  <Store size={13} /> View Café Drawer
                                </button>

                                <button
                                  onClick={() => {
                                    setOpenActionId(null);
                                    onViewAudit && onViewAudit(t);
                                  }}
                                  className="dropdown-item"
                                >
                                  <Calendar size={13} /> Audit History
                                </button>

                                <button
                                  onClick={() => {
                                    setOpenActionId(null);
                                    navigator.clipboard.writeText(t.id);
                                    toast.success(`Copied ID: ${t.id}`);
                                  }}
                                  className="dropdown-item"
                                >
                                  <Copy size={13} /> Copy Tenant ID
                                </button>

                                <div className="dropdown-divider" />

                                <button
                                  onClick={() => {
                                    setOpenActionId(null);
                                    onToggleStatus && onToggleStatus(t);
                                  }}
                                  className={`dropdown-item font-semibold transition ${
                                    isSuspended
                                      ? 'text-emerald-600 dark:text-emerald-400 hover:bg-[var(--success-bg)]'
                                      : 'text-red-600 dark:text-red-400 hover:bg-[var(--danger-bg)]'
                                  }`}
                                >
                                  <ShieldAlert size={13} />
                                  {isSuspended ? 'Reactivate Café' : 'Suspend Café'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Footer ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--border-primary)]/80 bg-[var(--hover-bg)]/70 px-6 py-4 text-xs text-[var(--text-muted)] transition-colors">
          <div className="flex items-center gap-3">
            <span>
              Showing{' '}
              <strong className="text-[var(--text-primary)] font-bold">
                {filteredTenants.length === 0 ? 0 : (page - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-[var(--text-primary)] font-bold">
                {Math.min(filteredTenants.length, page * pageSize)}
              </strong>{' '}
              of <strong className="text-[var(--text-primary)] font-bold">{filteredTenants.length}</strong> cafés
            </span>

            <div className="flex items-center gap-1.5 pl-3 border-l border-[var(--border-primary)]">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="input-field min-w-[60px]"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-30 transition"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-30 transition"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-2 text-[var(--text-secondary)] font-medium">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-30 transition"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] disabled:opacity-30 transition"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}