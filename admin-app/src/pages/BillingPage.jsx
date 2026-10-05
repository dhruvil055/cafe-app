import { useState, useEffect } from 'react';
import {
  CreditCard, Sparkles, AlertTriangle, CheckCircle2,
  Download, ArrowUpRight, ShieldAlert, Loader2, RefreshCw, AlertCircle
} from 'lucide-react';
import api from '../services/api';

const ALL_PLANS = [
  {
    id: 'starter',
    name: 'Starter Plan',
    price: 999,
    period: '/month',
    desc: 'Perfect for small coffee shops and boutique cafés starting out.',
    limits: { tables: 5, menuItems: 15, staffUsers: 2 },
    features: [
      'Up to 5 Tables with signed QR codes',
      'Up to 15 Menu items & categories',
      'Up to 2 Staff accounts',
      'Real-time order manager & KDS',
      'Basic sales analytics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Plan',
    price: 2499,
    period: '/month',
    popular: true,
    desc: 'For high-volume cafés and bistros needing speed and capacity.',
    limits: { tables: 25, menuItems: 100, staffUsers: 10 },
    features: [
      'Up to 25 Tables with signed QR codes',
      'Up to 100 Menu items & variants',
      'Up to 10 Staff accounts & role control',
      'Kitchen Display System & Sound alerts',
      'CRM, Coupons & Customer Analytics',
      'Inventory Management & Low-stock Alerts',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise Plan',
    price: 4999,
    period: '/month',
    desc: 'Designed for large multi-floor venues and multi-outlet chains.',
    limits: { tables: 1000, menuItems: 2000, staffUsers: 50 },
    features: [
      'Unlimited Tables & Floors',
      'Unlimited Menu items & modifiers',
      'Up to 50 Staff accounts',
      'Advanced Recipe / BOM ingredient mapping',
      'Priority 24/7 SLA Support',
    ],
  },
];

export default function BillingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/tenant/billing/summary');
      setData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load billing summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleChangePlan = async (planId) => {
    if (planId === data?.plan) return;
    setError('');
    setMessage(null);
    setActionLoading(true);

    try {
      const res = await api.post('/tenant/billing/change-plan', { plan: planId });
      setMessage(`Successfully updated subscription to ${planId.toUpperCase()} plan.`);
      await fetchSummary();
    } catch (err) {
      setError(err.message || 'Unable to change plan.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      setExporting(true);
      const res = await api.get('/tenant/billing/export', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cafe-backup-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to download café data export.');
    } finally {
      setExporting(false);
    }
  };

  const handleCancelSubscription = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post('/tenant/billing/cancel', { reason: 'User requested cancellation' });
      setShowCancelModal(false);
      setMessage(`Subscription cancelled. Data will be retained until ${new Date(res.data.scheduledPurgeAt).toLocaleDateString()}.`);
      await fetchSummary();
    } catch (err) {
      setError(err.message || 'Failed to cancel subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-amber-600" />
      </div>
    );
  }

  const currentPlan = data?.plan || 'starter';
  const limits = data?.limits || { tables: 5, menuItems: 15, staffUsers: 2 };
  const usage = data?.usage || { tables: 0, menuItems: 0, staffUsers: 0 };
  const subStatus = data?.subscription?.status || 'trial';

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Notifications */}
      {message && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Plan Status Overview Card */}
      <div className="relative overflow-hidden rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                {subStatus === 'trial' ? '14-Day Free Trial' : subStatus.toUpperCase()}
              </span>
              {data?.deletionRequestedAt && (
                <span className="text-xs font-bold uppercase tracking-wider text-red-800 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
                  Pending Deletion
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-stone-900 mt-2 capitalize">
              {currentPlan} Plan Active
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              {subStatus === 'trial'
                ? 'Your trial includes all starter features. Upgrade anytime to lift limits.'
                : 'Billed monthly via Razorpay Subscriptions.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 transition"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export Data (.json)
            </button>
            <button
              onClick={fetchSummary}
              disabled={loading}
              className="p-2.5 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-900 transition"
              title="Refresh usage"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Plan Usage Progress Meters */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-stone-100">
          {/* Tables Usage */}
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-600 mb-2">
              <span>Active Tables</span>
              <span className="font-bold text-stone-900">
                {usage.tables} / {limits.tables}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usage.tables >= limits.tables ? 'bg-red-500' : 'bg-amber-600'
                }`}
                style={{ width: `${Math.min(100, (usage.tables / limits.tables) * 100)}%` }}
              />
            </div>
            {usage.tables >= limits.tables && (
              <div className="mt-3 text-[11px] font-semibold text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Table limit reached. Upgrade to add more.
              </div>
            )}
          </div>

          {/* Menu Items Usage */}
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-600 mb-2">
              <span>Menu Items</span>
              <span className="font-bold text-stone-900">
                {usage.menuItems} / {limits.menuItems}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usage.menuItems >= limits.menuItems ? 'bg-red-500' : 'bg-amber-600'
                }`}
                style={{ width: `${Math.min(100, (usage.menuItems / limits.menuItems) * 100)}%` }}
              />
            </div>
            {usage.menuItems >= limits.menuItems && (
              <div className="mt-3 text-[11px] font-semibold text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Menu limit reached.
              </div>
            )}
          </div>

          {/* Staff Members Usage */}
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-600 mb-2">
              <span>Staff Users</span>
              <span className="font-bold text-stone-900">
                {usage.staffUsers} / {limits.staffUsers}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usage.staffUsers >= limits.staffUsers ? 'bg-red-500' : 'bg-amber-600'
                }`}
                style={{ width: `${Math.min(100, (usage.staffUsers / limits.staffUsers) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Available Plans Comparison */}
      <div>
        <h3 className="text-xl font-bold font-display text-stone-900 mb-4">Choose the Right Plan for Your Café</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ALL_PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-8 transition border-2 ${
                  isCurrent
                    ? 'border-amber-600 bg-white shadow-xl'
                    : 'border-stone-200 bg-white/80 hover:border-stone-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-amber-600 to-orange-500 px-3.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
                    Most Popular
                  </div>
                )}

                <div>
                  <h4 className="text-lg font-bold text-stone-900">{plan.name}</h4>
                  <p className="text-xs text-stone-500 mt-1 min-h-[32px]">{plan.desc}</p>

                  <div className="my-6">
                    <span className="text-3xl font-extrabold text-stone-900">₹{plan.price}</span>
                    <span className="text-xs text-stone-500">{plan.period}</span>
                  </div>

                  <div className="space-y-2.5 text-xs text-stone-700">
                    {plan.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-stone-100">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full rounded-xl bg-amber-50 border border-amber-200 py-3 text-xs font-bold text-amber-900"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleChangePlan(plan.id)}
                      disabled={actionLoading}
                      className="w-full rounded-xl bg-stone-900 hover:bg-stone-800 py-3 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {actionLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          Switch to {plan.name} <ArrowUpRight size={14} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Danger Zone: Cancellation & Retention */}
      <div className="rounded-3xl border border-red-200 bg-red-50/40 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-bold text-red-900 flex items-center gap-2">
              <ShieldAlert size={18} className="text-red-600" /> Cancel Café Subscription
            </h4>
            <p className="text-xs text-red-700 mt-1 max-w-xl">
              Cancelling suspends the café account immediately. All menu, order history, and table configurations will be kept safe for a <strong>30-day retention period</strong> before permanent deletion.
            </p>
          </div>
          <button
            onClick={() => setShowCancelModal(true)}
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 transition shrink-0"
          >
            Cancel Subscription
          </button>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-stone-900">Confirm Subscription Cancellation</h3>
            <p className="text-xs text-stone-600 mt-2">
              Are you sure you want to cancel? Your café QR ordering site will be suspended, and your account will enter a 30-day retention countdown before permanent data purging.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 size={13} className="animate-spin" />}
                Yes, Cancel Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
