import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const initial = { cafeName: '', logoUrl: '', primaryColor: '#c96b18', accentColor: '#1a0f08', currency: 'INR', timezone: 'Asia/Kolkata', gstNumber: '', taxRate: 5, address: '', contactEmail: '', contactPhone: '', openingHours: {} };

export default function TenantSettingsPage() {
  const [settings, setSettings] = useState(initial);
  const [payment, setPayment] = useState({ keyId: '', keySecret: '', webhookSecret: '', configured: false, clear: false });
  const [hours, setHours] = useState('{}');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/tenant/settings').then(({ data }) => {
      setSettings({ ...initial, ...data.tenant });
      setHours(JSON.stringify(data.tenant.openingHours || {}, null, 2));
      setPayment((current) => ({ ...current, keyId: data.payment.keyId || '', configured: data.payment.configured }));
    }).catch((error) => toast.error(error.message || 'Could not load café settings.'));
  }, []);
  const set = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    let openingHours;
    try { openingHours = JSON.parse(hours); } catch { toast.error('Opening hours must be valid JSON.'); return; }
    setSaving(true);
    try {
      const body = { settings: { ...settings, openingHours } };
      if (payment.clear) body.payment = { clear: true };
      else if (payment.keySecret || payment.webhookSecret) body.payment = { keyId: payment.keyId, keySecret: payment.keySecret, webhookSecret: payment.webhookSecret };
      const { data } = await api.put('/tenant/settings', body);
      setSettings({ ...initial, ...data.tenant });
      setHours(JSON.stringify(data.tenant.openingHours || {}, null, 2));
      setPayment({ keyId: data.payment.keyId || '', keySecret: '', webhookSecret: '', configured: data.payment.configured, clear: false });
      toast.success('Café settings saved.');
    } catch (error) { toast.error(error.message || 'Could not save settings.'); }
    finally { setSaving(false); }
  };
  const field = (label, key, type = 'text') => <label className="block text-sm font-medium text-stone-600">{label}<input type={type} value={settings[key] ?? ''} onChange={(event) => set(key, event.target.value)} className="input-field mt-1" /></label>;
  return <form onSubmit={save} className="mx-auto max-w-4xl space-y-6 pb-10">
    <section className="card space-y-4 p-5"><h2 className="font-display text-lg font-bold text-espresso-900">Café identity</h2><div className="grid gap-4 sm:grid-cols-2">{field('Café name', 'cafeName')}{field('Logo URL', 'logoUrl', 'url')}{field('Primary brand color', 'primaryColor', 'color')}{field('Accent color', 'accentColor', 'color')}{field('Currency (ISO code)', 'currency')}{field('Timezone', 'timezone')}{field('GST number', 'gstNumber')}{field('GST tax rate (%)', 'taxRate', 'number')}{field('Contact email', 'contactEmail', 'email')}{field('Contact phone', 'contactPhone', 'tel')}</div>{field('Address', 'address')}<label className="block text-sm font-medium text-stone-600">Opening hours (JSON by weekday)<textarea value={hours} onChange={(event) => setHours(event.target.value)} rows={5} className="input-field mt-1 font-mono text-xs" placeholder={'{"monday":"09:00-21:00"}'} /></label></section>
    <section className="card space-y-4 p-5"><h2 className="font-display text-lg font-bold text-espresso-900">Razorpay for this café</h2><p className="text-sm text-stone-500">Secrets are encrypted before storage and are never returned by the API. The public key ID is used by Razorpay Checkout.</p><label className="block text-sm font-medium text-stone-600">Key ID<input value={payment.keyId} onChange={(event) => setPayment({ ...payment, keyId: event.target.value, clear: false })} className="input-field mt-1" autoComplete="off" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-stone-600">Key secret<input type="password" value={payment.keySecret} onChange={(event) => setPayment({ ...payment, keySecret: event.target.value, clear: false })} className="input-field mt-1" autoComplete="new-password" /></label><label className="block text-sm font-medium text-stone-600">Webhook secret<input type="password" value={payment.webhookSecret} onChange={(event) => setPayment({ ...payment, webhookSecret: event.target.value, clear: false })} className="input-field mt-1" autoComplete="new-password" /></label></div><p className="text-xs text-stone-500">{payment.configured ? 'Credentials are configured. Leave secret fields blank to keep the current values.' : 'Online payment is not configured yet.'}</p>{payment.configured && <label className="flex items-center gap-2 text-sm text-red-700"><input type="checkbox" checked={payment.clear} onChange={(event) => setPayment({ ...payment, clear: event.target.checked, keyId: event.target.checked ? '' : payment.keyId })} />Remove this café’s payment credentials</label>}</section>
    <button className="btn-primary px-5 py-3" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
  </form>;
}
