import { useEffect, useState } from 'react';
import {
  BadgePercent, Plus, RefreshCw, ToggleLeft, ToggleRight,
  Ticket, Calendar, Check, AlertCircle, Percent, DollarSign,
  Trash2, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { formatMoney } from '../utils/money';
import PageHeader from '../components/common/PageHeader';
import StatusPill from '../components/common/StatusPill';
import EmptyState from '../components/common/EmptyState';
import Drawer from '../components/common/Drawer';

const emptyForm = {
  code: '',
  description: '',
  discountType: 'percent',
  value: '',
  minimumSubtotal: '199',
  maximumDiscount: '100',
  startsAt: '',
  endsAt: '',
  maxUses: '100'
};

export default function CouponsPage() {
  const tenant = useTenant();
  const currency = tenant?.currency || tenant?.settings?.currency || '₹';

  const [coupons, setCoupons] = useState([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/coupons');
      setCoupons(data.coupons || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load coupons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const createCoupon = async (event) => {
    event.preventDefault();
    if (!form.code.trim() || !form.value) {
      toast.error('Coupon code and discount value are required.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/coupons', {
        ...form,
        code: form.code.trim().toUpperCase(),
        value: Number(form.value),
        minimumSubtotal: Number(form.minimumSubtotal || 0),
        maximumDiscount: form.maximumDiscount === '' ? null : Number(form.maximumDiscount),
        maxUses: form.maxUses === '' ? null : Number(form.maxUses),
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null
      });
      toast.success(`Coupon ${form.code.toUpperCase()} created.`);
      setForm(emptyForm);
      setShowDrawer(false);
      await loadCoupons();
    } catch (error) {
      toast.error(error.message || 'Unable to create coupon.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCoupon = async (coupon) => {
    try {
      await api.put(`/coupons/${coupon._id}`, { active: !coupon.active });
      toast.success(coupon.active ? 'Coupon paused' : 'Coupon activated');
      await loadCoupons();
    } catch (error) {
      toast.error(error.message || 'Unable to update coupon.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Promotions & Coupons"
        subtitle="Create discount voucher codes, minimum spend thresholds, and checkout offers."
        breadcrumbs={[
          { label: 'Growth', to: '/customers' },
          { label: 'Coupons' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setForm(emptyForm); setShowDrawer(true); }}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
            >
              <Plus size={15} />
              <span>New Coupon</span>
            </button>
            <button
              type="button"
              onClick={loadCoupons}
              className="p-2 rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition"
              title="Refresh coupons"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {/* Coupons List (List-first Architecture) */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-100 border border-stone-200/60" />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No coupons created yet"
          description="Create voucher codes like WELCOME10 or BREW50 to reward guests on digital QR ordering."
          actionLabel="Create first coupon"
          onAction={() => { setForm(emptyForm); setShowDrawer(true); }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {coupons.map((coupon) => {
            const usagePercent = coupon.maxUses
              ? Math.min(100, Math.round(((coupon.usageCount || 0) / coupon.maxUses) * 100))
              : null;

            return (
              <div
                key={coupon._id}
                className={`relative flex flex-col justify-between rounded-3xl border p-5 shadow-xs transition duration-200 bg-white ${
                  coupon.active ? 'border-stone-200/90' : 'border-stone-200 bg-stone-50/60 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-xl bg-amber-100 px-3 py-1 font-mono text-xs font-bold tracking-wider text-amber-900 border border-amber-200/80">
                        {coupon.code}
                      </span>
                      <StatusPill status={coupon.active ? 'active' : 'inactive'} size="xs" />
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleCoupon(coupon)}
                      className="text-stone-400 hover:text-stone-700 transition"
                      title={coupon.active ? 'Pause Coupon' : 'Activate Coupon'}
                    >
                      {coupon.active ? (
                        <ToggleRight size={22} className="text-emerald-500" />
                      ) : (
                        <ToggleLeft size={22} className="text-stone-300" />
                      )}
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="font-display text-lg font-bold text-espresso-950">
                      {coupon.discountType === 'percent'
                        ? `${coupon.value}% OFF`
                        : `${formatMoney(coupon.value, currency)} FLAT OFF`}
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {coupon.description || 'Applicable on digital QR ordering'}
                    </p>
                  </div>

                  {/* Conditions */}
                  <div className="mt-3.5 space-y-1.5 border-t border-stone-100 pt-3 text-[11px] text-stone-600">
                    <div className="flex justify-between">
                      <span className="text-stone-400">Min. Subtotal:</span>
                      <span className="font-semibold text-stone-800">
                        {coupon.minimumSubtotal > 0 ? formatMoney(coupon.minimumSubtotal, currency) : 'No Minimum'}
                      </span>
                    </div>
                    {coupon.maximumDiscount && coupon.discountType === 'percent' && (
                      <div className="flex justify-between">
                        <span className="text-stone-400">Max Discount:</span>
                        <span className="font-semibold text-stone-800">
                          {formatMoney(coupon.maximumDiscount, currency)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Usage Meter */}
                <div className="mt-4 pt-3 border-t border-stone-100 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>Usage:</span>
                    <span className="font-bold text-stone-800">
                      {coupon.usageCount || 0} {coupon.maxUses ? `/ ${coupon.maxUses}` : 'orders'}
                    </span>
                  </div>
                  {coupon.maxUses && (
                    <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-600 transition-all"
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NEW COUPON SIDE DRAWER WITH LIVE PREVIEW */}
      <Drawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        title="Create New Offer"
        subtitle="Configure promo vouchers with minimum spend limits and expiry dates."
        width="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowDrawer(false)}
              className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={createCoupon}
              disabled={saving}
              className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold shadow-xs"
            >
              {saving ? 'Creating...' : 'Publish Coupon'}
            </button>
          </div>
        }
      >
        <form onSubmit={createCoupon} className="space-y-4">
          {/* Live Voucher Card Preview */}
          <div className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-2xs space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Customer Live Voucher Preview
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-base font-bold text-amber-950 bg-white/80 px-2.5 py-1 rounded-lg border border-amber-200">
                {form.code || 'CODE10'}
              </span>
              <span className="font-display text-base font-extrabold text-amber-900">
                {form.discountType === 'percent'
                  ? `${form.value || '10'}% OFF`
                  : `${formatMoney(form.value || 50, currency)} OFF`}
              </span>
            </div>
            <p className="text-xs text-amber-800">
              {form.description || 'Special guest promo'} · Min order {formatMoney(form.minimumSubtotal || 0, currency)}
              {form.maximumDiscount && form.discountType === 'percent' ? ` (up to ${formatMoney(form.maximumDiscount, currency)})` : ''}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Coupon Code (Uppercase) *
            </label>
            <input
              type="text"
              required
              maxLength={32}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. BREW10, FIRSTORDER"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono uppercase focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Public Description
            </label>
            <input
              type="text"
              maxLength={200}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. 10% discount on all artisan pour-overs"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Discount Type
              </label>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              >
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount ({currency})</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Discount Value *
              </label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.discountType === 'percent' ? '15' : '100'}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Fix Bug #6: Currency symbol included in labels */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Minimum Subtotal ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minimumSubtotal}
                onChange={(e) => setForm({ ...form, minimumSubtotal: e.target.value })}
                placeholder="199"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Maximum Discount ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.maximumDiscount}
                onChange={(e) => setForm({ ...form, maximumDiscount: e.target.value })}
                placeholder="150"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Start Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                End Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Maximum Total Uses (Optional)
            </label>
            <input
              type="number"
              min="1"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              placeholder="e.g. 50 (leave blank for unlimited)"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
