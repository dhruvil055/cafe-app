import { useEffect, useState } from 'react';
import { 
  BarChart3, Calendar, Download, RefreshCw, Loader2, 
  TrendingDown, DollarSign, Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const UNIT_LABELS = {
  piece: 'pcs', cup: 'cups', glass: 'glasses', bottle: 'bottles',
  gram: 'g', kilogram: 'kg', millilitre: 'ml', litre: 'L',
  pack: 'packs', box: 'boxes', unit: 'units',
};

export default function InventoryReportsPage() {
  const [period, setPeriod] = useState('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (fromDate && toDate) {
        params.from = fromDate;
        params.to = toDate;
      } else {
        params.period = period;
      }
      const res = await api.get('/inventory/reports/consumption', { params });
      setData(res.data?.consumption || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load consumption report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [period]);

  const totalCost = data.reduce((acc, row) => acc + (row.estimatedCost || 0), 0);
  const totalItemsConsumed = data.reduce((acc, row) => acc + (row.totalConsumed || 0), 0);

  const handleExportCSV = () => {
    if (!data.length) return toast.error('No data to export');
    const headers = ['Item Name', 'Category', 'Quantity Consumed', 'Unit', 'Unit Cost', 'Estimated Cost', 'Order Count'];
    const rows = data.map((r) => [
      `"${r.name}"`,
      `"${r.category || 'General'}"`,
      r.totalConsumed,
      r.unit,
      r.costPerUnit || 0,
      (r.estimatedCost || 0).toFixed(2),
      r.txnCount || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `consumption_report_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-espresso-900">Inventory Consumption Reports</h2>
          <p className="mt-1 text-xs text-stone-500">
            Track ingredients and packaging consumed through customer sales and calculate raw material COGS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={fetchReport}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Period Filter Selector */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'week', label: 'Last 7 Days' },
              { key: 'month', label: 'This Month' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setPeriod(p.key);
                  setFromDate('');
                  setToDate('');
                }}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  period === p.key && !fromDate
                    ? 'bg-espresso-900 text-white shadow-sm'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs focus:border-brew-500 focus:outline-none"
            />
            <span className="text-xs text-stone-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs focus:border-brew-500 focus:outline-none"
            />
            <button
              onClick={() => {
                if (fromDate && toDate) fetchReport();
                else toast.error('Please choose both from and to dates');
              }}
              className="rounded-xl bg-brew-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brew-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Total Items Consumed</div>
          <div className="mt-2 text-3xl font-bold text-stone-900">{data.length} distinct items</div>
          <div className="mt-1 text-xs text-stone-400">Tracked in completed orders</div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Estimated Raw Material Cost</div>
          <div className="mt-2 text-3xl font-bold text-emerald-600">₹{totalCost.toFixed(2)}</div>
          <div className="mt-1 text-xs text-stone-400">Calculated from purchase cost per unit</div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Active Period</div>
          <div className="mt-2 text-2xl font-bold text-stone-800 capitalize">{fromDate ? `${fromDate} to ${toDate}` : period}</div>
          <div className="mt-1 text-xs text-stone-400">Consumption timeframe</div>
        </div>
      </div>

      {/* Report Table */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-soft overflow-hidden">
        <div className="border-b border-stone-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-espresso-900">Consumption Breakdown</h3>
          <span className="text-xs text-stone-400">{data.length} items consumed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-6 py-3.5">Inventory Item</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5 text-right">Total Consumed</th>
                <th className="px-4 py-3.5 text-right">Unit Cost</th>
                <th className="px-4 py-3.5 text-right">Estimated Cost</th>
                <th className="px-6 py-3.5 text-right">Order Txns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    <Loader2 size={24} className="mx-auto animate-spin text-espresso-600 mb-2" />
                    Calculating consumption data...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-stone-400">
                    No consumption recorded for this time period.
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const unitLabel = UNIT_LABELS[row.unit] || row.unit;
                  return (
                    <tr key={row._id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-stone-900">{row.name}</td>
                      <td className="px-4 py-3.5 text-xs text-stone-500">{row.category || 'General'}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-semibold text-red-600">
                        -{row.totalConsumed.toFixed(2)} <span className="text-xs font-normal text-stone-400">{unitLabel}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs text-stone-600">
                        ₹{row.costPerUnit || 0}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-semibold text-stone-900">
                        ₹{(row.estimatedCost || 0).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-right font-mono text-xs text-stone-500">
                        {row.txnCount}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
