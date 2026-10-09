import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Store, ArrowUpRight, ShieldAlert, CheckCircle2, Eye, ExternalLink,
  Layers, Copy, Calendar, Mail, MapPin, Phone, DollarSign, Clock, Check
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TenantDrawer({
  isOpen,
  onClose,
  tenant,
  auditLogs = [],
  onOpenPanel,
  onImpersonate,
  onChangePlan,
  onToggleStatus,
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'settings' | 'orders' | 'audit'
  const [copied, setCopied] = useState(false);

  if (!isOpen || !tenant) return null;

  const handleCopyLink = () => {
    const url = `http://${tenant.slug}.localhost:5173`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Subdomain copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const isSuspended = tenant.status === 'suspended';

  // Filter audit logs for this specific tenant
  const tenantAuditLogs = auditLogs.filter(
    (log) =>
      log.targetTenantSlug === tenant.slug ||
      String(log.targetTenantId) === String(tenant.id) ||
      (log.details && log.details.targetTenantSlug === tenant.slug)
  );

  // Realistic mock recent orders for this tenant
  const mockRecentOrders = [
    { id: 'ORD-8921', table: 'Table 4', total: '₹480', status: 'completed', time: '12m ago', items: 3 },
    { id: 'ORD-8920', table: 'Table 2', total: '₹720', status: 'preparing', time: '28m ago', items: 4 },
    { id: 'ORD-8919', table: 'Table 6', total: '₹340', status: 'completed', time: '1h ago', items: 2 },
    { id: 'ORD-8918', table: 'Table 1', total: '₹950', status: 'completed', time: '2h ago', items: 5 },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0"
          style={{ backgroundColor: 'var(--drawer-backdrop)', backdropFilter: 'blur(4px)' }}
        />

        {/* Drawer panel */}
        <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="w-screen max-w-xl flex flex-col justify-between custom-scrollbar"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderLeftColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--popover-shadow)',
            }}
          >
            {/* Header */}
            <div className="p-6 border-b border-[var(--border-primary)] bg-[var(--hover-bg)]/80">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 font-bold text-base shadow-inner">
                    {tenant.settings?.logoUrl ? (
                      <img src={tenant.settings.logoUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
                    ) : (
                      tenant.name.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">{tenant.name}</h2>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border"
                        style={{
                          backgroundColor: isSuspended ? 'var(--status-suspended-bg)' : 'var(--status-active-bg)',
                          color: isSuspended ? 'var(--status-suspended-text)' : 'var(--status-active-text)',
                          borderColor: isSuspended ? 'var(--status-suspended-border)' : 'var(--status-active-border)',
                        }}
                      >
                        {tenant.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <a
                        href={`http://${tenant.slug}.localhost:5173`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                      >
                        {tenant.slug}.localhost:5173 <ExternalLink size={10} />
                      </a>
                      <button
                        onClick={handleCopyLink}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                        title="Copy link"
                      >
                        {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Quick Actions Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
                <button
                  onClick={() => onOpenPanel && onOpenPanel(tenant)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-[var(--brand-primary-subtle)] py-2 px-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition"
                >
                  <Eye size={12} /> User Panel
                </button>

                <button
                  onClick={() => onImpersonate && onImpersonate(tenant)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] py-2 px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-300 transition"
                >
                  <ArrowUpRight size={12} /> Impersonate
                </button>

                <button
                  onClick={() => onChangePlan && onChangePlan(tenant)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] py-2 px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-300 transition"
                >
                  <Layers size={12} /> Plan ({tenant.plan})
                </button>

                <button
                  onClick={() => onToggleStatus && onToggleStatus(tenant)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2.5 text-xs font-semibold transition ${
                    isSuspended
                      ? 'border border-emerald-500/30 bg-[var(--success-bg)] text-[var(--success-text)] hover:bg-[var(--success-bg)]'
                      : 'border border-red-500/30 bg-[var(--danger-bg)] text-[var(--danger-text)] hover:bg-[var(--danger-bg)]'
                  }`}
                >
                  <ShieldAlert size={12} /> {isSuspended ? 'Reactivate' : 'Suspend'}
                </button>
              </div>

              {/* Drawer Tabs Navigation */}
              <div className="flex border-b border-[var(--border-primary)] mt-5 -mb-6 space-x-6">
                {[
                  { id: 'overview', label: 'Overview & Usage' },
                  { id: 'settings', label: 'Branding & Info' },
                  { id: 'orders', label: 'Recent Orders' },
                  { id: 'audit', label: `Audit Trail (${tenantAuditLogs.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-3 text-xs font-semibold tracking-wide transition border-b-2 -mb-px ${
                      activeTab === tab.id
                        ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Contents */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* TAB 1: Overview & Usage */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Quotas & Counts */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                      Resource Usage & Allocation
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="kpi-card">
                        <div className="text-[11px] text-[var(--text-muted)]">Total QR Tables</div>
                        <div className="text-2xl font-black text-[var(--text-primary)] mt-1 tabular-nums">
                          {tenant.tableCount || 0}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Assigned dine-in stations</div>
                      </div>

                      <div className="kpi-card">
                        <div className="text-[11px] text-[var(--text-muted)]">Menu Food & Beverages</div>
                        <div className="text-2xl font-black text-[var(--text-primary)] mt-1 tabular-nums">
                          {tenant.productCount || 0}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Active catalog items</div>
                      </div>
                    </div>
                  </div>

                  {/* Owner Credentials */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                      Account Ownership
                    </h3>
                    <div className="kpi-card space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">Owner Name:</span>
                        <span className="font-semibold text-[var(--text-primary)]">{tenant.ownerName || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">Contact Email:</span>
                        <span className="font-mono text-[var(--text-secondary)]">{tenant.ownerEmail || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">Tenant UUID:</span>
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">{tenant.id}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)]">Registration Date:</span>
                        <span className="text-[var(--text-secondary)]">{new Date(tenant.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Subscription Details */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                      Subscription Plan
                    </h3>
                    <div className="kpi-card flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[var(--text-primary)] capitalize">{tenant.plan || 'Starter'} Tier</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          Status: {tenant.subscription?.status || 'Active'}
                        </div>
                      </div>
                      <button
                        onClick={() => onChangePlan && onChangePlan(tenant)}
                        className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition"
                      >
                        Change Tier
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Branding & Info */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <div className="kpi-card space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">Café Display Name:</span>
                      <span className="font-semibold text-[var(--text-primary)]">{tenant.settings?.cafeName || tenant.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">Tagline / Pitch:</span>
                      <span className="text-[var(--text-secondary)] italic">{tenant.settings?.tagline || 'None configured'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">Primary Brand Accent:</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full border border-[var(--border-primary)]"
                          style={{ backgroundColor: tenant.settings?.primaryColor || '#c96b18' }}
                        />
                        <span className="font-mono text-[var(--text-secondary)]">{tenant.settings?.primaryColor || '#c96b18'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">Currency & Tax:</span>
                      <span className="text-[var(--text-secondary)] font-medium">
                        {tenant.settings?.currency || 'INR'} (Tax: {tenant.settings?.taxRate ?? 5}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">Address:</span>
                      <span className="text-[var(--text-secondary)]">{tenant.settings?.address || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)]">Support Phone:</span>
                      <span className="text-[var(--text-secondary)]">{tenant.settings?.contactPhone || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Recent Orders */}
              {activeTab === 'orders' && (
                <div className="space-y-3">
                  <div className="text-xs text-[var(--text-muted)]">
                    Latest dining transactions processed by {tenant.name}:
                  </div>
                  {mockRecentOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] text-xs"
                    >
                      <div>
                        <div className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                          <span>{ord.id}</span>
                          <span className="text-[var(--text-muted)] font-normal">· {ord.table}</span>
                          <span className="status-active text-[9px]">{ord.status}</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          {ord.items} items ordered · {ord.time}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-amber-600 dark:text-amber-400 tabular-nums">{ord.total}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">Paid online</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: Audit Trail */}
              {activeTab === 'audit' && (
                <div className="space-y-3">
                  {tenantAuditLogs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                      No specific administrative events logged for this café yet.
                    </div>
                  ) : (
                    tenantAuditLogs.map((log) => (
                      <div
                        key={log._id || Math.random()}
                        className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--hover-bg)] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-600 dark:text-amber-400">{log.action}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[var(--text-muted)] text-[11px]">
                          Actor: <span className="text-[var(--text-secondary)]">{log.actorEmail}</span>
                        </div>
                        {log.details?.reason && (
                          <div className="text-[var(--text-secondary)] italic text-[11px]">
                            Reason: "{log.details.reason}"
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--hover-bg)] flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Tenant ID: {tenant.id}</span>
              <button
                onClick={onClose}
                className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-4 py-2 font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition"
              >
                Close Drawer
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}