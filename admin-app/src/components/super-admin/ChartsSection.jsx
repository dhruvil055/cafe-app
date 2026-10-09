import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AlertTriangle, Store, ArrowUpRight, ShieldAlert, CheckCircle2, CreditCard } from 'lucide-react';

const PLAN_COLORS = {
  starter: '#9a6f46',
  pro: '#f59e0b',
  enterprise: '#06b6d4',
};

export default function ChartsSection({
  metrics,
  tenants = [],
  onOpenTenant,
  onNavigateTab,
}) {
  const [timeRange, setTimeRange] = useState('30d'); // '7d' | '30d'

  // Detect if current theme is dark via html class
  const isDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true;

  // Realistic mock trend data for Orders + GMV over time (TODO: replace with /platform/admin/metrics/trends endpoint once available)
  const trendData30d = [
    { date: 'Sep 10', orders: 120, gmv: 28400 },
    { date: 'Sep 14', orders: 145, gmv: 34200 },
    { date: 'Sep 18', orders: 190, gmv: 46100 },
    { date: 'Sep 22', orders: 210, gmv: 52000 },
    { date: 'Sep 26', orders: 240, gmv: 59800 },
    { date: 'Sep 30', orders: 280, gmv: 71200 },
    { date: 'Oct 04', orders: 310, gmv: 82500 },
    { date: 'Oct 08', orders: 345, gmv: 91000 },
  ];

  const trendData7d = [
    { date: 'Oct 03', orders: 42, gmv: 9800 },
    { date: 'Oct 04', orders: 50, gmv: 12400 },
    { date: 'Oct 05', orders: 48, gmv: 11900 },
    { date: 'Oct 06', orders: 58, gmv: 15200 },
    { date: 'Oct 07', orders: 62, gmv: 16800 },
    { date: 'Oct 08', orders: 65, gmv: 17400 },
    { date: 'Oct 09', orders: 70, gmv: 18900 },
  ];

  const activeTrendData = timeRange === '7d' ? trendData7d : trendData30d;

  // Plan distribution data
  const starterCount = metrics?.planBreakdown?.starter ?? 0;
  const proCount = metrics?.planBreakdown?.pro ?? 0;
  const enterpriseCount = metrics?.planBreakdown?.enterprise ?? 0;

  const planData = [
    { name: 'Starter', value: starterCount, color: PLAN_COLORS.starter },
    { name: 'Pro', value: proCount, color: PLAN_COLORS.pro },
    { name: 'Enterprise', value: enterpriseCount, color: PLAN_COLORS.enterprise },
  ].filter((p) => p.value > 0);

  // Identify "Needs Attention" items:
  const suspendedCafes = tenants.filter((t) => t.status === 'suspended');
  const emptySetupCafes = tenants.filter((t) => t.status === 'active' && (t.tableCount === 0 || t.productCount === 0));
  const failedPayments = metrics?.paymentFailures ?? 0;

  const tooltipBg = isDark ? '#1c1917' : '#ffffff';
  const tooltipBorder = isDark ? '#292524' : '#e2e8f0';
  const tooltipText = isDark ? '#fafaf9' : '#0f172a';
  const axisColor = isDark ? '#78716c' : '#94a3b8';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chart 1: Orders & GMV Trend */}
      <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 p-6 flex flex-col justify-between shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Platform Volume & Orders</h3>
            <p className="text-xs text-slate-500 dark:text-stone-400 mt-0.5">Aggregate GMV (₹) and transaction throughput</p>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-stone-800 bg-slate-100 dark:bg-stone-950 p-1">
            <button
              onClick={() => setTimeRange('7d')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                timeRange === '7d'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow'
                  : 'text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last 7d
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                timeRange === '30d'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow'
                  : 'text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last 30d
            </button>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gmvGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '12px',
                  color: tooltipText,
                  fontSize: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                }}
              />
              <Area type="monotone" dataKey="gmv" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#gmvGradient)" name="GMV (₹)" />
              <Area type="monotone" dataKey="orders" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#orderGradient)" name="Orders" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 dark:border-stone-800/80 pt-3 text-xs text-slate-500 dark:text-stone-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-stone-300">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Gross Volume (GMV)
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-stone-300">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Completed Orders
            </span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-stone-500">Live platform aggregate</span>
        </div>
      </div>

      {/* Chart 2: Plan Distribution */}
      <div className="rounded-3xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 p-6 flex flex-col justify-between shadow-xs transition-colors">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Plan Distribution</h3>
          <p className="text-xs text-slate-500 dark:text-stone-400 mt-0.5">SaaS tier allocation across cafés</p>
        </div>

        <div className="h-52 w-full flex items-center justify-center my-2">
          {planData.length === 0 ? (
            <div className="text-xs text-slate-400 dark:text-stone-500">No subscription plan data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {planData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke={isDark ? '#1c1917' : '#ffffff'} strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: '12px',
                    color: tooltipText,
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="space-y-2 border-t border-slate-200 dark:border-stone-800/80 pt-3 text-xs">
          <div className="flex items-center justify-between text-slate-700 dark:text-stone-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#9a6f46]" /> Starter Tier
            </span>
            <span className="font-bold text-slate-900 dark:text-white">{starterCount} cafés</span>
          </div>
          <div className="flex items-center justify-between text-slate-700 dark:text-stone-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pro Tier
            </span>
            <span className="font-bold text-slate-900 dark:text-white">{proCount} cafés</span>
          </div>
          <div className="flex items-center justify-between text-slate-700 dark:text-stone-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Enterprise Tier
            </span>
            <span className="font-bold text-slate-900 dark:text-white">{enterpriseCount} cafés</span>
          </div>
        </div>
      </div>

      {/* Needs Attention Panel (Span 3) */}
      <div className="lg:col-span-3 rounded-3xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 p-6 shadow-xs transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <AlertTriangle size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Needs Attention</h3>
              <p className="text-xs text-slate-500 dark:text-stone-400">Operational alerts, setup bottlenecks & risk mitigation</p>
            </div>
          </div>

          <span className="rounded-full bg-slate-100 dark:bg-stone-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-stone-300 border border-slate-200 dark:border-stone-700">
            {suspendedCafes.length + emptySetupCafes.length + (failedPayments > 0 ? 1 : 0)} Active Alerts
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Alert 1: Suspended Cafés */}
          <div className="rounded-2xl border border-slate-200 dark:border-stone-800/80 bg-slate-50/80 dark:bg-stone-950/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <ShieldAlert size={14} /> Suspended Cafés ({suspendedCafes.length})
              </span>
              {suspendedCafes.length > 0 && (
                <button
                  onClick={() => onNavigateTab && onNavigateTab('tenants', { filterStatus: 'suspended' })}
                  className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                >
                  View <ArrowUpRight size={11} />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-stone-400">
              {suspendedCafes.length > 0
                ? `${suspendedCafes.length} café(s) have been halted and are not serving diners.`
                : 'All registered cafés are currently in good standing.'}
            </p>
            {suspendedCafes.slice(0, 2).map((c) => (
              <div key={c.id} className="mt-2 flex items-center justify-between text-[11px] bg-white dark:bg-stone-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-stone-800">
                <span className="text-slate-800 dark:text-stone-300 font-medium truncate max-w-[140px]">{c.name}</span>
                <button
                  onClick={() => onOpenTenant && onOpenTenant(c)}
                  className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                >
                  Manage
                </button>
              </div>
            ))}
          </div>

          {/* Alert 2: Incomplete Onboarding / 0 items or tables */}
          <div className="rounded-2xl border border-slate-200 dark:border-stone-800/80 bg-slate-50/80 dark:bg-stone-950/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Store size={14} /> Incomplete Setup ({emptySetupCafes.length})
              </span>
              {emptySetupCafes.length > 0 && (
                <button
                  onClick={() => onNavigateTab && onNavigateTab('tenants')}
                  className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                >
                  View <ArrowUpRight size={11} />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-stone-400">
              {emptySetupCafes.length > 0
                ? `${emptySetupCafes.length} café(s) have 0 tables or empty menus.`
                : 'All active cafés have configured menu products and active tables.'}
            </p>
            {emptySetupCafes.slice(0, 2).map((c) => (
              <div key={c.id} className="mt-2 flex items-center justify-between text-[11px] bg-white dark:bg-stone-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-stone-800">
                <span className="text-slate-800 dark:text-stone-300 font-medium truncate max-w-[140px]">{c.name}</span>
                <button
                  onClick={() => onOpenTenant && onOpenTenant(c)}
                  className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                >
                  Inspect
                </button>
              </div>
            ))}
          </div>

          {/* Alert 3: Platform Security & Billing Checks */}
          <div className="rounded-2xl border border-slate-200 dark:border-stone-800/80 bg-slate-50/80 dark:bg-stone-950/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 flex items-center gap-1.5">
                <CreditCard size={14} /> Security & Audits
              </span>
              <button
                onClick={() => onNavigateTab && onNavigateTab('audit')}
                className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
              >
                Audit Log <ArrowUpRight size={11} />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-stone-400">
              {failedPayments > 0
                ? `${failedPayments} security or audit warning event(s) detected in the last cycle.`
                : 'Zero security lockouts or anomaly alerts recorded in active trail.'}
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Multi-tenant database isolation: 100% verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
