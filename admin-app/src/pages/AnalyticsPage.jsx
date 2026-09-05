import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingBag, DollarSign,
  Package, Tag, Clock, BarChart2, RefreshCw,
} from 'lucide-react';
import api from '../services/api';

/* ─── colour tokens ──────────────────────────────────────────── */
const C = {
  brew:    '#c96b18',
  espresso:'#7d5436',
  emerald: '#10b981',
  amber:   '#f59e0b',
  sky:     '#0ea5e9',
  rose:    '#f43f5e',
  violet:  '#8b5cf6',
  slate:   '#64748b',
};

const STATUS_COLOR = {
  pending:   C.amber,
  confirmed: C.sky,
  preparing: '#f97316',
  ready:     C.emerald,
  completed: '#059669',
  cancelled: C.rose,
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4 },
});

/* ─── tiny components ──────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, tone, growth }) {
  const up = parseFloat(growth) > 0;
  return (
    <motion.div {...fadeUp(0)} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</div>
          <div className="mt-2 text-3xl font-bold text-stone-900">{value}</div>
          {sub && <div className="mt-1 text-xs text-stone-500">{sub}</div>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 ${tone}`}>
          <Icon size={20} />
        </div>
      </div>
      {growth !== null && growth !== undefined && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-semibold ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
          {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(parseFloat(growth))}% vs last month
        </div>
      )}
    </motion.div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-xl font-bold text-espresso-900">{title}</h2>
      {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-soft text-sm">
      <p className="font-semibold text-espresso-900 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="text-xs">
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}{suffix}
        </p>
      ))}
    </div>
  );
};

/* ─── main page ──────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      setError('');
      const { data: res } = await api.get('/analytics/summary');
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const refresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-brew-500" />
        <p className="text-sm text-stone-500">Loading analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <BarChart2 size={40} className="text-stone-300" />
        <p className="text-stone-600 font-medium">{error}</p>
        <button onClick={load} className="btn-primary px-5 py-2.5 text-sm gap-2">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const { kpi, monthly, statusBreakdown, paymentSplit, topProducts, hourlyTraffic, dailyOrders } = data;

  /* ── status pie data ── */
  const statusPie = statusBreakdown.map(({ status, count }) => ({
    name: status,
    value: count,
    color: STATUS_COLOR[status] || C.slate,
  }));

  /* ── payment pie data ── */
  const payPie = paymentSplit.map(({ method, count }) => ({
    name: method === 'razorpay' ? 'Razorpay' : 'Cash',
    value: count,
    color: method === 'razorpay' ? C.violet : C.emerald,
  }));

  /* ── hourly: only 6am–midnight for readability ── */
  const hourlySlice = hourlyTraffic.filter(h => h.hour >= 6 && h.hour <= 23);

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso-900">Analytics</h1>
          <p className="text-sm text-stone-500 mt-0.5">Full café performance overview</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 shadow-sm hover:bg-stone-50 disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={ShoppingBag}  label="Today's Orders"      value={kpi.todayOrders}           tone="text-sky-600"     />
        <KpiCard icon={DollarSign}   label="Today's Revenue"     value={`₹${kpi.todayRevenue.toLocaleString('en-IN')}`}  tone="text-emerald-600" />
        <KpiCard icon={TrendingUp}   label="This Month Revenue"  value={`₹${kpi.thisMonthRevenue.toLocaleString('en-IN')}`} tone="text-brew-600"  growth={kpi.revenueGrowth} />
        <KpiCard icon={Clock}        label="Avg Order Value"     value={`₹${kpi.avgOrderValue}`}   tone="text-violet-600" sub={`${kpi.thisMonthOrders} orders this month`} />
        <KpiCard icon={ShoppingBag}  label="Total Orders (All)"  value={kpi.totalOrders.toLocaleString('en-IN')}          tone="text-amber-600"  />
        <KpiCard icon={Package}      label="Menu Items"          value={kpi.totalProducts}          tone="text-rose-500"   />
        <KpiCard icon={Tag}          label="Categories"          value={kpi.totalCategories}        tone="text-indigo-500" />
        <KpiCard icon={DollarSign}   label="Last Month Revenue"  value={`₹${kpi.lastMonthRevenue.toLocaleString('en-IN')}`} tone="text-stone-500" />
      </div>

      {/* ── Monthly Revenue (12 months) ── */}
      <motion.div {...fadeUp(0.05)} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft">
        <SectionTitle title="Monthly Revenue & Orders" subtitle="Last 12 months" />
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={monthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.brew}    stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.brew}    stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.sky}     stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.sky}     stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1ece7" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="rev" orientation="left"  tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
            <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip prefix="" />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke={C.brew}    strokeWidth={2.5} fill="url(#revGrad)" dot={false} />
            <Area yAxisId="ord" type="monotone" dataKey="orders"  name="Orders"      stroke={C.sky}     strokeWidth={2}   fill="url(#ordGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── Daily orders this month + Hourly traffic ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div {...fadeUp(0.1)} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft">
          <SectionTitle title="Daily Orders" subtitle={`This month — ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`} />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyOrders} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1ece7" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="orders" name="Orders" fill={C.brew} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div {...fadeUp(0.12)} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft">
          <SectionTitle title="Hourly Traffic" subtitle="Orders by hour — this month" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlySlice} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1ece7" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="orders" name="Orders" fill={C.espresso} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* ── Top 10 Products ── */}
      <motion.div {...fadeUp(0.15)} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft">
        <SectionTitle title="Top Selling Items" subtitle="By quantity — all time" />
        {topProducts.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-10">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(320, topProducts.length * 36)}>
            <BarChart data={topProducts} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1ece7" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#1a0f08', fontWeight: 500 }} tickLine={false} axisLine={false} width={160} interval={0} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="quantity" name="Qty Sold" fill={C.brew} radius={[0, 6, 6, 0]} barSize={18} label={{ position: 'right', fontSize: 12, fontWeight: 600, fill: C.espresso }} />
            </BarChart>
          </ResponsiveContainer>
        )}

      </motion.div>

      {/* ── Status + Payment pies ── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Order status */}
        <motion.div {...fadeUp(0.18)} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft">
          <SectionTitle title="Order Status Breakdown" subtitle="All time" />
          {statusPie.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-10">No data yet.</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={statusPie} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={3}>
                    {statusPie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-2">
                {statusPie.map(({ name, value, color }) => (
                  <li key={name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm capitalize text-stone-700">{name}</span>
                    </div>
                    <span className="text-sm font-bold text-espresso-900">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>

        {/* Payment method */}
        <motion.div {...fadeUp(0.2)} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft">
          <SectionTitle title="Payment Method Split" subtitle="All time" />
          {payPie.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-10">No data yet.</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={payPie} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={3}>
                    {payPie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-3">
                {payPie.map(({ name, value, color }) => {
                  const row = paymentSplit.find(p => (p.method === 'razorpay' ? 'Razorpay' : 'Cash') === name);
                  return (
                    <li key={name} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-sm font-medium text-stone-700">{name}</span>
                        </div>
                        <span className="text-sm font-bold text-espresso-900">{value} orders</span>
                      </div>
                      {row && (
                        <div className="pl-4.5 text-xs text-stone-500">
                          ₹{row.revenue.toLocaleString('en-IN')} revenue
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Monthly orders table ── */}
      <motion.div {...fadeUp(0.22)} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft">
        <SectionTitle title="Monthly Summary Table" subtitle="Revenue & orders — last 12 months" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-widest text-stone-400">Month</th>
                <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-widest text-stone-400">Orders</th>
                <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-widest text-stone-400">Revenue</th>
                <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-widest text-stone-400">Avg/Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {[...monthly].reverse().map((m) => {
                const avg = m.orders > 0 ? Math.round(m.revenue / m.orders) : 0;
                return (
                  <tr key={m.label} className="hover:bg-stone-50 transition">
                    <td className="py-3 font-medium text-espresso-900">{m.label}</td>
                    <td className="py-3 text-right text-stone-700">{m.orders}</td>
                    <td className="py-3 text-right font-semibold text-espresso-900">₹{m.revenue.toLocaleString('en-IN')}</td>
                    <td className="py-3 text-right text-stone-500">₹{avg}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

    </div>
  );
}
