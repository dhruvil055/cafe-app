import { useEffect, useState } from 'react';
import { Loader2, Plus, Shield, Users, ChevronLeft, ChevronRight, Search, Filter, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const ROLES = ['owner', 'manager', 'cashier', 'kitchen'];

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager' });

  // Audit log pagination & filters
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPages, setAuditPages] = useState(0);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    actorEmail: '',
    targetType: '',
    startDate: '',
    endDate: '',
  });

  const loadUsers = async () => {
    try {
      const userResponse = await api.get('/users');
      setUsers(userResponse.data.users || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load team management');
    }
  };

  const loadAudit = async () => {
    try {
      const params = new URLSearchParams({
        page: String(auditPage),
        limit: '50',
        ...auditFilters,
      });
      const auditResponse = await api.get(`/users/audit?${params.toString()}`);
      setEvents(auditResponse.data.events || []);
      setAuditTotal(auditResponse.data.pagination?.total || 0);
      setAuditPages(auditResponse.data.pagination?.pages || 0);
    } catch (error) {
      toast.error(error.message || 'Unable to load audit log');
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
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/users', form);
      setUsers((current) => [...current, data.user]);
      setForm({ name: '', email: '', password: '', role: 'manager' });
      toast.success('Staff account created');
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
      toast.success('Role updated');
    } catch (error) {
      toast.error(error.message || 'Unable to update role');
      load();
    }
  };

  const handleFilterChange = (key, value) => {
    setAuditFilters((current) => ({ ...current, [key]: value }));
    setAuditPage(1);
  };

  return <div className="space-y-5">
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3"><Users size={20} className="text-brew-600" /><div><h2 className="font-display text-lg font-bold text-espresso-900">Staff accounts</h2><p className="text-xs text-stone-500">Assign access by the work each person performs.</p></div></div>
      {loading ? <div className="flex min-h-24 items-center justify-center"><Loader2 className="animate-spin" /></div> : <div className="divide-y divide-stone-100">{users.map((user) => <div key={user._id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-stone-900">{user.name}</p><p className="truncate text-xs text-stone-500">{user.email}</p></div><select aria-label={`Role for ${user.name}`} value={({ admin: 'owner', staff: 'manager' }[user.role] || user.role)} onChange={(event) => changeRole(user, event.target.value)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm capitalize">{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></div>)}</div>}
    </section>

    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3"><Plus size={20} className="text-brew-600" /><div><h2 className="font-display text-lg font-bold text-espresso-900">Add staff account</h2><p className="text-xs text-stone-500">Set a strong initial password and share it securely.</p></div></div>
      <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-2">
        <input required maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
        <input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
        <input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Initial password (8+ characters)" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
        <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm capitalize">{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select>
        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm sm:col-span-2">{saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create account</button>
      </form>
    </section>

    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3"><Shield size={20} className="text-brew-600" /><div><h2 className="font-display text-lg font-bold text-espresso-900">Security audit log</h2><p className="text-xs text-stone-500">Recent price, refund, deletion, and role changes.</p></div></div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Filter by action..."
            value={auditFilters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-9 pr-3 py-2 text-sm focus:border-brew-400 focus:outline-none"
          />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="email"
            placeholder="Filter by email..."
            value={auditFilters.actorEmail}
            onChange={(e) => handleFilterChange('actorEmail', e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-brew-400 focus:outline-none"
          />
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="date"
            value={auditFilters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-brew-400 focus:outline-none"
            placeholder="Start date"
          />
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="date"
            value={auditFilters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-brew-400 focus:outline-none"
            placeholder="End date"
          />
        </div>
        <button
          onClick={() => { setAuditFilters({ action: '', actorEmail: '', targetType: '', startDate: '', endDate: '' }); setAuditPage(1); }}
          className="btn-secondary rounded-xl px-3 py-2 text-xs whitespace-nowrap"
        >
          Clear filters
        </button>
      </div>

      <div className="space-y-2">
        {events.map((event) => (
          <article key={event._id} className="rounded-xl bg-stone-50 p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <strong className="text-sm text-stone-800">{event.action.replaceAll('.', ' ')}</strong>
              <time className="text-xs text-stone-500">{new Date(event.createdAt).toLocaleString('en-IN')}</time>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              {event.actorEmail || 'System'} · {event.actorRole || 'system'} · {event.targetType} {event.targetId}
            </p>
            {event.details && (
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-stone-500">
                {JSON.stringify(event.details)}
              </pre>
            )}
          </article>
        ))}
        {!loading && events.length === 0 && <p className="py-6 text-center text-sm text-stone-500">No audit events yet.</p>}

        {/* Pagination */}
        {auditPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-stone-500">
              Page {auditPage} of {auditPages} · {auditTotal} events
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                disabled={auditPage === 1}
                className="btn-secondary rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setAuditPage((p) => Math.min(auditPages, p + 1))}
                disabled={auditPage === auditPages}
                className="btn-secondary rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  </div>;
}

const handleFilterChange = (key, value) => {
  setAuditFilters((current) => ({ ...current, [key]: value }));
  setAuditPage(1);
};

const createUser = async (event) => {
  event.preventDefault();
  setSaving(true);
  try {
    const { data } = await api.post('/users', form);
    setUsers((current) => [...current, data.user]);
    setForm({ name: '', email: '', password: '', role: 'manager' });
    toast.success('Staff account created');
    await loadAudit();
  } catch (error) {
    toast.error(error.message || 'Unable to create staff account');
  } finally {
    setSaving(false);
  };
};

const changeRole = async (user, role) => {
  try {
    const { data } = await api.put(`/users/${user._id}/role`, { role });
    setUsers((current) => current.map((item) => item._id === user._id ? data.user : item));
    await loadAudit();
    toast.success('Role updated');
  } catch (error) {
    toast.error(error.message || 'Unable to update role');
    load();
  }
};

const handleFilterChange = (key, value) => {
  setAuditFilters((current) => ({ ...current, [key]: value }));
  setAuditPage(1);
};

const loadUsers = async () => {
  try {
    const userResponse = await api.get('/users');
    setUsers(userResponse.data.users || []);
  } catch (error) {
    toast.error(error.message || 'Unable to load team management');
  }
};

const loadAudit = async () => {
  try {
    const params = new URLSearchParams({
      page: String(auditPage),
      limit: '50',
      ...auditFilters,
    });
    const auditResponse = await api.get(`/users/audit?${params.toString()}`);
    setEvents(auditResponse.data.events || []);
    setAuditTotal(auditResponse.data.pagination?.total || 0);
    setAuditPages(auditResponse.data.pagination?.pages || 0);
  } catch (error) {
    toast.error(error.message || 'Unable to load audit log');
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

const createUser = async (event) => {
  event.preventDefault();
  setSaving(true);
  try {
    const { data } = await api.post('/users', form);
    setUsers((current) => [...current, data.user]);
    setForm({ name: '', email: '', password: '', role: 'manager' });
    toast.success('Staff account created');
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
    toast.success('Role updated');
  } catch (error) {
    toast.error(error.message || 'Unable to update role');
    load();
  }
};

const handleFilterChange = (key, value) => {
  setAuditFilters((current) => ({ ...current, [key]: value }));
  setAuditPage(1);
};

const loadUsers = async () => {
  try {
    const userResponse = await api.get('/users');
    setUsers(userResponse.data.users || []);
  } catch (error) {
    toast.error(error.message || 'Unable to load team management');
  }
};

const loadAudit = async () => {
  try {
    const params = new URLSearchParams({
      page: String(auditPage),
      limit: '50',
      ...auditFilters,
    });
    const auditResponse = await api.get(`/users/audit?${params.toString()}`);
    setEvents(auditResponse.data.events || []);
    setAuditTotal(auditResponse.data.pagination?.total || 0);
    setAuditPages(auditResponse.data.pagination?.pages || 0);
  } catch (error) {
    toast.error(error.message || 'Unable to load audit log');
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
  event.preventDefault();
  setSaving(true);
  try {
    const { data } = await api.post('/users', form);
    setUsers((current) => [...current, data.user]);
    setForm({ name: '', email: '', password: '', role: 'manager' });
    toast.success('Staff account created');
    await loadAudit();
  } catch (error) {
    toast.error(error.message || 'Unable to create staff account');
  } finally {
    setSaving(false);
  };
};

const changeRole = async (user, role) => {
  try {
    const { data } = await api.put(`/users/${user._id}/role`, { role });
    setUsers((current) => current.map((item) => item._id === user._id ? data.user : item));
    await loadAudit();
    toast.success('Role updated');
  } catch (error) {
    toast.error(error.message || 'Unable to update role');
    load();
  }
};

const handleFilterChange = (key, value) => {
  setAuditFilters((current) => ({ ...current, [key]: value }));
  setAuditPage(1);
};

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager' });

  // Audit log pagination & filters
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPages, setAuditPages] = useState(0);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    actorEmail: '',
    targetType: '',
    startDate: '',
    endDate: '',
  });

  const ROLES = ['owner', 'manager', 'cashier', 'kitchen'];

  return <div className="space-y-5">
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3"><Users size={20} className="text-brew-600" /><div><h2 className="font-display text-lg font-bold text-espresso-900">Staff accounts</h2><p className="text-xs text-stone-500">Assign access by the work each person performs.</p></div></div>
      {loading ? <div className="flex min-h-24 items-center justify-center"><Loader2 className="animate-spin" /></div> : <div className="divide-y divide-stone-100">{users.map((user) => <div key={user._id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-stone-900">{user.name}</p><p className="truncate text-xs text-stone-500">{user.email}</p></div><select aria-label={`Role for ${user.name}`} value={({ admin: 'owner', staff: 'manager' }[user.role] || user.role)} onChange={(event) => changeRole(user, event.target.value)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm capitalize">{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></div>)}</div>}
    </section>

    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3"><Plus size={20} className="text-brew-600" /><div><h2 className="font-display text-lg font-bold text-espresso-900">Add staff account</h2><p className="text-xs text-stone-500">Set a strong initial password and share it securely.</p></div></div>
      <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-2">
        <input required maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
        <input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
        <input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Initial password (8+ characters)" className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
        <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm capitalize">{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select>
        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm sm:col-span-2">{saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create account</button>
      </form>
    </section>

    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3"><Shield size={20} className="text-brew-600" /><div><h2 className="font-display text-lg font-bold text-espresso-900">Security audit log</h2><p className="text-xs text-stone-500">Recent price, refund, deletion, and role changes.</p></div></div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Filter by action..."
            value={auditFilters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-9 pr-3 py-2 text-sm focus:border-brew-400 focus:outline-none"
          />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="email"
            placeholder="Filter by email..."
            value={auditFilters.actorEmail}
            onChange={(e) => handleFilterChange('actorEmail', e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-brew-400 focus:outline-none"
          />
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="date"
            value={auditFilters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-brew-400 focus:outline-none"
            placeholder="Start date"
          />
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="date"
            value={auditFilters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-brew-400 focus:outline-none"
            placeholder="End date"
          />
        </div>
        <button
          onClick={() => { setAuditFilters({ action: '', actorEmail: '', targetType: '', startDate: '', endDate: '' }); setAuditPage(1); }}
          className="btn-secondary rounded-xl px-3 py-2 text-xs whitespace-nowrap"
        >
          Clear filters
        </button>
      </div>

      <div className="space-y-2">
        {events.map((event) => (
          <article key={event._id} className="rounded-xl bg-stone-50 p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <strong className="text-sm text-stone-800">{event.action.replaceAll('.', ' ')}</strong>
              <time className="text-xs text-stone-500">{new Date(event.createdAt).toLocaleString('en-IN')}</time>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              {event.actorEmail || 'System'} · {event.actorRole || 'system'} · {event.targetType} {event.targetId}
            </p>
            {event.details && (
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-stone-500">
                {JSON.stringify(event.details)}
              </pre>
            )}
          </article>
        ))}
        {!loading && events.length === 0 && <p className="py-6 text-center text-sm text-stone-500">No audit events yet.</p>}

        {/* Pagination */}
        {auditPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-stone-500">
              Page {auditPage} of {auditPages} · {auditTotal} events
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                disabled={auditPage === 1}
                className="btn-secondary rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setAuditPage((p) => Math.min(auditPages, p + 1))}
                disabled={auditPage === auditPages}
                className="btn-secondary rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  </div>;
}