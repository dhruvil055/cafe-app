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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        />

        {/* Drawer panel */}
        <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="w-screen max-w-xl bg-white dark:bg-stone-900 border-l border-slate-200 dark:border-stone-800 text-slate-800 dark:text-stone-100 shadow-2xl flex flex-col justify-between"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-stone-800 bg-slate-50/80 dark:bg-stone-950/60">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 font-bold text-base shadow-inner">
                    {tenant.settings?.logoUrl ? (
                      <img src={tenant.settings.logoUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
                    ) : (
                      tenant.name.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{tenant.name}</h2>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                          tenant.status === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                            : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
                        }`}
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
                        className="text-slate-400 hover:text-slate-900 dark:text-stone-500 dark:hover:text-white transition"
                        title="Copy link"
                      >
                        {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Quick Actions Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
                <button
                  onClick={() => onOpenPanel && onOpenPanel(tenant)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 py-2 px-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition"
                >
                  <Eye size={12} /> User Panel
                </button>

                <button
                  onClick={() => onImpersonate && onImpersonate(tenant)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-950 py-2 px-2.5 text-xs font-semibold text-slate-700 dark:text-stone-200 hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-300 transition"
                >
                  <ArrowUpRight size={12} /> Impersonate
                </button>

                <button
                  onClick={() => onChangePlan && onChangePlan(tenant)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-950 py-2 px-2.5 text-xs font-semibold text-slate-700 dark:text-stone-200 hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-300 transition"
                >
                  <Layers size={12} /> Plan ({tenant.plan})
                </button>

                <button
                  onClick={() => onToggleStatus && onToggleStatus(tenant)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2.5 text-xs font-semibold transition ${
                    isSuspended
                      ? 'border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                      : 'border border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20'
                  }`}
                >
                  <ShieldAlert size={12} /> {isSuspended ? 'Reactivate' : 'Suspend'}
                </button>
              </div>

              {/* Drawer Tabs Navigation */}
              <div className="flex border-b border-slate-200 dark:border-stone-800 mt-5 -mb-6 space-x-6">
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
                        : 'border-transparent text-slate-500 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
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
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400 mb-3">
                      Resource Usage & Allocation
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-950 p-4">
                        <div className="text-[11px] text-slate-500 dark:text-stone-400">Total QR Tables</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                          {tenant.tableCount || 0}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">Assigned dine-in stations</div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-950 p-4">
                        <div className="text-[11px] text-slate-500 dark:text-stone-400">Menu Food & Beverages</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                          {tenant.productCount || 0}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-stone-500 mt-0.5">Active catalog items</div>
                      </div>
                    </div>
                  </div>

                  {/* Owner Credentials */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400 mb-3">
                      Account Ownership
                    </h3>
                    <div className="rounded-2xl border border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-950 p-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-stone-400">Owner Name:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{tenant.ownerName || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-stone-400">Contact Email:</span>
                        <span className="font-mono text-slate-800 dark:text-stone-200">{tenant.ownerEmail || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-stone-400">Tenant UUID:</span>
                        <span className="font-mono text-[11px] text-slate-400 dark:text-stone-500">{tenant.id}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-stone-400">Registration Date:</span>
                        <span className="text-slate-700 dark:text-stone-300">{new Date(tenant.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Subscription Details */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400 mb-3">
                      Subscription Plan
                    </h3>
                    <div className="rounded-2xl border border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-950 p-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white capitalize">{tenant.plan || 'Starter'} Tier</div>
                        <div className="text-[11px] text-slate-500 dark:text-stone-400 mt-0.5">
                          Status: {tenant.subscription?.status || 'Active'}
                        </div>
                      </div>
                      <button
                        onClick={() => onChangePlan && onChangePlan(tenant)}
                        className="rounded-xl border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:text-white transition"
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
                  <div className="rounded-2xl border border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-950 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-stone-400">Café Display Name:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{tenant.settings?.cafeName || tenant.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-stone-400">Tagline / Pitch:</span>
                      <span className="text-slate-700 dark:text-stone-300 italic">{tenant.settings?.tagline || 'None configured'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-stone-400">Primary Brand Accent:</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full border border-slate-300 dark:border-white/20"
                          style={{ backgroundColor: tenant.settings?.primaryColor || '#c96b18' }}
                        />
                        <span className="font-mono text-slate-800 dark:text-stone-200">{tenant.settings?.primaryColor || '#c96b18'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-stone-400">Currency & Tax:</span>
                      <span className="text-slate-800 dark:text-stone-200 font-medium">
                        {tenant.settings?.currency || 'INR'} (Tax: {tenant.settings?.taxRate ?? 5}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-stone-400">Address:</span>
                      <span className="text-slate-700 dark:text-stone-300">{tenant.settings?.address || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-stone-400">Support Phone:</span>
                      <span className="text-slate-700 dark:text-stone-300">{tenant.settings?.contactPhone || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Recent Orders */}
              {activeTab === 'orders' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500 dark:text-stone-400">
                    Latest dining transactions processed by {tenant.name}:
                  </div>
                  {mockRecentOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-950 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{ord.id}</span>
                          <span className="text-slate-500 dark:text-stone-400 font-normal">· {ord.table}</span>
                          <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.2 text-[9px] font-bold uppercase">
                            {ord.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">
                          {ord.items} items ordered · {ord.time}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-amber-600 dark:text-amber-400 tabular-nums">{ord.total}</div>
                        <div className="text-[10px] text-slate-400 dark:text-stone-500">Paid online</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: Audit Trail */}
              {activeTab === 'audit' && (
                <div className="space-y-3">
                  {tenantAuditLogs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 dark:text-stone-500">
                      No specific administrative events logged for this café yet.
                    </div>
                  ) : (
                    tenantAuditLogs.map((log) => (
                      <div
                        key={log._id || Math.random()}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-950 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-600 dark:text-amber-400">{log.action}</span>
                          <span className="text-[10px] text-slate-400 dark:text-stone-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-stone-400 text-[11px]">
                          Actor: <span className="text-slate-800 dark:text-stone-200">{log.actorEmail}</span>
                        </div>
                        {log.details?.reason && (
                          <div className="text-slate-700 dark:text-stone-300 italic text-[11px]">
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
            <div className="p-4 border-t border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-950/80 flex items-center justify-between text-xs text-slate-500 dark:text-stone-500">
              <span>Tenant ID: {tenant.id}</span>
              <button
                onClick={onClose}
                className="rounded-xl border border-slate-300 dark:border-stone-800 bg-white dark:bg-stone-900 px-4 py-2 font-semibold text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:text-white transition"
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
