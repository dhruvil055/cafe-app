import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Users, UserCheck, UserX, UserPlus, ShieldAlert,
  Search, Download, Eye, Ban, CheckCircle2, ChevronLeft,
  ChevronRight, X, Phone, Mail, Calendar, ShoppingBag,
  ArrowUpDown, Loader2, RefreshCw, Sparkles, Tag, Check, AlertCircle,
  MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    marketingOptedIn: 0,
    marketingOptedOut: 0,
    activeCustomers: 0,
    newThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters & Pagination state
  const [search, setSearch] = useState('');
  const [consentFilter, setConsentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [minSpentFilter, setMinSpentFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Profile modal state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);

  // Edit notes/tags state
  const [editingNotes, setEditingNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [syncingOrders, setSyncingOrders] = useState(false);

  // Sync historical orders into customer CRM profiles
  const handleSyncOrders = async () => {
    setSyncingOrders(true);
    try {
      const { data } = await api.post('/marketing/sync-orders');
      toast.success(`Synced ${data.syncedOrders || 0} orders! Total customers: ${data.totalCustomers || 0}`);
      fetchStats();
      fetchCustomers();
    } catch (err) {
      toast.error(err.message || 'Failed to sync orders');
    } finally {
      setSyncingOrders(false);
    }
  };

  // Fetch CRM Statistics
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/customers/stats');
      setStats(data.stats || {});
    } catch (err) {
      console.error('Failed to load CRM stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch Customers List
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (consentFilter) params.set('marketingConsent', consentFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (frequencyFilter) params.set('frequency', frequencyFilter);
      if (minSpentFilter) params.set('minSpent', minSpentFilter);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('page', page.toString());
      params.set('limit', '15');

      const { data } = await api.get(`/customers?${params.toString()}`);
      setCustomers(data.customers || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      toast.error(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [search, consentFilter, statusFilter, frequencyFilter, minSpentFilter, sortBy, sortOrder, page]);

  // Open Customer Profile Drawer
  const openProfile = async (customer) => {
    setSelectedCustomer(customer);
    setProfileLoading(true);
    setEditingNotes(customer.notes || '');
    try {
      const { data } = await api.get(`/customers/${customer._id}`);
      setProfileData(data);
      setEditingNotes(data.customer?.notes || '');
    } catch (err) {
      toast.error(err.message || 'Failed to load customer profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      toast.loading('Preparing CSV export...', { id: 'csv-export' });
      const response = await api.get('/customers/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `brewhaus-customers-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Customer CSV downloaded!', { id: 'csv-export' });
    } catch (err) {
      toast.error('Failed to export CSV', { id: 'csv-export' });
    }
  };

  // Toggle Block status
  const handleToggleBlock = async (customer) => {
    const newStatus = customer.status === 'blocked' ? 'active' : 'blocked';
    try {
      const { data } = await api.put(`/customers/${customer._id}`, { status: newStatus });
      setCustomers((prev) => prev.map((c) => (c._id === customer._id ? data.customer : c)));
      if (selectedCustomer?._id === customer._id) {
        setSelectedCustomer(data.customer);
      }
      toast.success(`Customer ${newStatus === 'blocked' ? 'blocked' : 'unblocked'}`);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Toggle Marketing Consent
  const handleToggleConsent = async (customer) => {
    try {
      const endpoint = customer.marketingConsent
        ? `/customers/${customer._id}/unsubscribe`
        : `/customers/${customer._id}/subscribe`;

      const { data } = await api.post(endpoint);
      setCustomers((prev) => prev.map((c) => (c._id === customer._id ? data.customer : c)));
      if (selectedCustomer?._id === customer._id) {
        setSelectedCustomer(data.customer);
      }
      toast.success(data.message || 'Consent updated');
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Failed to update consent');
    }
  };

  // Save notes
  const handleSaveNotes = async () => {
    if (!selectedCustomer) return;
    setSavingNotes(true);
    try {
      const { data } = await api.put(`/customers/${selectedCustomer._id}`, { notes: editingNotes });
      setSelectedCustomer(data.customer);
      setCustomers((prev) => prev.map((c) => (c._id === selectedCustomer._id ? data.customer : c)));
      toast.success('Notes saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const statCards = [
    { label: 'Total Customers', value: stats.totalCustomers, icon: Users, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Marketing Opt-In', value: stats.marketingOptedIn, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Marketing Opt-Out', value: stats.marketingOptedOut, icon: UserX, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Active Customers', value: stats.activeCustomers, icon: CheckCircle2, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'New This Month', value: stats.newThisMonth, icon: UserPlus, color: 'text-brew-600', bg: 'bg-brew-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso-900">Customer CRM</h1>
          <p className="text-xs text-stone-500">Manage café customer profiles, order history, and marketing consent</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSyncOrders}
            disabled={syncingOrders}
            className="inline-flex items-center gap-2 rounded-xl border border-brew-200 bg-brew-50 px-3.5 py-2 text-xs font-semibold text-brew-800 shadow-soft transition hover:bg-brew-100 disabled:opacity-50"
            title="Sync all historical orders to customer CRM profiles"
          >
            <RefreshCw size={14} className={syncingOrders ? 'animate-spin' : ''} />
            <span>{syncingOrders ? 'Syncing...' : 'Sync Orders'}</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-soft transition hover:bg-stone-50 hover:text-espresso-900"
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            onClick={() => { fetchStats(); fetchCustomers(); }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-soft hover:bg-stone-50"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading || statsLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* CRM Statistics Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">{card.label}</span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${card.bg} ${card.color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-stone-900">
                {statsLoading ? '—' : Number(card.value || 0).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search input */}
          <div className="relative lg:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by customer name, mobile (+91...), email..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 py-2 pl-9 pr-3 text-xs focus:border-espresso-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Marketing Consent Filter */}
          <div>
            <select
              value={consentFilter}
              onChange={(e) => { setConsentFilter(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-stone-200 bg-white py-2 px-3 text-xs text-stone-700 focus:border-espresso-500 focus:outline-none"
            >
              <option value="">Consent: All</option>
              <option value="true">✓ Marketing Opted-In</option>
              <option value="false">✕ Marketing Opted-Out</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-stone-200 bg-white py-2 px-3 text-xs text-stone-700 focus:border-espresso-500 focus:outline-none"
            >
              <option value="">Status: All</option>
              <option value="active">Active</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        {/* Secondary filters row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs text-stone-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-500">Filters:</span>
            {/* Frequency */}
            <select
              value={frequencyFilter}
              onChange={(e) => { setFrequencyFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600"
            >
              <option value="">Orders: All</option>
              <option value="1">1 Order (New)</option>
              <option value="2-4">2 - 4 Orders (Returning)</option>
              <option value="5+">5+ Orders (Frequent)</option>
            </select>

            {/* Spending */}
            <select
              value={minSpentFilter}
              onChange={(e) => { setMinSpentFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600"
            >
              <option value="">Spending: All</option>
              <option value="1000">&gt; ₹1,000</option>
              <option value="3000">&gt; ₹3,000</option>
              <option value="5000">&gt; ₹5,000 (VIP)</option>
            </select>

            {(search || consentFilter || statusFilter || frequencyFilter || minSpentFilter) && (
              <button
                onClick={() => {
                  setSearch('');
                  setConsentFilter('');
                  setStatusFilter('');
                  setFrequencyFilter('');
                  setMinSpentFilter('');
                  setPage(1);
                }}
                className="text-brew-600 hover:text-brew-800 underline ml-1"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-stone-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700"
            >
              <option value="createdAt">Date Added</option>
              <option value="totalSpent">Total Spending</option>
              <option value="totalOrders">Total Orders</option>
              <option value="lastOrderAt">Last Order Date</option>
              <option value="name">Customer Name</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 rounded-lg border border-stone-200 hover:bg-stone-50"
              title="Toggle sort direction"
            >
              <ArrowUpDown size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Customer Table */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-200 bg-stone-50/80 font-semibold uppercase tracking-[0.08em] text-stone-500">
              <tr>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Mobile</th>
                <th className="px-4 py-3.5 text-center">Orders</th>
                <th className="px-4 py-3.5 text-right">Total Spent</th>
                <th className="px-4 py-3.5">First Order</th>
                <th className="px-4 py-3.5">Last Order</th>
                <th className="px-4 py-3.5 text-center">Marketing Consent</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-stone-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-16 text-center text-stone-400">
                    No customers found matching the search criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const initials = (c.name || 'G').slice(0, 2).toUpperCase();
                  return (
                    <tr key={c._id} className="transition hover:bg-stone-50/60">
                      {/* Customer Name & Email */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-espresso-100 font-semibold text-espresso-800 text-[11px]">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-stone-900">{c.name || 'Guest Customer'}</div>
                            {c.email && <div className="text-[10px] text-stone-400 truncate max-w-[150px]">{c.email}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Mobile */}
                      <td className="px-4 py-3 font-mono font-medium text-stone-700">
                        {c.phone}
                      </td>

                      {/* Orders */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-stone-100 px-2 font-bold text-stone-800">
                          {c.totalOrders || 0}
                        </span>
                      </td>

                      {/* Total Spent */}
                      <td className="px-4 py-3 text-right font-semibold text-stone-900">
                        ₹{Number(c.totalSpent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* First Order */}
                      <td className="px-4 py-3 text-stone-500">
                        {c.firstOrderAt ? new Date(c.firstOrderAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>

                      {/* Last Order */}
                      <td className="px-4 py-3 text-stone-500">
                        {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>

                      {/* Marketing Consent */}
                      <td className="px-4 py-3 text-center">
                        {c.marketingConsent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                            <Check size={11} /> Opted-In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-600 border border-stone-200">
                            <X size={11} /> Opted-Out
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            c.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : c.status === 'blocked'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      {/* Row Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={`https://api.whatsapp.com/send?phone=${c.phone ? c.phone.replace(/[^\d]/g, '') : ''}&text=${encodeURIComponent(`Hello ${c.name || 'Friend'} 👋 Greetings from Brewhaus Café!`)}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open in WhatsApp"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 transition"
                          >
                            <MessageSquare size={13} />
                          </a>
                          <button
                            onClick={() => openProfile(c)}
                            title="View Customer Profile"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-espresso-900"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleConsent(c)}
                            title={c.marketingConsent ? 'Revoke Consent (Unsubscribe)' : 'Opt-In to Marketing'}
                            className={`inline-flex h-7 px-2 items-center justify-center rounded-lg border text-[11px] font-medium transition ${
                              c.marketingConsent
                                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {c.marketingConsent ? 'Opt-Out' : 'Opt-In'}
                          </button>
                          <button
                            onClick={() => handleToggleBlock(c)}
                            title={c.status === 'blocked' ? 'Unblock Customer' : 'Block Customer'}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${
                              c.status === 'blocked'
                                ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                : 'border-stone-200 text-stone-400 hover:text-red-600 hover:border-red-200'
                            }`}
                          >
                            <Ban size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-stone-200 bg-stone-50/50 px-4 py-3 text-xs text-stone-500">
          <div>
            Showing <span className="font-semibold text-stone-700">{customers.length}</span> of{' '}
            <span className="font-semibold text-stone-700">{totalCount}</span> customers
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="px-2 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Customer Profile Slide-over Drawer / Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCustomer(null)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />

            {/* Slide-over Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brew-500 font-display text-lg font-bold text-white shadow-sm">
                    {(selectedCustomer.name || 'G').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-espresso-900">{selectedCustomer.name || 'Guest Customer'}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mt-1">
                      <span className="flex items-center gap-1 font-mono font-medium"><Phone size={12} /> {selectedCustomer.phone}</span>
                      {selectedCustomer.email && <span className="flex items-center gap-1"><Mail size={12} /> {selectedCustomer.email}</span>}
                      <a
                        href={`https://api.whatsapp.com/send?phone=${selectedCustomer.phone ? selectedCustomer.phone.replace(/[^\d]/g, '') : ''}&text=${encodeURIComponent(`Hello ${selectedCustomer.name || 'Friend'} 👋 Greetings from Brewhaus Café!`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition"
                      >
                        <MessageSquare size={12} /> WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {profileLoading ? (
                  <div className="flex min-h-[300px] items-center justify-center text-stone-400">
                    <Loader2 size={28} className="animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Status & Consent Highlights */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      {/* Marketing Status */}
                      <div className="rounded-2xl border border-stone-200 p-4 bg-stone-50/30">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400 block mb-1">Marketing Status</span>
                        {selectedCustomer.marketingConsent ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                            <Check size={14} className="text-emerald-600" /> Opted-In
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-stone-600 font-semibold text-xs">
                            <X size={14} className="text-stone-400" /> Opted-Out
                          </div>
                        )}
                        <span className="text-[10px] text-stone-400 mt-1 block">
                          {selectedCustomer.marketingConsentAt
                            ? `Consented on ${new Date(selectedCustomer.marketingConsentAt).toLocaleDateString('en-IN')}`
                            : selectedCustomer.marketingOptOutAt
                            ? `Opted out on ${new Date(selectedCustomer.marketingOptOutAt).toLocaleDateString('en-IN')}`
                            : 'No consent record'}
                        </span>
                      </div>

                      {/* Account Status */}
                      <div className="rounded-2xl border border-stone-200 p-4 bg-stone-50/30">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400 block mb-1">Account Status</span>
                        <span className={`inline-block font-semibold text-xs capitalize ${selectedCustomer.status === 'active' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {selectedCustomer.status}
                        </span>
                        <span className="text-[10px] text-stone-400 mt-1 block">
                          Member since {new Date(selectedCustomer.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>

                      {/* Average Order Value */}
                      <div className="rounded-2xl border border-stone-200 p-4 bg-stone-50/30">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400 block mb-1">Avg Order Value</span>
                        <div className="font-bold text-stone-900 text-sm">
                          ₹{profileData?.metrics?.averageOrderValue || 0}
                        </div>
                        <span className="text-[10px] text-stone-400 mt-1 block">
                          Across {selectedCustomer.totalOrders || 0} orders
                        </span>
                      </div>
                    </div>

                    {/* Spend Metrics */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-espresso-900 text-white p-4">
                        <span className="text-[11px] text-espresso-200 block">Lifetime Spending</span>
                        <span className="text-2xl font-bold font-display mt-1 block">
                          ₹{Number(selectedCustomer.totalSpent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="rounded-2xl bg-brew-50 border border-brew-100 p-4 text-brew-900">
                        <span className="text-[11px] text-brew-600 block font-medium">Order Frequency</span>
                        <span className="text-2xl font-bold font-display mt-1 block">
                          {selectedCustomer.totalOrders || 0} Orders
                        </span>
                      </div>
                    </div>

                    {/* Order History */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-base font-bold text-espresso-900 flex items-center gap-2">
                          <ShoppingBag size={16} /> Order History
                        </h3>
                        <span className="text-xs text-stone-400">{profileData?.orders?.length || 0} orders found</span>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-stone-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold">
                            <tr>
                              <th className="px-3 py-2">Order #</th>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Items</th>
                              <th className="px-3 py-2 text-right">Amount</th>
                              <th className="px-3 py-2 text-center">Payment</th>
                              <th className="px-3 py-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {!profileData?.orders || profileData.orders.length === 0 ? (
                              <tr>
                                <td colSpan="6" className="py-6 text-center text-stone-400">
                                  No previous orders recorded for this customer.
                                </td>
                              </tr>
                            ) : (
                              profileData.orders.map((ord) => (
                                <tr key={ord._id} className="hover:bg-stone-50/50">
                                  <td className="px-3 py-2 font-mono font-semibold text-stone-800">{ord.orderNumber}</td>
                                  <td className="px-3 py-2 text-stone-500">
                                    {new Date(ord.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                  </td>
                                  <td className="px-3 py-2 text-stone-600">
                                    {ord.items?.length || 0} items
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold text-stone-800">
                                    ₹{ord.total}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${ord.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
                                      {ord.paymentStatus}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-stone-100 text-stone-700">
                                      {ord.orderStatus}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Marketing Campaign Deliveries */}
                    <div className="space-y-3">
                      <h3 className="font-display text-base font-bold text-espresso-900 flex items-center gap-2">
                        <Sparkles size={16} /> Campaign History
                      </h3>
                      <div className="rounded-2xl border border-stone-200 overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold">
                            <tr>
                              <th className="px-3 py-2">Campaign</th>
                              <th className="px-3 py-2">Channel</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {!profileData?.deliveries || profileData.deliveries.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="py-6 text-center text-stone-400">
                                  No promotional campaigns sent to this customer yet.
                                </td>
                              </tr>
                            ) : (
                              profileData.deliveries.map((del) => (
                                <tr key={del._id}>
                                  <td className="px-3 py-2 font-medium text-stone-800">{del.campaignId?.name || 'Campaign'}</td>
                                  <td className="px-3 py-2 uppercase text-[10px] text-stone-500">{del.channel}</td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${del.status === 'delivered' ? 'bg-emerald-50 text-emerald-700' : del.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-stone-100 text-stone-600'}`}>
                                      {del.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right text-stone-400">
                                    {new Date(del.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Admin Notes & Tags */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-stone-700 block">Customer Notes</label>
                      <textarea
                        value={editingNotes}
                        onChange={(e) => setEditingNotes(e.target.value)}
                        placeholder="Add private staff notes about preferred orders, seating preferences, allergies..."
                        className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-espresso-500 focus:outline-none"
                        rows="3"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={handleSaveNotes}
                          disabled={savingNotes}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          {savingNotes ? 'Saving...' : 'Save Notes'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="border-t border-stone-200 p-4 bg-stone-50 flex items-center justify-between">
                <button
                  onClick={() => handleToggleBlock(selectedCustomer)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    selectedCustomer.status === 'blocked'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  <Ban size={14} /> {selectedCustomer.status === 'blocked' ? 'Unblock Customer' : 'Block Customer'}
                </button>

                <button
                  onClick={() => handleToggleConsent(selectedCustomer)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    selectedCustomer.marketingConsent
                      ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  {selectedCustomer.marketingConsent ? 'Unsubscribe from Marketing' : 'Opt-In to Marketing'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
