import { useState, useMemo } from 'react';
import {
  ShieldAlert, ArrowUpRight, Store, Key, Settings,
  Clock, Search, Download, User, Globe
} from 'lucide-react';

function getHumanSentence(log) {
  const action = log.action || '';
  const target = log.targetTenantSlug ? `"${log.targetTenantSlug}"` : 'platform';

  if (action === 'tenant.suspend') {
    return `Administrator suspended café ${target}`;
  }
  if (action === 'tenant.reactivate') {
    return `Administrator reactivated café ${target}`;
  }
  if (action === 'tenant.plan_change') {
    const p = log.details?.newPlan ? `to ${log.details.newPlan.toUpperCase()}` : '';
    return `Subscription plan updated for ${target} ${p}`;
  }
  if (action === 'tenant.create') {
    return `New tenant ${target} provisioned on platform`;
  }
  if (action === 'tenant.impersonate_start') {
    return `Impersonation session initiated for ${target}`;
  }
  if (action === 'tenant.impersonate_exit') {
    return `Impersonation session ended for ${target}`;
  }
  if (action === 'auth.login') {
    return `${log.actorEmail} logged into Super Admin`;
  }
  if (action === 'auth.logout') {
    return `${log.actorEmail} logged out from Super Admin`;
  }
  if (action === 'platform.settings_change') {
    return `Global platform configuration updated`;
  }
  if (action.includes('fail') || action.includes('lock')) {
    return `Security alert: ${action} triggered by ${log.actorEmail || 'unknown'}`;
  }
  return `${log.action} executed on ${target}`;
}

function getEventCategory(action = '') {
  if (action.includes('suspend') || action.includes('reactivate') || action.includes('delete')) return 'status';
  if (action.includes('impersonate')) return 'impersonation';
  if (action.includes('plan')) return 'billing';
  if (action.includes('auth') || action.includes('lock')) return 'security';
  if (action.includes('settings')) return 'settings';
  return 'general';
}

function getEventBadge(category) {
  switch (category) {
    case 'status':
      return { label: 'Tenant Status', color: 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]', icon: ShieldAlert };
    case 'impersonation':
      return { label: 'Impersonation', color: 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]', icon: ArrowUpRight };
    case 'billing':
      return { label: 'Subscription', color: 'border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info-text)]', icon: Key };
    case 'settings':
      return { label: 'Config', color: 'border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400', icon: Settings };
    default:
      return { label: 'Security', color: 'border-[var(--border-primary)] bg-[var(--hover-bg)] text-[var(--text-secondary)]', icon: Store };
  }
}

export default function AuditTimeline({ logs = [], loading = false }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const cat = getEventCategory(log.action);
      const matchesCategory = categoryFilter === 'all' || cat === categoryFilter;
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        (log.action && log.action.toLowerCase().includes(searchLower)) ||
        (log.actorEmail && log.actorEmail.toLowerCase().includes(searchLower)) ||
        (log.targetTenantSlug && log.targetTenantSlug.toLowerCase().includes(searchLower)) ||
        (log.details?.reason && log.details.reason.toLowerCase().includes(searchLower));

      return matchesCategory && matchesSearch;
    });
  }, [logs, search, categoryFilter]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  const handleExportAudit = () => {
    const rows = [
      ['Timestamp', 'Action', 'Category', 'Actor', 'Target Café', 'IP', 'Reason'],
      ...filteredLogs.map((l) => [
        new Date(l.createdAt).toISOString(),
        l.action,
        getEventCategory(l.action),
        l.actorEmail || 'System',
        l.targetTenantSlug || 'N/A',
        l.ip || 'Internal',
        l.details?.reason || '',
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `brewhaus_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 kpi-card">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-3 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search audit trail by actor, action, café or reason..."
            className="input-field pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="input-field"
          >
            <option value="all">All Event Categories</option>
            <option value="status">Status & Suspension</option>
            <option value="impersonation">Impersonation Sessions</option>
            <option value="billing">Plan & Billing</option>
            <option value="security">Security & Authentication</option>
            <option value="settings">Platform Settings</option>
          </select>

          <button
            onClick={handleExportAudit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Timeline List Card */}
      <div className="kpi-card p-6">
        {loading ? (
          <div className="py-12 text-center text-[var(--text-muted)] text-xs">
            Loading platform audit entries...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)] text-xs">
            No audit records found matching your filters.
          </div>
        ) : (
          <div className="relative pl-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[var(--border-primary)] space-y-6">
            {paginatedLogs.map((log) => {
              const cat = getEventCategory(log.action);
              const badge = getEventBadge(cat);
              const BadgeIcon = badge.icon;
              const sentence = getHumanSentence(log);

              return (
                <div key={log._id || Math.random()} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-muted)] group-hover:border-amber-500 group-hover:text-amber-500 transition">
                    <div className="h-1.5 w-1.5 rounded-full bg-current" />
                  </div>

                  <div className="rounded-2xl border border-[var(--border-primary)]/80 bg-[var(--hover-bg)]/70 p-4 hover:border-[var(--border-primary)] transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${badge.color}`}
                        >
                          <BadgeIcon size={10} /> {badge.label}
                        </span>

                        <span className="font-mono text-[11px] text-[var(--text-muted)]">{log.action}</span>
                      </div>

                      <div
                        className="text-[11px] text-[var(--text-muted)] flex items-center gap-1"
                        title={new Date(log.createdAt).toLocaleString()}
                      >
                        <Clock size={11} />
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Human readable sentence */}
                    <div className="mt-2 text-sm font-semibold text-[var(--text-primary)] tracking-tight">
                      {sentence}
                    </div>

                    {/* Details row: actor, target, IP */}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] border-t border-[var(--border-primary)]/80 pt-2.5">
                      <span className="flex items-center gap-1.5">
                        <User size={12} className="text-[var(--text-muted)]" />
                        Actor: <strong className="text-[var(--text-secondary)]">{log.actorEmail || 'System'}</strong>
                      </span>

                      {log.targetTenantSlug && (
                        <span className="flex items-center gap-1.5">
                          <Store size={12} className="text-[var(--text-muted)]" />
                          Target: <strong className="text-amber-600 dark:text-amber-400">{log.targetTenantSlug}</strong>
                        </span>
                      )}

                      {log.ip && (
                        <span className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-muted)]">
                          <Globe size={11} /> {log.ip}
                        </span>
                      )}

                      {log.details?.reason && (
                        <span className="w-full text-[11px] text-[var(--text-secondary)] italic bg-[var(--warning-bg)] border border-[var(--warning-border)] px-2.5 py-1.5 rounded-lg">
                          Reason: "{log.details.reason}"
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {filteredLogs.length > pageSize && (
          <div className="flex items-center justify-between border-t border-[var(--border-primary)] pt-4 mt-6 text-xs text-[var(--text-muted)]">
            <span>
              Showing Page <strong className="text-[var(--text-primary)]">{page}</strong> of{' '}
              <strong className="text-[var(--text-primary)]">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3 py-1.5 font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] disabled:opacity-30 transition"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3 py-1.5 font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] disabled:opacity-30 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}