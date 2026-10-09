import { useState, useEffect } from 'react';
import {
  CreditCard, Sparkles, AlertTriangle, CheckCircle2,
  Download, ArrowUpRight, ShieldAlert, Loader2, RefreshCw,
  AlertCircle, FileText, Check, Zap
} from 'lucide-react';
import api from '../services/api';
import PageHeader from '../components/common/PageHeader';
import ConfirmDialog from '../components/common/ConfirmDialog';

const ALL_PLANS = [
  {
    id: 'starter',
    name: 'Starter Plan',
    monthlyPrice: 999,
    annualPrice: 799,
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
    monthlyPrice: 2499,
    annualPrice: 1999,
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
    monthlyPrice: 4999,
    annualPrice: 3999,
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
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'
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
      await api.post('/tenant/billing/change-plan', { plan: planId });
      setMessage(`Successfully switched subscription to ${planId.toUpperCase()} plan.`);
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-stone-200 border-t-amber-600" />
      </div>
    );
  }

  const currentPlan = data?.plan || 'starter';
  const limits = data?.limits || { tables: 5, menuItems: 15, staffUsers: 2 };
  const usage = data?.usage || { tables: 0, menuItems: 0, staffUsers: 0 };
  const subStatus = data?.subscription?.status || 'trial';
  const isOverLimit = (usage.menuItems > limits.menuItems) || (usage.tables > limits.tables);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Plan, Quotas & Billing"
        subtitle="Manage your Brewhaus subscription, monitor resource usage quotas, and download tax invoices."
        breadcrumbs={[
          { label: 'Admin', to: '/team' },
          { label: 'Plan & Billing' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportData}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs transition"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Backup Data (.JSON)</span>
            </button>
            <button
              type="button"
              onClick={fetchSummary}
              disabled={loading}
              className="p-2 rounded-xl border border-stone-200 bg-white text-stone-500 hover:text-stone-900 transition"
              title="Refresh quota status"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {/* Notifications */}
      {message && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 shadow-xs">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 shadow-xs">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* OVER-LIMIT RESOLUTION BANNER (Fixes Bug #10) */}
      {isOverLimit && (
        <div className="rounded-3xl border border-red-300 bg-gradient-to-r from-red-50 to-amber-50 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-red-950">
                  Plan Quota Exceeded ({usage.menuItems}/{limits.menuItems} Menu Items)
                </h3>
                <p className="mt-0.5 text-xs text-red-800 leading-relaxed">
                  Your café has <strong>{usage.menuItems} menu items</strong>, exceeding the <strong>{limits.menuItems} item limit</strong> on the {currentPlan.toUpperCase()} tier. Upgrade to <strong>Pro Plan</strong> now to instantly lift all limits and enable unlimited modifiers.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleChangePlan('pro')}
              disabled={actionLoading}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 px-5 py-2.5 text-xs font-bold text-white shadow-md transition flex items-center justify-center gap-2 shrink-0"
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Upgrade to Pro (₹2,499/mo)
            </button>
          </div>
        </div>
      )}

      {/* Plan Status & Quota Meters */}
      <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                {subStatus === 'trial' ? '14-Day Free Trial' : subStatus.toUpperCase()}
              </span>
              {data?.deletionRequestedAt && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-900 uppercase tracking-wider">
                  Pending Deletion
                </span>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-bold font-display text-espresso-950 capitalize">
              {currentPlan} Plan Active
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {subStatus === 'trial'
                ? 'Your trial includes all starter features. Switch anytime to expand capacity.'
                : 'Billed monthly via Razorpay Subscriptions (GST invoice issued automatically).'}
            </p>
          </div>

          <div className="text-right">
            <span className="font-mono text-2xl font-bold text-espresso-950">
              ₹{currentPlan === 'pro' ? '2,499' : currentPlan === 'enterprise' ? '4,999' : '999'}
            </span>
            <span className="text-xs text-stone-500"> / month</span>
          </div>
        </div>

        {/* 3 Quota Meters */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Menu items meter */}
          <div className={`rounded-2xl border p-4.5 space-y-2.5 ${
            usage.menuItems > limits.menuItems
              ? 'border-red-300 bg-red-50/40'
              : 'border-stone-200 bg-stone-50/50'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-700">Menu Items Quota</span>
              <span className={`font-mono font-bold ${usage.menuItems > limits.menuItems ? 'text-red-700' : 'text-stone-900'}`}>
                {usage.menuItems} / {limits.menuItems}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-stone-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  usage.menuItems > limits.menuItems ? 'bg-red-500' : 'bg-amber-600'
                }`}
                style={{ width: `${Math.min(100, (usage.menuItems / limits.menuItems) * 100)}%` }}
              />
            </div>
            {usage.menuItems > limits.menuItems ? (
              <p className="text-[11px] font-semibold text-red-600 flex items-center justify-between">
                <span>Limit exceeded (+{usage.menuItems - limits.menuItems} items)</span>
                <button
                  type="button"
                  onClick={() => handleChangePlan('pro')}
                  className="underline hover:text-red-800"
                >
                  Upgrade
                </button>
              </p>
            ) : (
              <p className="text-[11px] text-stone-500">
                {limits.menuItems - usage.menuItems} slots remaining
              </p>
            )}
          </div>

          {/* Tables meter */}
          <div className={`rounded-2xl border p-4.5 space-y-2.5 ${
            usage.tables > limits.tables
              ? 'border-red-300 bg-red-50/40'
              : 'border-stone-200 bg-stone-50/50'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-700">Tables & QRs</span>
              <span className={`font-mono font-bold ${usage.tables > limits.tables ? 'text-red-700' : 'text-stone-900'}`}>
                {usage.tables} / {limits.tables}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-stone-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  usage.tables > limits.tables ? 'bg-red-500' : 'bg-amber-600'
                }`}
                style={{ width: `${Math.min(100, (usage.tables / limits.tables) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-stone-500">
              {Math.max(0, limits.tables - usage.tables)} tables available
            </p>
          </div>

          {/* Staff users meter */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-700">Staff Accounts</span>
              <span className="font-mono font-bold text-stone-900">
                {usage.staffUsers} / {limits.staffUsers}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-stone-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-600 transition-all duration-300"
                style={{ width: `${Math.min(100, (usage.staffUsers / limits.staffUsers) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-stone-500">
              {Math.max(0, limits.staffUsers - usage.staffUsers)} invites remaining
            </p>
          </div>
        </div>
      </div>

      {/* Plan Comparison Section with Monthly/Annual toggle */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold font-display text-espresso-950">
              Compare Subscription Plans
            </h3>
            <p className="text-xs text-stone-500">
              Choose the tier that matches your café's seating capacity and rush volume.
            </p>
          </div>

          {/* Monthly / Annual Toggle */}
          <div className="flex items-center self-start sm:self-auto rounded-xl border border-stone-200 bg-stone-50 p-1">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                billingCycle === 'monthly'
                  ? 'bg-white text-espresso-950 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition flex items-center gap-1.5 ${
                billingCycle === 'annual'
                  ? 'bg-white text-espresso-950 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <span>Annual</span>
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                20% OFF
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {ALL_PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-7 transition border-2 ${
                  isCurrent
                    ? 'border-amber-600 bg-white shadow-xl'
                    : 'border-stone-200 bg-white hover:border-stone-300 shadow-xs'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-amber-600 to-orange-500 px-3.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                    Most Popular
                  </div>
                )}

                <div>
                  <h4 className="text-lg font-bold font-display text-espresso-950">{plan.name}</h4>
                  <p className="mt-1 text-xs text-stone-500 min-h-[32px] leading-relaxed">{plan.desc}</p>

                  <div className="my-5">
                    <span className="text-3xl font-bold font-display text-espresso-950">₹{price}</span>
                    <span className="text-xs text-stone-500"> / month</span>
                    {billingCycle === 'annual' && (
                      <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Billed annually</p>
                    )}
                  </div>

                  {/* Feature list */}
                  <div className="space-y-2.5 text-xs text-stone-700 pt-2 border-t border-stone-100">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-stone-100">
                  {isCurrent ? (
                    <div className="w-full rounded-xl bg-amber-50 border border-amber-200 py-2.5 text-center text-xs font-bold text-amber-900">
                      ✓ Active Plan
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleChangePlan(plan.id)}
                      disabled={actionLoading}
                      className="btn-primary w-full rounded-xl py-2.5 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {actionLoading ? (
                        <Loader2 size={13} className="animate-spin" />
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

      {/* Invoices List */}
      <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-espresso-950">
              Tax Invoices & Receipts
            </h3>
            <p className="text-xs text-stone-500">
              Download GST compliant tax invoices for your café accounting and filings.
            </p>
          </div>
        </div>

        <div className="divide-y divide-stone-100 text-xs">
          {[
            { id: 'INV-2026-003', date: 'Oct 01, 2026', amount: '₹2,499 + 18% GST', status: 'Paid', plan: 'Pro Monthly' },
            { id: 'INV-2026-002', date: 'Sep 01, 2026', amount: '₹2,499 + 18% GST', status: 'Paid', plan: 'Pro Monthly' },
            { id: 'INV-2026-001', date: 'Aug 01, 2026', amount: '₹999 + 18% GST', status: 'Paid', plan: 'Starter Monthly' },
          ].map((inv) => (
            <div key={inv.id} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-stone-400" />
                <div>
                  <p className="font-bold text-stone-900">{inv.id} · {inv.plan}</p>
                  <p className="text-[11px] text-stone-400">{inv.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold text-stone-800">{inv.amount}</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  {inv.status}
                </span>
                <button
                  type="button"
                  onClick={() => handleExportData()}
                  className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700"
                  title="Download Invoice"
                >
                  <Download size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscription Cancellation / Danger Area */}
      <div className="rounded-3xl border border-rose-200 bg-rose-50/40 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-rose-950 flex items-center gap-2">
              <ShieldAlert size={16} className="text-rose-600" /> Cancel Café Subscription
            </h4>
            <p className="text-xs text-rose-800 mt-1 max-w-xl">
              Cancelling immediately halts live QR table orders. All past customer sales, recipes, and table configurations are kept safe for <strong>30 days</strong> before permanent deletion.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition shrink-0"
          >
            Cancel Subscription
          </button>
        </div>
      </div>

      {/* Universal Confirm Dialog for Cancel */}
      <ConfirmDialog
        isOpen={showCancelModal}
        title="Confirm Subscription Cancellation?"
        message="Your QR ordering site will be paused immediately, and you will have 30 days of data retention to reactivate before data is purged."
        confirmText="Yes, Cancel Subscription"
        confirmVariant="danger"
        loading={actionLoading}
        onConfirm={handleCancelSubscription}
        onClose={() => setShowCancelModal(false)}
      />
    </div>
  );
}
