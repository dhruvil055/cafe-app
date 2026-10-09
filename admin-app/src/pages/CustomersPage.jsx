import { useEffect, useState } from 'react';
import {
  Users, UserCheck, UserX, UserPlus, ShieldAlert,
  Search, Download, Eye, Ban, CheckCircle2, ChevronLeft,
  ChevronRight, X, Phone, Mail, Calendar, ShoppingBag,
  ArrowUpDown, Loader2, RefreshCw, Sparkles, Tag, Check, AlertCircle,
  MessageSquare, Bell, Smartphone, DollarSign, Clock, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import { formatMoney } from '../utils/money';
import PageHeader from '../components/common/PageHeader';
import StatusPill from '../components/common/StatusPill';
import EmptyState from '../components/common/EmptyState';
import Drawer from '../components/common/Drawer';

export default function CustomersPage() {
  const tenant = useTenant();
  const currency = tenant?.currency || tenant?.settings?.currency || '₹';

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
  const [errorMessage, setErrorMessage] = useState('');

  // Filters & Pagination state
  const [search, setSearch] = useState('');
  const [consentFilter, setConsentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Profile Drawer state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
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

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/customers/stats');
      setStats(data.stats || {});
    } catch (err) {
      // Non-critical
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch Customers List with Timeout (Fixes Bug #7)
  const fetchCustomers = async () => {
    setLoading(true);
    setErrorMessage('');

    // Timeout safety
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (consentFilter) params.set('marketingConsent', consentFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (frequencyFilter) params.set('frequency', frequencyFilter);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('page', page.toString());
      params.set('limit', '15');

      const { data } = await api.get(`/customers?${params.toString()}`, {
        signal: controller.signal
      });

      setCustomers(data.customers || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        setErrorMessage('Request timed out while loading customers. Check your connection or click Retry.');
      } else {
        setErrorMessage(err.message || 'Unable to load customer database.');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [search, consentFilter, statusFilter, frequencyFilter, sortBy, sortOrder, page]);

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

  const handleToggleBlock = async (customer) => {
    const newStatus = customer.status === 'blocked' ? 'active' : 'blocked';
    try {
      const { data } = await api.put(`/customers/${customer._id}`, { status: newStatus });
      setCustomers((prev) => prev.map((c) => (c._id === customer._id ? data.customer : c)));
      if (selectedCustomer?._id === customer._id) {
        setSelectedCustomer(data.customer);
      }
      toast.success(`Customer marked as ${newStatus}`);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  };

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
      toast.success(data.message || 'Marketing consent updated');
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Failed to update consent');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedCustomer) return;
    setSavingNotes(true);
    try {
      const { data } = await api.put(`/customers/${selectedCustomer._id}`, { notes: editingNotes });
      setSelectedCustomer(data.customer);
      setCustomers((prev) => prev.map((c) => (c._id === selectedCustomer._id ? data.customer : c)));
      toast.success('Internal notes saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  // Determine loyalty tag
  const getCustomerTag = (customer) => {
    const orders = customer.totalOrders || 0;
    const spent = customer.totalSpent || 0;
    if (orders >= 5 || spent >= 2500) {
      return { label: 'VIP Guest', bg: 'bg-amber-100 text-amber-900 border-amber-200' };
    }
    if (orders >= 2) {
      return { label: 'Repeat Regular', bg: 'bg-purple-100 text-purple-900 border-purple-200' };
    }
    return { label: 'New Guest', bg: 'bg-stone-100 text-stone-700 border-stone-200' };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Customer CRM & Profiles"
        subtitle="Guest profiles, visit frequencies, lifetime spending, and WhatsApp/SMS opt-in consent."
        breadcrumbs={[
          { label: 'Growth', to: '/customers' },
          { label: 'Customers' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncOrders}
              disabled={syncingOrders}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs transition"
              title="Sync historical table orders into customer CRM"
            >
              <RefreshCw size={13} className={syncingOrders ? 'animate-spin' : ''} />
              <span>Sync Orders to CRM</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      {/* CRM Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Total Guests</span>
          <div className="mt-1 text-2xl font-bold font-display text-espresso-950">
            {stats.totalCustomers || totalCount}
          </div>
          <p className="text-[10px] text-stone-400 mt-0.5">Identified via QR ordering</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Opted-in for Promo</span>
          <div className="mt-1 text-2xl font-bold font-display text-emerald-900">
            {stats.marketingOptedIn || 0}
          </div>
          <p className="text-[10px] text-emerald-700 mt-0.5">Consented for WhatsApp & SMS</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Opted-out</span>
          <div className="mt-1 text-2xl font-bold font-display text-stone-700">
            {stats.marketingOptedOut || 0}
          </div>
          <p className="text-[10px] text-stone-400 mt-0.5">Transactional orders only</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">New This Month</span>
          <div className="mt-1 text-2xl font-bold font-display text-amber-900">
            {stats.newThisMonth || 0}
          </div>
          <p className="text-[10px] text-amber-700 mt-0.5">First visit in last 30 days</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, phone (+91), email..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 py-2 pl-9.5 pr-8 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Filter Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={consentFilter}
              onChange={(e) => { setConsentFilter(e.target.value); setPage(1); }}
              className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 focus:border-amber-500 focus:outline-none"
            >
              <option value="">All Consent States</option>
              <option value="true">Marketing Opted-In</option>
              <option value="false">Opted-Out</option>
            </select>

            <select
              value={frequencyFilter}
              onChange={(e) => { setFrequencyFilter(e.target.value); setPage(1); }}
              className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 focus:border-amber-500 focus:outline-none"
            >
              <option value="">All Frequencies</option>
              <option value="frequent">VIP (3+ Visits)</option>
              <option value="repeat">Repeat (2 Visits)</option>
              <option value="one-time">First Time (1 Visit)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error state with Retry button (Fixes Bug #7) */}
      {errorMessage ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-8 text-center space-y-3">
          <AlertCircle size={32} className="mx-auto text-rose-500" />
          <h3 className="font-display text-base font-bold text-rose-950">Failed to Load Customers</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{errorMessage}</p>
          <button
            type="button"
            onClick={fetchCustomers}
            className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw size={13} /> Retry Loading
          </button>
        </div>
      ) : loading ? (
        /* Skeletons instead of stuck text */
        <div className="rounded-3xl border border-stone-200/90 bg-white p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded-2xl bg-stone-100 border border-stone-200/50" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description={search ? `No guests match "${search}".` : "Guests who order via table QR or settle at counter will automatically populate here."}
          actionLabel="Sync Historical Orders"
          onAction={handleSyncOrders}
        />
      ) : (
        /* Table with Avatar Rows, Loyalty Tags, and Consent Badges */
        <div className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 bg-stone-50/70 font-bold uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="py-3 px-4">Guest</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Loyalty Tier</th>
                  <th className="py-3 px-4 text-center">Visits</th>
                  <th className="py-3 px-4 text-right">Lifetime Spend</th>
                  <th className="py-3 px-4">Consent</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {customers.map((customer) => {
                  const tag = getCustomerTag(customer);
                  const initialLetter = (customer.name || customer.phone || 'G').charAt(0).toUpperCase();

                  return (
                    <tr
                      key={customer._id}
                      onClick={() => openProfile(customer)}
                      className="cursor-pointer hover:bg-stone-50/60 transition"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-espresso-950 font-display text-xs font-bold text-white shadow-2xs">
                            {initialLetter}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-stone-900 block truncate">
                              {customer.name || 'Guest'}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              Joined {new Date(customer.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone / Email */}
                      <td className="py-3 px-4 font-mono text-stone-700">
                        {customer.phone || customer.email || '—'}
                      </td>

                      {/* Loyalty Tag */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${tag.bg}`}>
                          {tag.label}
                        </span>
                      </td>

                      {/* Visits */}
                      <td className="py-3 px-4 text-center font-bold text-stone-800">
                        {customer.totalOrders || 1}
                      </td>

                      {/* Lifetime Spend */}
                      <td className="py-3 px-4 text-right font-bold text-espresso-950 font-mono tabular-nums">
                        {formatMoney(customer.totalSpent || 0, currency)}
                      </td>

                      {/* Marketing Consent */}
                      <td className="py-3 px-4">
                        {customer.marketingConsent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={10} /> Opted-in
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
                            Opted-out
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openProfile(customer)}
                          className="rounded-lg p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition"
                          title="View Profile Drawer"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50/50 p-3 text-xs text-stone-500">
              <span>Showing {customers.length} of {totalCount} profiles</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-semibold disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="font-bold text-stone-800">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CUSTOMER PROFILE DRAWER */}
      <Drawer
        isOpen={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer?.name || 'Guest Profile'}
        subtitle={selectedCustomer?.phone || selectedCustomer?.email || 'Walk-in'}
        width="max-w-md"
        footer={
          selectedCustomer && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleToggleConsent(selectedCustomer)}
                className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
              >
                {selectedCustomer.marketingConsent ? 'Revoke Consent' : 'Opt-in Customer'}
              </button>
              <button
                type="button"
                onClick={() => handleToggleBlock(selectedCustomer)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  selectedCustomer.status === 'blocked'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {selectedCustomer.status === 'blocked' ? 'Unblock' : 'Block Guest'}
              </button>
            </div>
          )
        }
      >
        {selectedCustomer && (
          <div className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Lifetime Spend</span>
                <div className="mt-1 font-mono text-base font-bold text-espresso-950">
                  {formatMoney(selectedCustomer.totalSpent || 0, currency)}
                </div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total Visits</span>
                <div className="mt-1 font-mono text-base font-bold text-espresso-950">
                  {selectedCustomer.totalOrders || 1} Orders
                </div>
              </div>
            </div>

            {/* Internal Barista Notes */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-700">
                Staff & Barista Preferences Note
              </label>
              <textarea
                rows={3}
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="e.g. Likes extra hot oat flat white, allergic to walnuts, preferred Table 4..."
                className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="btn-primary rounded-xl px-3 py-1.5 text-xs font-semibold shadow-xs"
              >
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>

            {/* Recent Orders List in Profile */}
            <div className="space-y-2.5 pt-2 border-t border-stone-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Order History
              </h4>
              {profileLoading ? (
                <div className="py-6 text-center text-xs text-stone-400">
                  <Loader2 size={18} className="animate-spin mx-auto text-amber-600 mb-1" />
                  Loading order history...
                </div>
              ) : profileData?.orders?.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {profileData.orders.map((ord) => (
                    <div key={ord._id} className="rounded-xl border border-stone-200 p-3 bg-stone-50/40 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900">{ord.orderNumber}</span>
                        <span className="font-mono font-bold text-stone-900">{formatMoney(ord.total, currency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-stone-400">
                        <span>Table {ord.tableNumber}</span>
                        <span>{new Date(ord.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400 italic">No past detailed orders recorded.</p>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
