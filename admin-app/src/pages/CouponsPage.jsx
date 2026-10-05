import { useEffect, useState } from 'react';
import { BadgePercent, Plus, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { formatMoney } from '../utils/money';

const emptyForm = { code: '', description: '', discountType: 'percent', value: '', minimumSubtotal: '0', maximumDiscount: '', startsAt: '', endsAt: '', maxUses: '' };

export default function CouponsPage() {
  const tenant = useTenant();
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/coupons'); setCoupons(data.coupons || []); }
    catch (error) { toast.error(error.message || 'Unable to load coupons.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const createCoupon = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/coupons', { ...form, code: form.code.trim().toUpperCase(), value: Number(form.value), minimumSubtotal: Number(form.minimumSubtotal), maximumDiscount: form.maximumDiscount === '' ? null : Number(form.maximumDiscount), maxUses: form.maxUses === '' ? null : Number(form.maxUses), startsAt: form.startsAt || null, endsAt: form.endsAt || null });
      toast.success('Coupon created.'); setForm(emptyForm); await load();
    } catch (error) { toast.error(error.message || 'Unable to create coupon.'); }
    finally { setSaving(false); }
  };

  const toggleCoupon = async (coupon) => {
    try { await api.put(`/coupons/${coupon._id}`, { active: !coupon.active }); await load(); }
    catch (error) { toast.error(error.message || 'Unable to update coupon.'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-2xl font-bold text-espresso-900">Coupons & Offers</h1><p className="mt-1 text-sm text-stone-500">Create scheduled discounts for customer checkout.</p></div>
        <button onClick={load} className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-sm"><RefreshCw size={15} /> Refresh</button>
      </div>

      <form onSubmit={createCoupon} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-espresso-900"><Plus size={18} /> New coupon</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-stone-600">Code<input required maxLength={32} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-field mt-1" placeholder="BREW10" /></label>
          <label className="text-xs font-medium text-stone-600">Description<input maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field mt-1" placeholder="Welcome offer" /></label>
          <label className="text-xs font-medium text-stone-600">Discount type<select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} className="input-field mt-1"><option value="percent">Percent</option><option value="fixed">Fixed amount ({tenant.currency})</option></select></label>
          <label className="text-xs font-medium text-stone-600">Value<input required type="number" min="0.01" max={form.discountType === 'percent' ? 100 : undefined} step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input-field mt-1" /></label>
          <label className="text-xs font-medium text-stone-600">Minimum subtotal ({tenant.currency})<input type="number" min="0" step="0.01" value={form.minimumSubtotal} onChange={(e) => setForm({ ...form, minimumSubtotal: e.target.value })} className="input-field mt-1" /></label>
          <label className="text-xs font-medium text-stone-600">Maximum discount ({tenant.currency})<input type="number" min="0" step="0.01" value={form.maximumDiscount} onChange={(e) => setForm({ ...form, maximumDiscount: e.target.value })} className="input-field mt-1" /></label>
          <label className="text-xs font-medium text-stone-600">Starts at<input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="input-field mt-1" /></label>
          <label className="text-xs font-medium text-stone-600">Ends at<input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="input-field mt-1" /></label>
          <label className="text-xs font-medium text-stone-600">Maximum uses<input type="number" min="1" step="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} className="input-field mt-1" placeholder="Unlimited" /></label>
        </div>
        <button disabled={saving} className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-60"><BadgePercent size={16} />{saving ? 'Saving…' : 'Create coupon'}</button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
        <div className="border-b border-stone-100 px-5 py-4"><h2 className="font-display font-bold text-espresso-900">Coupons</h2></div>
        {loading ? <div className="p-8 text-center text-sm text-stone-500">Loading…</div> : coupons.length === 0 ? <div className="p-8 text-center text-sm text-stone-500">No coupons created yet.</div> : (
          <div className="divide-y divide-stone-100">
            {coupons.map((coupon) => <div key={coupon._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="rounded-lg bg-brew-50 px-2.5 py-1 font-mono text-sm font-bold text-brew-800">{coupon.code}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${coupon.active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{coupon.active ? 'Active' : 'Paused'}</span></div><p className="mt-1 text-xs text-stone-500">{coupon.description || '—'} · {coupon.discountType === 'percent' ? `${coupon.value}%` : formatMoney(coupon.value, tenant.currency)} discount · {coupon.usageCount || 0}{coupon.maxUses ? ` / ${coupon.maxUses}` : ''} used</p></div>
              <button onClick={() => toggleCoupon(coupon)} className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50" aria-label={`${coupon.active ? 'Pause' : 'Activate'} ${coupon.code}`}>{coupon.active ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}{coupon.active ? 'Pause' : 'Activate'}</button>
            </div>)}
          </div>
        )}
      </section>
    </div>
  );
}
