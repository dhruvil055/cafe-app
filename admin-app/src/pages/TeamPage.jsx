import { useEffect, useState, useMemo } from 'react';
import {
  Loader2, Plus, Shield, Users, ChevronLeft, ChevronRight,
  Search, Filter, Mail, CheckCircle2, XCircle, ShieldCheck,
  Key, UserCheck, Lock, ChevronDown, ChevronUp, Clock, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import PageHeader from '../components/common/PageHeader';
import StatusPill from '../components/common/StatusPill';
import EmptyState from '../components/common/EmptyState';
import Drawer from '../components/common/Drawer';

const ROLES = ['owner', 'manager', 'cashier', 'kitchen'];

const ROLE_PERMISSIONS = {
  owner: {
    label: 'Owner',
    desc: 'Unrestricted full access across all outlets, billing, revenue analytics, and staff accounts.',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    perms: ['POS Terminal', 'Live Orders', 'Floor & Tables', 'Menu & Pricing', 'Refunds', 'All Analytics', 'Billing & Subscription', 'Staff Roles']
  },
  manager: {
    label: 'Manager',
    desc: 'Manages floor shifts, menu item stock, discounts, customer CRM, and service requests.',
    badge: 'bg-purple-100 text-purple-900 border-purple-200',
    perms: ['POS Terminal', 'Live Orders', 'Floor & Tables', 'Menu & Pricing', 'Issue Discounts', 'View Reports']
  },
  cashier: {
    label: 'Cashier',
    desc: 'Counter sales terminal, cash settlement verification, receipt printing, and order checkout.',
    badge: 'bg-blue-100 text-blue-900 border-blue-200',
    perms: ['POS Terminal', 'Live Orders', 'Cash Collection', 'Print Receipts']
  },
  kitchen: {
    label: 'Kitchen / Barista',
    desc: 'Dedicated Kitchen Display System (KDS) access to advance cooking ticket stations.',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    perms: ['Kitchen Display (KDS)', 'Advance Tickets', 'Table Service Requests']
  }
};

// Human-readable timeline translator (Fixes Bug #12)
function formatAuditEvent(event) {
  const actor = event.actorEmail ? event.actorEmail.split('@')[0] : 'System';
  const action = (event.action || '').toLowerCase().replace(/_/g, '.');
  const details = event.details || {};

  if (action.includes('login') || action.includes('auth')) {
    const ip = details.ip || details.ipAddress || '';
    return `${actor} signed in successfully${ip ? ` from IP ${ip}` : ' to admin console'}.`;
  }
  if (action.includes('refund')) {
    return `${actor} processed a refund for Order ${details.orderNumber || details.orderId || ''}.`;
  }
  if (action.includes('role')) {
    return `${actor} updated role for ${details.targetEmail || details.user || 'staff member'} to ${details.role || 'new role'}.`;
  }
  if (action.includes('menu') || action.includes('product')) {
    return `${actor} modified menu product "${details.name || details.productName || 'item'}".`;
  }
  if (action.includes('table')) {
    return `${actor} updated Table ${details.tableNumber || ''} status to ${details.status || 'new status'}.`;
  }
  if (action.includes('cash')) {
    return `${actor} verified cash order settlement for Order ${details.orderNumber || ''}.`;
  }
  if (action.includes('user.create') || action.includes('user_create')) {
    return `${actor} created new staff account for ${details.email || details.name || 'member'}.`;
  }

  // Graceful human fallback
  const cleanAction = event.action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return `${actor} performed ${cleanAction}.`;
}

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager' });
  const [expandedEventId, setExpandedEventId] = useState(null);

  // Audit log pagination & filters
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPages, setAuditPages] = useState(0);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    actorEmail: '',
    startDate: '',
    endDate: '',
  });

  const loadUsers = async () => {
    try {
      const userResponse = await api.get('/users');
      setUsers(userResponse.data.users || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load team list');
    }
  };

  const loadAudit = async () => {
    try {
      const params = new URLSearchParams({
        page: String(auditPage),
        limit: '25',
        ...auditFilters,
      });
      const auditResponse = await api.get(`/users/audit?${params.toString()}`);
      setEvents(auditResponse.data.events || []);
      setAuditTotal(auditResponse.data.pagination?.total || 0);
      setAuditPages(auditResponse.data.pagination?.pages || 0);
    } catch (error) {
      // Non-critical
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      await Promise.all([loadUsers(), loadAudit()]);
    } catch (error) {
      toast.error(error.message || 'Unable to load team management');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => { loadAudit(); }, [auditPage, auditFilters]);

  const createUser = async (event) => {
    event?.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error('All fields are required.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post('/users', form);
      setUsers((current) => [...current, data.user]);
      setForm({ name: '', email: '', password: '', role: 'manager' });
      setShowInviteDrawer(false);
      toast.success('Staff account created successfully.');
      await loadAudit();
    } catch (error) {
      toast.error(error.message || 'Unable to create staff account');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (user, role) => {
    try {
      const { data } = await api.put(`/users/${user._id}/role`, { role });
      setUsers((current) => current.map((item) => item._id === user._id ? data.user : item));
      await loadAudit();
      toast.success(`Role updated to ${role}`);
    } catch (error) {
      toast.error(error.message || 'Unable to update role');
      load();
    }
  };

  const handleFilterChange = (key, value) => {
    setAuditFilters((current) => ({ ...current, [key]: value }));
    setAuditPage(1);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Team & Security Audit"
        subtitle="Staff access permissions, barista roles, and human-readable operational security trails."
        breadcrumbs={[
          { label: 'Admin', to: '/team' },
          { label: 'Team & Security' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMatrix(!showMatrix)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs transition"
            >
              <Key size={14} className="text-stone-500" />
              <span>{showMatrix ? 'Hide' : 'View'} Permissions Matrix</span>
            </button>
            <button
              type="button"
              onClick={() => setShowInviteDrawer(true)}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
            >
              <Plus size={15} />
              <span>Invite Staff</span>
            </button>
          </div>
        }
      />

      {/* Permissions Matrix Drawer / Accordion */}
      {showMatrix && (
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-espresso-950">
                Staff Role Permissions Matrix
              </h3>
              <p className="text-xs text-stone-500">
                Granular capabilities granted to each operational role in Brewhaus.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMatrix(false)}
              className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"
            >
              <XCircle size={18} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
            {Object.entries(ROLE_PERMISSIONS).map(([key, config]) => (
              <div key={key} className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${config.badge}`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-stone-600 min-h-[36px] leading-relaxed">{config.desc}</p>
                <div className="space-y-1.5 pt-2 border-t border-stone-200/60 text-xs">
                  {config.perms.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-stone-700">
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff Accounts Table */}
      <div className="rounded-3xl border border-stone-200/90 bg-white shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-espresso-950">
              Active Team Members ({users.length})
            </h3>
            <p className="text-xs text-stone-500">
              Manage member roles and assign barista/cashier stations.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-stone-400">Loading team...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 bg-stone-50/70 font-bold uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role & Access</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Change Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map((user) => {
                  const roleKey = { admin: 'owner', staff: 'manager' }[user.role] || user.role || 'manager';
                  const roleConfig = ROLE_PERMISSIONS[roleKey] || ROLE_PERMISSIONS.manager;

                  return (
                    <tr key={user._id} className="hover:bg-stone-50/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-espresso-950 font-display text-xs font-bold text-white shadow-2xs">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-stone-900 block">{user.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-stone-600">
                        {user.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${roleConfig.badge}`}>
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <select
                          aria-label={`Role for ${user.name}`}
                          value={roleKey}
                          onChange={(e) => changeRole(user, e.target.value)}
                          className="rounded-xl border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 capitalize focus:border-amber-500 focus:outline-none"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>{ROLE_PERMISSIONS[role]?.label || role}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security Audit Log (Fixes Bug #12) */}
      <div className="rounded-3xl border border-stone-200/90 bg-white shadow-xs p-6 space-y-4">
        <div>
          <h3 className="font-display text-base font-bold text-espresso-950">
            Security Audit Trail & Timeline
          </h3>
          <p className="text-xs text-stone-500">
            Tamper-evident logs of logins, refunds, role updates, and price changes.
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2.5 pb-2 border-b border-stone-100">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search action or keyword..."
              value={auditFilters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 pl-9 pr-3 py-1.5 text-xs focus:border-amber-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Filter by staff email..."
              value={auditFilters.actorEmail}
              onChange={(e) => handleFilterChange('actorEmail', e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs focus:border-amber-500 focus:bg-white focus:outline-none"
            />
          </div>
          {(auditFilters.action || auditFilters.actorEmail) && (
            <button
              type="button"
              onClick={() => { setAuditFilters({ action: '', actorEmail: '', startDate: '', endDate: '' }); setAuditPage(1); }}
              className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Human-readable timeline (Fixes Bug #12) */}
        <div className="space-y-2.5">
          {events.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-400 italic">
              No audit events found matching filters.
            </div>
          ) : (
            events.map((event) => {
              const sentence = formatAuditEvent(event);
              const isExpanded = expandedEventId === event._id;

              return (
                <div
                  key={event._id}
                  className="rounded-2xl border border-stone-200/70 bg-stone-50/60 p-3.5 transition hover:bg-stone-50 hover:border-stone-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white text-stone-600 border border-stone-200 shadow-2xs">
                        <Clock size={13} />
                      </span>
                      <p className="text-xs font-semibold text-stone-800 leading-snug">
                        {sentence}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-stone-400 self-end sm:self-auto shrink-0">
                      <span>{new Date(event.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {event.details && Object.keys(event.details).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedEventId(isExpanded ? null : event._id)}
                          className="flex items-center gap-0.5 text-stone-500 hover:text-stone-800"
                          title="Inspect raw event JSON"
                        >
                          <span>{isExpanded ? 'Hide' : 'Details'}</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable details if needed */}
                  {isExpanded && event.details && (
                    <div className="mt-2.5 pt-2 border-t border-stone-200/60">
                      <pre className="rounded-xl bg-white p-2.5 text-[10px] text-stone-600 font-mono overflow-x-auto border border-stone-200">
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Audit Pagination */}
        {auditPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs text-stone-500">
            <span>Showing Page {auditPage} of {auditPages} · {auditTotal} total logged events</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={auditPage <= 1}
                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1 font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={auditPage >= auditPages}
                onClick={() => setAuditPage((p) => Math.min(auditPages, p + 1))}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1 font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* INVITE STAFF DRAWER */}
      <Drawer
        isOpen={showInviteDrawer}
        onClose={() => setShowInviteDrawer(false)}
        title="Invite New Staff Member"
        subtitle="Create login credentials and assign operational workstation access."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowInviteDrawer(false)}
              className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={createUser}
              disabled={saving}
              className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold shadow-xs"
            >
              {saving ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        }
      >
        <form onSubmit={createUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Staff Email (Login ID) *
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ramesh@brewhauscafe.com"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Initial Temporary Password *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimum 8 characters"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Role & Workstation Access
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_PERMISSIONS[r]?.label || r} — {ROLE_PERMISSIONS[r]?.desc.slice(0, 50)}...
                </option>
              ))}
            </select>
          </div>
        </form>
      </Drawer>
    </div>
  );
}