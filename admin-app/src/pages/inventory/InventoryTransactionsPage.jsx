import { useEffect, useState, useCallback } from 'react';
import { 
  History, Search, Filter, Download, ArrowUpRight, ArrowDownLeft, 
  ChevronLeft, ChevronRight, RefreshCw, Loader2, Calendar, User, FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const UNIT_LABELS = {
  piece: 'pcs', cup: 'cups', glass: 'glasses', bottle: 'bottles',
  gram: 'g', kilogram: 'kg', millilitre: 'ml', litre: 'L',
  pack: 'packs', box: 'boxes', unit: 'units',
};

const TYPE_CONFIG = {
  purchase: { label: 'Purchase', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  manual_addition: { label: 'Manual Add', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  order_consumption: { label: 'Order Sale', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  order_restoration: { label: 'Order Cancel', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  waste: { label: 'Waste', bg: 'bg-red-50 text-red-700 border-red-200' },
  damaged: { label: 'Damaged', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  adjustment: { label: 'Adjustment', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  return: { label: 'Return', bg: 'bg-stone-100 text-stone-700 border-stone-200' },
  correction: { label: 'Correction', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

const TRANSACTION_TYPES = [
  { value: '', label: 'All Transaction Types' },
  { value: 'order_consumption', label: 'Order Sale (Deduction)' },
  { value: 'order_restoration', label: 'Order Cancel (Restoration)' },
  { value: 'purchase', label: 'Purchase (Restock)' },
  { value: 'manual_addition', label: 'Manual Addition' },
  { value: 'waste', label: 'Waste' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'adjustment', label: 'Stock Adjustment' },
  { value: 'return', label: 'Return to Supplier' },
  { value: 'correction', label: 'Audit Correction' },
];

export default function InventoryTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Fetch items for filter dropdown
  useEffect(() => {
    api.get('/inventory/items?limit=200')
      .then((res) => setItems(res.data?.items || []))
      .catch(() => {});
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (selectedItemId) params.itemId = selectedItemId;
      if (selectedType) params.type = selectedType;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const res = await api.get('/inventory/transactions', { params });
      setTransactions(res.data?.transactions || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      toast.error(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedItemId, selectedType, fromDate, toDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totalPages = Math.ceil(total / limit) || 1;

  // Quick Date presets
  const handlePresetDate = (days) => {
    if (days === 0) {
      const today = new Date().toISOString().split('T')[0];
      setFromDate(today);
      setToDate(today);
    } else if (days === 7) {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 7);
      setFromDate(from.toISOString().split('T')[0]);
      setToDate(to.toISOString().split('T')[0]);
    } else if (days === 30) {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 30);
      setFromDate(from.toISOString().split('T')[0]);
      setToDate(to.toISOString().split('T')[0]);
    } else {
      setFromDate('');
      setToDate('');
    }
    setPage(1);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!transactions.length) return toast.error('No transactions to export');

    const headers = ['Date', 'Time', 'Item', 'Type', 'Quantity', 'Balance Before', 'Balance After', 'Reference', 'Reason', 'Performed By'];
    const rows = transactions.map((t) => {
      const d = new Date(t.createdAt);
      return [
        `"${d.toLocaleDateString()}"`,
        `"${d.toLocaleTimeString()}"`,
        `"${t.inventoryItem?.name || ''}"`,
        `"${t.type}"`,
        t.quantity,
        t.balanceBefore,
        t.balanceAfter,
        `"${t.reference || ''}"`,
        `"${(t.reason || t.notes || '').replace(/"/g, '""')}"`,
        `"${t.performedBy?.name || 'System'}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventory_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-espresso-900">Inventory Transaction Audit Log</h2>
          <p className="mt-1 text-xs text-stone-500">
            Immutable tracking log of every stock addition, deduction from customer orders, waste, and manual adjustment.
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
            onClick={fetchTransactions}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">Item</label>
            <select
              value={selectedItemId}
              onChange={(e) => { setSelectedItemId(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
            >
              <option value="">All Inventory Items</option>
              {items.map((i) => (
                <option key={i._id} value={i._id}>{i.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-brew-500 focus:outline-none"
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-stone-200 px-3 py-1.5 text-xs focus:border-brew-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-stone-200 px-3 py-1.5 text-xs focus:border-brew-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Date presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mr-1">Quick:</span>
            <button onClick={() => handlePresetDate(0)} className="rounded-lg bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-200">Today</button>
            <button onClick={() => handlePresetDate(7)} className="rounded-lg bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-200">Last 7 Days</button>
            <button onClick={() => handlePresetDate(30)} className="rounded-lg bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-200">Last 30 Days</button>
            <button onClick={() => handlePresetDate(null)} className="rounded-lg bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-200">Clear</button>
          </div>
          <span className="text-stone-500 text-xs font-medium">Found <strong>{total}</strong> transaction{total === 1 ? '' : 's'}</span>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-6 py-3.5">Date & Time</th>
                <th className="px-4 py-3.5">Item</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5 text-right">Quantity</th>
                <th className="px-4 py-3.5 text-right">Balance Change</th>
                <th className="px-6 py-3.5">Reference / Notes</th>
                <th className="px-4 py-3.5">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    <Loader2 size={24} className="mx-auto animate-spin text-espresso-600 mb-2" />
                    Loading transaction records...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-stone-400">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isPositive = tx.quantity > 0;
                  const cfg = TYPE_CONFIG[tx.type] || { label: tx.type, bg: 'bg-stone-100 text-stone-700 border-stone-200' };
                  const txDate = new Date(tx.createdAt);
                  const unit = tx.inventoryItem?.unit || 'unit';
                  const unitLabel = UNIT_LABELS[unit] || unit;

                  return (
                    <tr key={tx._id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs text-stone-600">
                        <div className="font-medium text-stone-900">{txDate.toLocaleDateString()}</div>
                        <div className="text-[10px] text-stone-400">{txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-medium text-stone-900">
                        {tx.inventoryItem?.name || 'Deleted item'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-semibold">
                        <span className={`inline-flex items-center gap-0.5 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                          {isPositive ? `+${tx.quantity}` : tx.quantity} {unitLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs text-stone-600">
                        {tx.balanceBefore} → <strong className="text-stone-900">{tx.balanceAfter}</strong>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-stone-700">
                        {tx.reference && (
                          <span className="font-mono font-semibold text-indigo-700 mr-2 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {tx.reference}
                          </span>
                        )}
                        <span>{tx.reason || tx.notes || '—'}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-stone-500">
                        {tx.performedBy?.name ? (
                          <span className="inline-flex items-center gap-1">
                            <User size={12} /> {tx.performedBy.name}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">System (Automated)</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-3 text-xs text-stone-500">
          <div>
            Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total)
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
