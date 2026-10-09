import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2 } from 'lucide-react';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '₹999',
    period: '/ month',
    description: 'Essential QR table-ordering for boutique coffee shops & popups.',
    tables: 'Up to 15 tables',
    items: 'Up to 45 menu items',
    features: ['Instant QR table generation', 'Standard Kitchen Display (KDS)', 'Daily settlement exports'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹2,499',
    period: '/ month',
    description: 'Advanced capabilities for high-volume, multi-station dine-in cafés.',
    tables: 'Up to 50 tables',
    items: 'Up to 250 menu items',
    popular: true,
    features: [
      'Multi-station KDS routing (Bar/Kitchen)',
      'Customer Loyalty & CRM campaigns',
      'Advanced sales & category analytics',
      'Custom subdomain branding',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '₹4,999',
    period: '/ month',
    description: 'Uncapped scale and dedicated SLA for large restaurant groups.',
    tables: 'Unlimited tables',
    items: 'Unlimited menu items',
    features: [
      'Multi-outlet branch consolidation',
      'Dedicated 99.9% uptime SLA',
      'Custom payment gateway & domain routing',
      '24/7 Priority support hotline',
    ],
  },
];

export default function PlanModal({ isOpen, onClose, tenant, onSave, loading }) {
  const [selectedPlan, setSelectedPlan] = useState(tenant?.plan || 'starter');

  if (!isOpen || !tenant) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0"
          style={{ backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(4px)' }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="relative w-full max-w-3xl rounded-3xl border p-6 sm:p-8 shadow-2xl text-[var(--text-primary)] z-10 max-h-[90vh] overflow-y-auto"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <button
            onClick={onClose}
            className="absolute right-5 top-5 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition"
          >
            <X size={18} />
          </button>

          <div className="mb-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Subscription Management
            </span>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mt-1">
              Change Plan for "{tenant.name}"
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Adjust quota caps and active platform entitlements. Quota recalculations take effect immediately.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              const isCurrent = tenant.plan === plan.id;

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative flex flex-col justify-between rounded-2xl border p-5 cursor-pointer transition ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500/20 bg-[var(--brand-primary-subtle)] shadow-sm'
                      : 'border-[var(--border-primary)] bg-[var(--hover-bg)] hover:border-[var(--border-primary)]'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-2.5 right-4 rounded-full bg-amber-500 px-2.5 py-0.5 text-[9px] font-black uppercase text-stone-950">
                      Most Popular
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-[var(--text-primary)]">{plan.name}</div>
                      {isCurrent && (
                        <span className="rounded-full bg-[var(--hover-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                          Current
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{plan.price}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">{plan.period}</span>
                    </div>

                    <p className="mt-2 text-[11px] text-[var(--text-muted)] leading-snug">{plan.description}</p>

                    <div className="my-4 border-t border-[var(--border-primary)]/80 pt-3 space-y-1.5">
                      <div className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                        <Check size={12} className="text-emerald-500 dark:text-emerald-400" /> {plan.tables}
                      </div>
                      <div className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                        <Check size={12} className="text-emerald-500 dark:text-emerald-400" /> {plan.items}
                      </div>
                      {plan.features.map((feat) => (
                        <div key={feat} className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
                          <Check size={11} className="text-[var(--text-muted)]" /> {feat}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--border-primary)]/80">
                    <button
                      type="button"
                      className={`w-full rounded-xl py-2 text-xs font-bold transition ${
                        isSelected
                          ? 'bg-amber-500 text-stone-950 shadow-xs'
                          : 'bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]'
                      }`}
                    >
                      {isSelected ? 'Selected Plan' : 'Select'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-primary)]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(selectedPlan)}
              disabled={loading || selectedPlan === tenant.plan}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              Save Plan Update
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}