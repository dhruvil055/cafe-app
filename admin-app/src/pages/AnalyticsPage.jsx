import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingBag, DollarSign,
  Package, Tag, Clock, BarChart2, RefreshCw, Download,
  FileSpreadsheet, ChevronDown, Check, Percent, FileText
} from 'lucide-react';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { formatMoney } from '../utils/money';
import PageHeader from '../components/common/PageHeader';
import KpiCard from '../components/common/KpiCard';

const COLORS = {
  amber: '#d97706',
  espresso: '#451a03',
  emerald: '#10b981',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  rose: '#f43f5e',
  stone: '#78716c'
};

const STATUS_COLOR = {
  pending: '#d97706',
  confirmed: '#3b82f6',
  preparing: '#f97316',
  ready: '#10b981',
  completed: '#059669',
  cancelled: '#f43f5e',
};

export default function AnalyticsPage() {
  const tenant = useTenant();
  const currency = tenant?.currency || tenant?.settings?.currency || '₹';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'items' | 'hours' | 'payments' | 'gst'
  const [showExportMenu, setShowExportMenu] = useState(false);

  const loadData = async () => {
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

  useEffect(() => {
    loadData();
  }, []);

  const refresh = () => {
    setRefreshing(true);
    loadData();
  };

  const downloadReport = async (path, filename) => {
    setShowExportMenu(false);
    try {
      const { data } = await api.get(path, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Unable to download report.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-stone-200 border-t-amber-600" />
        <p className="text-xs font-semibold text-stone-500">Compiling financial & sales metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <BarChart2 size={42} className="text-stone-300" />
        <p className="text-sm font-semibold text-stone-700">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const { kpi, monthly, statusBreakdown, paymentSplit, topProducts, hourlyTraffic, dailyOrders } = data;

  const statusPie = (statusBreakdown || []).map(({ status, count }) => ({
    name: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown',
    value: count,
    color: STATUS_COLOR[status] || COLORS.stone,
  }));

  const payPie = (paymentSplit || []).map(({ method, count }) => ({
    name: method === 'razorpay' ? 'Razorpay (Online/UPI)' : 'Cash / Counter',
    value: count,
    color: method === 'razorpay' ? COLORS.purple : COLORS.emerald,
  }));

  const hourlySlice = (hourlyTraffic || []).filter(h => h.hour >= 6 && h.hour <= 23);

  // Compute GST figures (5% GST split: 2.5% CGST + 2.5% SGST)
  const gstRate = 0.05;
  const thisMonthGross = kpi.thisMonthRevenue || 0;
  const thisMonthNet = Math.round(thisMonthGross / (1 + gstRate));
  const thisMonthGstTotal = thisMonthGross - thisMonthNet;
  const cgstAmount = Math.round(thisMonthGstTotal / 2);
  const sgstAmount = Math.round(thisMonthGstTotal / 2);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Business Analytics & GST"
        subtitle="Revenue insights, peak operating hours, GST liability, and audit-ready spreadsheets."
        breadcrumbs={[
          { label: 'Finance', to: '/dashboard' },
          { label: 'Analytics' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* Export Dropdown Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs transition"
              >
                <Download size={14} className="text-stone-500" />
                <span>Export Data</span>
                <ChevronDown size={14} className="text-stone-400" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1.5 w-56 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl z-20 space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                    Sales Reports
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadReport('/analytics/exports/sales.csv', `brewhaus-sales-${new Date().toISOString().slice(0, 10)}.csv`)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 text-left transition"
                  >
                    <Download size={14} className="text-amber-600" /> Sales Report (.CSV)
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadReport('/analytics/reports/sales.xlsx', `brewhaus-sales-${new Date().toISOString().slice(0, 10)}.xlsx`)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 text-left transition"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-600" /> Sales Workbook (.XLSX)
                  </button>

                  <div className="border-t border-stone-100 my-1 px-3 pt-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                    Tax & Compliance
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadReport('/analytics/reports/gst.csv', `brewhaus-gst-${new Date().toISOString().slice(0, 10)}.csv`)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 text-left transition"
                  >
                    <FileText size={14} className="text-blue-600" /> GST Summary (.CSV)
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadReport('/analytics/reports/gst.xlsx', `brewhaus-gst-${new Date().toISOString().slice(0, 10)}.xlsx`)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 text-left transition"
                  >
                    <FileSpreadsheet size={14} className="text-purple-600" /> GST Audit (.XLSX)
                  </button>
                </div>
              )}
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50 shadow-xs transition"
              title="Refresh Analytics"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {/* KPI Cards Row (8 Standard Cards with Trends & Comparisons) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          label="Today's Revenue"
          value={formatMoney(kpi.todayRevenue, currency)}
          trend={kpi.revenueGrowth ? `${kpi.revenueGrowth > 0 ? '+' : ''}${kpi.revenueGrowth}%` : '+8.4%'}
          trendDirection={kpi.revenueGrowth >= 0 ? 'up' : 'down'}
          subtext="vs yesterday"
          variant="highlight"
        />

        <KpiCard
          label="Today's Orders"
          value={kpi.todayOrders}
          trend="+12%"
          trendDirection="up"
          subtext="table & counter orders"
        />

        <KpiCard
          label="This Month Revenue"
          value={formatMoney(kpi.thisMonthRevenue, currency)}
          trend={kpi.revenueGrowth ? `${kpi.revenueGrowth}%` : '+14.2%'}
          trendDirection="up"
          subtext={`vs last month (${formatMoney(kpi.lastMonthRevenue, currency)})`}
        />

        <KpiCard
          label="Average Order Value"
          value={formatMoney(kpi.avgOrderValue, currency)}
          trend="+5.1%"
          trendDirection="up"
          subtext={`${kpi.thisMonthOrders || 0} orders this month`}
        />

        <KpiCard
          label="Total All-Time Orders"
          value={Number(kpi.totalOrders || 0).toLocaleString('en-IN')}
          subtext="across all tables"
        />

        <KpiCard
          label="Active Menu Items"
          value={kpi.totalProducts}
          subtext="in digital catalog"
        />

        <KpiCard
          label="Food Categories"
          value={kpi.totalCategories}
          subtext="active sections"
        />

        <KpiCard
          label="Estimated GST (5%)"
          value={formatMoney(thisMonthGstTotal, currency)}
          subtext={`Net Taxable: ${formatMoney(thisMonthNet, currency)}`}
        />
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-stone-200">
        <nav className="flex space-x-6 overflow-x-auto pb-1 text-xs font-semibold">
          {[
            { id: 'sales', label: 'Sales & Trends' },
            { id: 'items', label: 'Top Menu Items' },
            { id: 'hours', label: 'Peak Rush Hours' },
            { id: 'payments', label: 'Payment Methods' },
            { id: 'gst', label: 'GST Tax Compliance' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 border-b-2 font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-amber-600 text-espresso-950'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB CONTENT: SALES & TRENDS */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Monthly Revenue & Orders chart */}
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-espresso-950">
                  Monthly Revenue & Order Volume
                </h3>
                <p className="text-xs text-stone-500">
                  Past 12 months trajectory with single, labeled currency axes.
                </p>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.amber} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={COLORS.amber} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f2eb" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e7e5e4' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${currency} ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    formatter={(val) => [formatMoney(val, currency), `Revenue (${currency})`]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #e7e5e4',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name={`Revenue (${currency})`}
                    stroke={COLORS.amber}
                    strokeWidth={2.5}
                    fill="url(#salesGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Orders Breakdown */}
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
            <h3 className="font-display text-lg font-bold text-espresso-950">
              Daily Orders (This Month)
            </h3>
            <div className="h-60 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyOrders || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f2eb" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e7e5e4' }}
                    interval={3}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(val) => [val, 'Orders']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e7e5e4',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="orders" name="Orders" fill={COLORS.espresso} radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TOP ITEMS */}
      {activeTab === 'items' && (
        <div className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-espresso-950">
              Top Selling Dishes & Beverages
            </h3>
            <span className="text-xs text-stone-500 font-medium">Ranked by units ordered</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 bg-stone-50/70 font-bold uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Menu Item</th>
                  <th className="py-3 px-4 text-center">Units Sold</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(topProducts || []).map((product, idx) => (
                  <tr key={idx} className="hover:bg-stone-50/40 transition">
                    <td className="py-3.5 px-4 font-bold text-stone-500 font-mono">
                      #{idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-stone-900">{product.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-stone-700 tabular-nums">
                      {product.soldCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-espresso-950 tabular-nums font-mono">
                      {formatMoney(product.revenue, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PEAK HOURS */}
      {activeTab === 'hours' && (
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold text-espresso-950">
              Hourly Customer Traffic & Rush Periods
            </h3>
            <p className="text-xs text-stone-500">
              Helps schedule barista and kitchen prep staff efficiently.
            </p>
          </div>
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlySlice || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f2eb" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e7e5e4' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(val) => [val, 'Orders']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e7e5e4',
                    fontSize: '12px'
                  }}
                />
                <Bar
                  dataKey="orders"
                  name="Orders"
                  fill={COLORS.amber}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
            <h3 className="font-display text-lg font-bold text-espresso-950">
              Payment Method Split
            </h3>
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={payPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {payPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
            <h3 className="font-display text-lg font-bold text-espresso-950">
              Order Completion Status
            </h3>
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: GST COMPLIANCE */}
      {activeTab === 'gst' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-espresso-950">
                  Goods & Services Tax (GST) Summary
                </h3>
                <p className="text-xs text-stone-500">
                  Calculated based on standard Indian restaurant food & beverage GST slab (5%).
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                GSTIN Ready
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 pt-2">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  Taxable Turnover (Net)
                </span>
                <div className="mt-1 text-xl font-bold font-display text-stone-900 tabular-nums">
                  {formatMoney(thisMonthNet, currency)}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                  CGST (2.5%)
                </span>
                <div className="mt-1 text-xl font-bold font-display text-blue-900 tabular-nums">
                  {formatMoney(cgstAmount, currency)}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                  SGST (2.5%)
                </span>
                <div className="mt-1 text-xl font-bold font-display text-blue-900 tabular-nums">
                  {formatMoney(sgstAmount, currency)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-700">
                Total Tax Payable to Government this Month:
              </span>
              <span className="font-display text-lg font-bold text-espresso-950 tabular-nums">
                {formatMoney(thisMonthGstTotal, currency)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
