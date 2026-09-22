import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, Send, Users, CheckCircle2, XCircle, Search, RefreshCw,
  Eye, X, Loader2, Plus, FlaskConical, Globe, MessageSquare, Phone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

// Mask phone numbers in the admin UI — identification without exposure.
const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '—';
  return `••••${digits.slice(-4)}`;
};

const statusTone = (status) => {
  switch (String(status)) {
    case 'sent':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'sending':
    case 'processing':
      return 'bg-sky-50 text-sky-700 border border-sky-200';
    case 'scheduled':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'partially_failed':
    case 'partial':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'failed':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    default:
      return 'bg-stone-100 text-stone-600 border border-stone-200';
  }
};

export default function NotificationsPage() {
  // ── Stats ──
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── History ──
  const [campaigns, setCampaigns] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Composer ──
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [pageUrl, setPageUrl] = useState('/offers');
  const [audienceType, setAudienceType] = useState('all'); // 'all' | 'selected'
  const [eligibleCount, setEligibleCount] = useState(0);
  const [countLoading, setCountLoading] = useState(false);

  // ── Customer selection ──
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState([]); // selected customer objects

  // ── Confirm + send ──
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  // ── Test mode ──
  const [testCustomer, setTestCustomer] = useState(null);
  const [testing, setTesting] = useState(false);

  const recipients = audienceType === 'all' ? eligibleCount : picked.filter((c) => (c.activeDevicesCount || 0) > 0).length;

  // ── Loaders ──
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/notifications/stats');
      setStats(data);
    } catch {
      // Fallback to legacy analytics shape
      try {
        const { data } = await api.get('/notifications/analytics');
        const s = data.summary || {};
        setStats({
          totalNotifications: s.campaignsSent || 0,
          totalCustomers: s.totalCustomers || 0,
          webPushSubscribers: s.pushEnabled || 0,
          notificationsSent: s.notificationsSent || 0,
          successfulDeliveries: (s.notificationsSent || 0) - (s.notificationsFailed || 0),
          failedDeliveries: s.notificationsFailed || 0,
          activeSubscriptions: s.activeSubscriptions || 0,
          inactiveSubscriptions: 0,
        });
      } catch (err) {
        console.error('Stats failed:', err.message);
      }
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/notifications?limit=15');
      setCampaigns(data.campaigns || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load notification history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchEligibleCount = async () => {
    setCountLoading(true);
    try {
      const { data } = await api.get('/notifications/audience/count?audienceType=all_enabled');
      setEligibleCount(data.count || 0);
    } catch {
      setEligibleCount(0);
    } finally {
      setCountLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchHistory();
    fetchEligibleCount();
  }, []);

  // Debounced customer search (only customers, with Web Push status attached)
  useEffect(() => {
    if (!showComposer || audienceType !== 'selected') return;
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/customers?search=${encodeURIComponent(search.trim())}&limit=10`);
        setResults(data.customers || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [search, showComposer, audienceType]);

  const togglePick = (customer) => {
    setPicked((prev) => {
      if (prev.some((c) => c._id === customer._id)) return prev.filter((c) => c._id !== customer._id);
      return [...prev, customer];
    });
  };

  const openDetails = async (campaign) => {
    setSelected(campaign);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/notifications/${campaign._id}`);
      setDeliveries(data.deliveries || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load notification details');
      setDeliveries([]);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Send flow (always behind confirmation) ──
  const handleReview = () => {
    if (!title.trim()) return toast.error('Please enter a notification title.');
    if (!message.trim()) return toast.error('Please enter a notification message.');
    if (audienceType === 'selected' && picked.length === 0) {
      return toast.error('Select at least one customer, or switch to All Customers.');
    }
    if (recipients === 0) {
      return toast.error('No eligible subscribers — selected customers have no active Web Push devices.');
    }
    setShowConfirm(true);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        url: pageUrl.trim() || '/offers',
        channel: 'web',
        audienceType,
        targetCustomers: audienceType === 'selected' ? picked.map((c) => c._id) : [],
      };
      const { data } = await api.post('/notifications/send', payload);
      toast.success(data.message || 'Notification campaign started.');
      setShowConfirm(false);
      setShowComposer(false);
      setTitle('');
      setMessage('');
      setPageUrl('/offers');
      setPicked([]);
      setSearch('');
      fetchHistory();
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  };

  const handleTest = async () => {
    if (!testCustomer) return toast.error('Select a test customer first.');
    if (!title.trim() || !message.trim()) {
      return toast.error('Enter a title and message to test with.');
    }
    setTesting(true);
    try {
      await api.post('/notifications/test', {
        customerId: testCustomer._id,
        title: title.trim() || 'Test notification',
        message: message.trim(),
        url: pageUrl.trim() || '/offers',
      });
      toast.success('Test notification sent successfully.');
    } catch (err) {
      toast.error(err.message || 'Failed to send test notification.');
    } finally {
      setTesting(false);
    }
  };

  const statCards = useMemo(() => ([
    { label: 'Web Push Subscribers', value: stats?.webPushSubscribers },
    { label: 'Notifications Sent', value: stats?.notificationsSent },
    { label: 'Successful', value: stats?.successfulDeliveries },
    { label: 'Failed', value: stats?.failedDeliveries },
    { label: 'Active Subscriptions', value: stats?.activeSubscriptions },
    { label: 'Inactive Subscriptions', value: stats?.inactiveSubscriptions },
    { label: 'Total Customers', value: stats?.totalCustomers },
    { label: 'Total Notifications', value: stats?.totalNotifications },
  ]), [stats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso-900">Website Notifications</h1>
          <p className="text-xs text-stone-500">Compose once, send to customer browsers via Web Push — no paid SMS service needed</p>
        </div>
        <button
          onClick={() => setShowComposer((v) => !v)}
          className="btn-primary text-sm py-2.5 px-5 shadow-soft inline-flex items-center gap-2 self-start"
        >
          <Plus size={16} /> Create Notification
        </button>
      </div>

      {/* Statistics */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">{card.label}</div>
            <div className="mt-1.5 text-2xl font-bold text-stone-900">
              {statsLoading ? '—' : Number(card.value || 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <AnimatePresence>
        {showComposer && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-soft space-y-5"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="font-display text-lg font-bold text-espresso-900">Compose Notification</h2>
              <button onClick={() => setShowComposer(false)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Close composer">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">Title * <span className="font-normal text-stone-400">({title.length}/120)</span></label>
                <input
                  type="text"
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. New Weekend Offer"
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:border-espresso-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">Page to open on click</label>
                <input
                  type="text"
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder="/offers"
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:border-espresso-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">Message * <span className="font-normal text-stone-400">({message.length}/500)</span></label>
              <textarea
                value={message}
                maxLength={500}
                rows={3}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Check out our latest offers at Brewhaus Café."
                className="w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:border-espresso-500 focus:outline-none"
              />
            </div>

            {/* Audience */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-stone-700 block">Audience *</label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAudienceType('all')}
                  className={`p-3.5 rounded-xl border-2 text-left transition ${audienceType === 'all' ? 'border-espresso-900 bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm text-espresso-900">
                    <Users size={15} /> All Customers
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    {countLoading ? 'Counting eligible devices…' : `${eligibleCount.toLocaleString()} device(s) with active Web Push can receive this`}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceType('selected')}
                  className={`p-3.5 rounded-xl border-2 text-left transition ${audienceType === 'selected' ? 'border-espresso-900 bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm text-espresso-900">
                    <Search size={15} /> Selected Customers
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    {picked.length === 0 ? 'Search and pick customers below' : `${picked.length} selected • ${recipients} with active Web Push`}
                  </div>
                </button>
              </div>

              {audienceType === 'selected' && (
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3.5 space-y-2.5">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search customers by name (min 2 characters)…"
                      className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-espresso-500 focus:outline-none"
                    />
                  </div>
                  {searching && <div className="text-[11px] text-stone-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Searching…</div>}
                  {!searching && results.length > 0 && (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {results.map((c) => {
                        const isPicked = picked.some((p) => p._id === c._id);
                        const enabled = (c.activeDevicesCount || 0) > 0;
                        return (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => togglePick(c)}
                            className={`w-full flex items-center justify-between gap-3 rounded-xl border p-2.5 text-left text-xs transition ${isPicked ? 'border-espresso-900 bg-white' : 'border-stone-200 bg-white hover:border-stone-300'}`}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-stone-900 truncate">{c.name || 'Guest'} <span className="font-normal text-stone-400">• {maskPhone(c.phone)}</span></div>
                              <div className="text-[10px] text-stone-400 truncate">{c.email || 'No email'}</div>
                            </div>
                            <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-100 text-stone-500 border border-stone-200'}`}>
                              {enabled ? <><CheckCircle2 size={11} /> Web Push: Enabled</> : <><XCircle size={11} /> Web Push: Disabled</>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {picked.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {picked.map((c) => (
                        <span key={c._id} className="inline-flex items-center gap-1.5 rounded-full bg-espresso-900 px-2.5 py-1 text-[11px] font-medium text-white">
                          {c.name || maskPhone(c.phone)}
                          <button type="button" onClick={() => togglePick(c)} aria-label="Remove"><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Channel */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 block">Channel *</label>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="flex items-center gap-2.5 rounded-xl border-2 border-espresso-900 bg-stone-50 p-3 text-sm">
                  <input type="checkbox" checked readOnly className="accent-espresso-900 h-4 w-4" />
                  <Globe size={16} className="text-espresso-900" />
                  <span className="font-semibold text-espresso-900">Website Notification</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-sm opacity-60" title="Coming soon">
                  <input type="checkbox" disabled className="h-4 w-4" />
                  <MessageSquare size={16} className="text-stone-400" />
                  <span className="text-stone-500">SMS <span className="text-[10px] font-bold uppercase bg-stone-200 rounded px-1.5 py-0.5 ml-1">Coming Soon</span></span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-sm opacity-60" title="Coming soon">
                  <input type="checkbox" disabled className="h-4 w-4" />
                  <Phone size={16} className="text-stone-400" />
                  <span className="text-stone-500">WhatsApp <span className="text-[10px] font-bold uppercase bg-stone-200 rounded px-1.5 py-0.5 ml-1">Coming Soon</span></span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button onClick={() => setShowComposer(false)} className="btn-secondary text-sm py-2 px-5">Cancel</button>
              <button onClick={handleReview} className="btn-primary text-sm py-2 px-5 inline-flex items-center gap-2">
                <Send size={15} /> Send Notification
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test mode */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={16} className="text-brew-600" />
          <h2 className="font-display text-base font-bold text-espresso-900">Send Test Notification</h2>
        </div>
        <p className="text-xs text-stone-500 mb-3">Verify delivery on one device before launching a campaign. Uses the title/message above.</p>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm bg-stone-50/50">
            {testCustomer ? (
              <span className="font-medium text-stone-800">{testCustomer.name || 'Guest'} <span className="text-stone-400">• {maskPhone(testCustomer.phone)} • {(testCustomer.activeDevicesCount || 0)} device(s)</span></span>
            ) : (
              <span className="text-stone-400 text-xs">Pick a test customer from Selected Customers search, or</span>
            )}
          </div>
          <button
            onClick={() => {
              if (picked.length > 0) {
                setTestCustomer(picked[0]);
                toast.success(`Test target: ${picked[0].name || 'customer'}`);
              } else {
                toast.error('Select a customer in the composer first (Audience → Selected Customers).');
              }
            }}
            className="btn-secondary text-xs py-2 px-4"
          >
            Use first selected
          </button>
          <button onClick={handleTest} disabled={testing || !testCustomer} className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5">
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send Test
          </button>
        </div>
      </div>

      {/* History */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-espresso-900">Notification History</h2>
            <p className="text-xs text-stone-400">Every website broadcast, with delivery results</p>
          </div>
          <button onClick={fetchHistory} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50">
            <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {historyLoading ? (
          <div className="py-12 text-center text-stone-400"><Loader2 size={24} className="animate-spin mx-auto" /></div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center">
            <Bell size={28} className="mx-auto text-stone-300" />
            <p className="mt-2 text-sm font-semibold text-stone-600">No notifications sent yet</p>
            <p className="text-xs text-stone-400">Click “Create Notification” to send your first website broadcast.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-[0.08em]">
                  <th className="py-2.5 pr-3 font-semibold">Notification</th>
                  <th className="py-2.5 pr-3 font-semibold">Date</th>
                  <th className="py-2.5 pr-3 font-semibold">Audience</th>
                  <th className="py-2.5 pr-3 font-semibold">Channel</th>
                  <th className="py-2.5 pr-3 font-semibold text-center">Recipients</th>
                  <th className="py-2.5 pr-3 font-semibold text-center">Successful</th>
                  <th className="py-2.5 pr-3 font-semibold text-center">Failed</th>
                  <th className="py-2.5 pr-3 font-semibold">Status</th>
                  <th className="py-2.5 text-right font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {campaigns.map((c) => (
                  <tr key={c._id} className="hover:bg-stone-50/60">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-stone-900">{c.name || c.title}</div>
                      <div className="text-[10px] text-stone-400 truncate max-w-[220px]">{c.title}</div>
                    </td>
                    <td className="py-3 pr-3 text-stone-500 whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 pr-3 text-stone-600">{c.audienceType === 'all' || c.audienceType === 'all_enabled' ? 'All Customers' : 'Selected'}</td>
                    <td className="py-3 pr-3 text-stone-600">Website</td>
                    <td className="py-3 pr-3 text-center font-semibold">{c.totalRecipients || 0}</td>
                    <td className="py-3 pr-3 text-center font-semibold text-emerald-600">{c.totalSent || 0}</td>
                    <td className="py-3 pr-3 text-center font-semibold text-rose-600">{c.totalFailed || 0}</td>
                    <td className="py-3 pr-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(c.status)}`}>{c.status}</span>
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => openDetails(c)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] text-stone-600 hover:bg-stone-50">
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation dialog — no single-click accidental sends */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !sending && setShowConfirm(false)} className="fixed inset-0 z-50 bg-black/40" />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h3 className="font-display text-lg font-bold text-espresso-900">
                {audienceType === 'all' ? 'Send this notification to all eligible customers?' : `Send this notification to ${recipients} selected customer(s)?`}
              </h3>
              <div className="mt-4 space-y-2 rounded-xl bg-stone-50 border border-stone-200 p-4 text-sm">
                <div className="flex justify-between"><span className="text-stone-500">Recipients:</span><span className="font-bold text-stone-900">{recipients.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Channel:</span><span className="font-bold text-stone-900">Website Notification</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Title:</span><span className="font-medium text-stone-900 truncate max-w-[200px]">{title}</span></div>
              </div>
              <p className="mt-3 text-[11px] text-stone-400">Only devices with active Web Push subscriptions will receive it. Expired subscriptions are skipped automatically.</p>
              <div className="mt-5 flex gap-2.5">
                <button onClick={() => setShowConfirm(false)} disabled={sending} className="btn-secondary flex-1 text-sm py-2.5">Cancel</button>
                <button onClick={handleSend} disabled={sending} className="btn-primary flex-1 text-sm py-2.5 inline-flex items-center justify-center gap-2">
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send Notification
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Details modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} className="fixed inset-0 z-50 bg-black/40" />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-espresso-900">{selected.name || selected.title}</h3>
                  <p className="text-xs text-stone-500 mt-0.5">{selected.title} — {selected.message}</p>
                </div>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100" aria-label="Close details"><X size={18} /></button>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                {[['Recipients', selected.totalRecipients], ['Delivered', selected.totalSent], ['Failed', selected.totalFailed], ['Status', selected.status]].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">{label}</div>
                    <div className="font-bold text-stone-900 mt-0.5">{value ?? '—'}</div>
                  </div>
                ))}
              </div>
              <h4 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">Delivery log</h4>
              {detailLoading ? (
                <div className="py-8 text-center text-stone-400"><Loader2 size={22} className="animate-spin mx-auto" /></div>
              ) : deliveries.length === 0 ? (
                <p className="text-xs text-stone-400 py-4 text-center">No delivery records.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {deliveries.map((d) => (
                    <div key={d._id} className="flex items-center justify-between rounded-xl border border-stone-100 px-3 py-2 text-xs">
                      <span className="font-medium text-stone-700">{d.customerId?.name || 'Guest device'}{d.subscriptionId?.deviceType ? ` • ${d.subscriptionId.deviceType}` : ''}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${d.status === 'delivered' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{d.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
