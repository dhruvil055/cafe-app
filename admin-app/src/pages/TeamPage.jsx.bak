import { useEffect, useState } from 'react';
import { Loader2, Plus, Shield, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const ROLES = ['owner', 'manager', 'cashier', 'kitchen'];

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager' });

  const load = async () => {
    setLoading(true);
    try {
      const [userResponse, auditResponse] = await Promise.all([api.get('/users'), api.get('/users/audit')]);
      setUsers(userResponse.data.users || []);
      setEvents(auditResponse.data.events || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load team management');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/users', form);
      setUsers((current) => [...current, data.user]);
      setForm({ name: '', email: '', password: '', role: 'manager' });
      toast.success('Staff account created');
      const audit = await api.get('/users/audit');
      setEvents(audit.data.events || []);
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
      const audit = await api.get('/users/audit');
      setEvents(audit.data.events || []);
      toast.success('Role updated');
    } catch (error) {
      toast.error(error.message || 'Unable to update role');
      load();
    }
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
      <div className="space-y-2">{events.map((event) => <article key={event._id} className="rounded-xl bg-stone-50 p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm text-stone-800">{event.action.replaceAll('.', ' ')}</strong><time className="text-xs text-stone-500">{new Date(event.createdAt).toLocaleString('en-IN')}</time></div><p className="mt-1 text-xs text-stone-600">{event.actorEmail || 'System'} · {event.actorRole || 'system'} · {event.targetType} {event.targetId}</p>{event.details && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-stone-500">{JSON.stringify(event.details)}</pre>}</article>)}{!loading && events.length === 0 && <p className="py-6 text-center text-sm text-stone-500">No audit events yet.</p>}</div>
    </section>
  </div>;
}
