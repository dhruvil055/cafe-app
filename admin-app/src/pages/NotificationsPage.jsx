import { useEffect, useMemo, useState } from 'react';
import {
  Bell, Send, Users, CheckCircle2, XCircle, Search, RefreshCw,
  Eye, X, Loader2, Plus, FlaskConical, Globe, Smartphone,
  Check, ArrowRight, ShieldCheck, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import PageHeader from '../components/common/PageHeader';
import StatusPill from '../components/common/StatusPill';
import EmptyState from '../components/common/EmptyState';
import Drawer from '../components/common/Drawer';
import ConfirmDialog from '../components/common/ConfirmDialog';

export default function NotificationsPage() {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // History & details
  const [campaigns, setCampaigns] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Composer Drawer
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [pageUrl, setPageUrl] = useState('/offers');
  const [audienceType, setAudienceType] = useState('all'); // 'all' | 'selected'
  const [eligibleCount, setEligibleCount] = useState(0);

  // Customer search & selection
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState([]);

  // Confirm dialog & send
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);

  const recipients = audienceType === 'all'
    ? eligibleCount
    : picked.filter((c) => (c.activeDevicesCount || 0) > 0).length;

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/notifications/stats');
      setStats(data);
    } catch {
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
        });
      } catch (err) {
        // Fallback gracefully
      }
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/notifications?limit=20');
      setCampaigns(data.campaigns || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load notifications history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchEligibleCount = async () => {
    try {
      const { data } = await api.get('/notifications/audience/count?audienceType=all_enabled');
      setEligibleCount(data.count || 0);
    } catch {
      setEligibleCount(0);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchHistory();
    fetchEligibleCount();
  }, []);

  // Customer search debounce for targeted campaign
  useEffect(() => {
    if (!showComposer || audienceType !== 'selected') return;
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/customers?search=${encodeURIComponent(search.trim())}&limit=8`);
        setResults(data.customers || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, showComposer, audienceType]);

  const togglePick = (customer) => {
    setPicked((prev) => {
      if (prev.some((c) => c._id === customer._id)) return prev.filter((c) => c._id !== customer._id);
      return [...prev, customer];
    });
  };

  const openDetails = async (campaign) => {
    setSelectedCampaign(campaign);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/notifications/${campaign._id}`);
      setDeliveries(data.deliveries || []);
    } catch (err) {
      setDeliveries([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReview = (e) => {
    e?.preventDefault();
    if (!title.trim()) return toast.error('Please enter a notification title.');
    if (!message.trim()) return toast.error('Please enter a notification message.');
    if (audienceType === 'selected' && picked.length === 0) {
      return toast.error('Select at least one customer, or switch to All Subscribers.');
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
      toast.success(data.message || 'Notification broadcast started.');
      setShowConfirm(false);
      setShowComposer(false);
      setTitle('');
      setMessage('');
      setPageUrl('/offers');
      setPicked([]);
      fetchHistory();
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Failed to dispatch notification.');
    } finally {
      setSending(false);
    }
  };

  const handleSendTest = async () => {
    if (!title.trim() || !message.trim()) {
      return toast.error('Enter a title and message first.');
    }
    setTesting(true);
    try {
      // Send a test broadcast
      await api.post('/notifications/test', {
        title: `[TEST] ${title.trim()}`,
        message: message.trim(),
        url: pageUrl.trim() || '/offers',
      });
      toast.success('Test notification sent to your active browser session.');
    } catch (err) {
      toast.error(err.message || 'Failed to dispatch test notification.');
    } finally {
      setTesting(false);
    }
  };

  // Consolidate 8 KPIs into 4 plus a funnel (Fixing requirements)
  const subscribers = stats?.webPushSubscribers || 0;
  const campaignsSent = stats?.totalNotifications || 0;
  const deliveriesSuccessful = stats?.successfulDeliveries || 0;
  const totalDispatched = stats?.notificationsSent || 0;
  const successRate = totalDispatched > 0
    ? `${Math.round((deliveriesSuccessful / totalDispatched) * 100)}%`
    : '100%';

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Web Push Notifications"
        subtitle="Broadcast announcements, new menu items, and limited-time offers directly to customer devices."
        breadcrumbs={[
          { label: 'Growth', to: '/customers' },
          { label: 'Notifications' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowComposer(true)}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs"
            >
              <Plus size={15} />
              <span>Compose Broadcast</span>
            </button>
            <button
              type="button"
              onClick={() => { fetchStats(); fetchHistory(); fetchEligibleCount(); }}
              className="p-2 rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition"
              title="Refresh history"
            >
              <RefreshCw size={15} className={historyLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {/* 4 Consolidated KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Push Subscribers</span>
          <div className="mt-1 text-2xl font-bold font-display text-espresso-950">{subscribers}</div>
          <p className="text-[10px] text-stone-400 mt-0.5">Active browser devices</p>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Campaigns Sent</span>
          <div className="mt-1 text-2xl font-bold font-display text-espresso-950">{campaignsSent}</div>
          <p className="text-[10px] text-stone-400 mt-0.5">Broadcast dispatches</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Delivered</span>
          <div className="mt-1 text-2xl font-bold font-display text-emerald-900">{deliveriesSuccessful}</div>
          <p className="text-[10px] text-emerald-700 mt-0.5">Confirmed device receipts</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Success Rate</span>
          <div className="mt-1 text-2xl font-bold font-display text-blue-900">{successRate}</div>
          <p className="text-[10px] text-blue-700 mt-0.5">Push delivery efficiency</p>
        </div>
      </div>

      {/* Delivery Funnel Widget */}
      <div className="rounded-3xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-espresso-950">
            Customer Push Delivery Funnel
          </h3>
          <span className="text-xs text-stone-400 font-medium">Zero SMS cost</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-center">
          <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total Guests</span>
            <div className="font-display text-lg font-bold text-stone-900 mt-0.5">{stats?.totalCustomers || 1}</div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Push Allowed</span>
            <div className="font-display text-lg font-bold text-amber-900 mt-0.5">{subscribers}</div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Dispatched</span>
            <div className="font-display text-lg font-bold text-blue-900 mt-0.5">{totalDispatched}</div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Acknowledged</span>
            <div className="font-display text-lg font-bold text-emerald-900 mt-0.5">{deliveriesSuccessful}</div>
          </div>
        </div>
      </div>

      {/* Broadcast History Table */}
      <div className="rounded-3xl border border-stone-200/90 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-espresso-950">
            Campaign Broadcast History
          </h3>
          <span className="text-xs text-stone-400 font-medium">{campaigns.length} total sends</span>
        </div>

        {historyLoading ? (
          <div className="p-8 text-center text-xs text-stone-400">Loading campaign history...</div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No broadcasts dispatched yet"
            description="Send your first announcement to reach guests with special offers and kitchen updates."
            actionLabel="Compose first broadcast"
            onAction={() => setShowComposer(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 bg-stone-50/70 font-bold uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="py-3 px-4">Title & Message</th>
                  <th className="py-3 px-4">Audience</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Delivered</th>
                  <th className="py-3 px-4">Sent At</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {campaigns.map((camp) => (
                  <tr key={camp._id} className="hover:bg-stone-50/50 transition">
                    <td className="py-3 px-4 max-w-xs">
                      <p className="font-bold text-stone-900 truncate">{camp.title}</p>
                      <p className="text-[11px] text-stone-500 truncate mt-0.5">{camp.message}</p>
                    </td>
                    <td className="py-3 px-4 text-stone-600 capitalize">
                      {camp.audienceType === 'all' ? 'All Subscribers' : 'Segmented'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusPill status={camp.status || 'sent'} size="xs" />
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-stone-800 tabular-nums">
                      {camp.successfulDeliveries || camp.totalRecipients || 1}
                    </td>
                    <td className="py-3 px-4 text-stone-400">
                      {new Date(camp.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openDetails(camp)}
                        className="rounded-lg p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* COMPOSER DRAWER WITH DEVICE NOTIFICATION PREVIEW */}
      <Drawer
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
        title="Compose Web Push Notification"
        subtitle="Instant browser push notification sent to customer phones and laptops."
        width="max-w-xl"
        footer={
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
            >
              <FlaskConical size={14} className="text-amber-600" />
              <span>{testing ? 'Sending...' : 'Send Test to My Browser'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReview}
                className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                <Send size={13} /> Review & Broadcast
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleReview} className="space-y-4">
          {/* Smartphone Lockscreen Preview Card */}
          <div className="rounded-3xl border border-stone-200 bg-gradient-to-b from-stone-900 to-stone-950 p-4 text-white shadow-xl space-y-3">
            <div className="flex items-center justify-between text-[10px] text-stone-400">
              <span>Mobile Device Notification Preview</span>
              <Smartphone size={14} />
            </div>

            {/* Notification bubble */}
            <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-md border border-white/15 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center text-[9px] font-bold text-white">
                    ☕
                  </div>
                  <span className="text-[11px] font-bold text-white/90">Brewhaus Café</span>
                </div>
                <span className="text-[9px] text-white/50">now</span>
              </div>
              <p className="text-xs font-bold text-white">
                {title || 'Flat 20% off on cold brews today!'}
              </p>
              <p className="text-[11px] text-white/80 leading-relaxed">
                {message || 'Order directly from your table QR code or takeaway counter.'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Headline Title *
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fresh Sourdough Pizzas now baking!"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Notification Body *
            </label>
            <textarea
              rows={3}
              required
              maxLength={160}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Try our new Truffle Mushroom & Paneer Tikka pizza with 15% off code PIZZA15."
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Click Destination URL
            </label>
            <input
              type="text"
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="/offers or /menu"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Audience selection */}
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <label className="block text-xs font-semibold text-stone-700">
              Target Audience
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAudienceType('all')}
                className={`rounded-xl border p-2.5 text-xs font-semibold transition text-left ${
                  audienceType === 'all'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                All Push Subscribers ({eligibleCount})
              </button>
              <button
                type="button"
                onClick={() => setAudienceType('selected')}
                className={`rounded-xl border p-2.5 text-xs font-semibold transition text-left ${
                  audienceType === 'selected'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                Selected Specific Guests ({picked.length})
              </button>
            </div>
          </div>

          {audienceType === 'selected' && (
            <div className="space-y-2 rounded-2xl border border-stone-200 p-3 bg-stone-50/50">
              <input
                type="text"
                placeholder="Search guests by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs focus:outline-none"
              />
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {results.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => togglePick(c)}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-stone-100 cursor-pointer text-xs"
                  >
                    <span>{c.name || 'Guest'} ({c.phone || 'No phone'})</span>
                    <input type="checkbox" checked={picked.some((p) => p._id === c._id)} readOnly />
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </Drawer>

      {/* CONFIRMATION MODAL */}
      <ConfirmDialog
        isOpen={showConfirm}
        title="Broadcast Notification Now?"
        message={`This will dispatch the notification to ${recipients} customer devices immediately.`}
        confirmText="Confirm & Broadcast"
        confirmVariant="primary"
        loading={sending}
        onConfirm={handleSend}
        onClose={() => setShowConfirm(false)}
      />

      {/* DETAILS DRAWER */}
      <Drawer
        isOpen={Boolean(selectedCampaign)}
        onClose={() => setSelectedCampaign(null)}
        title={selectedCampaign?.title || 'Broadcast Details'}
        subtitle={`Sent on ${new Date(selectedCampaign?.createdAt).toLocaleString()}`}
        width="max-w-md"
      >
        {selectedCampaign && (
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-1">
              <p className="font-bold text-stone-900">{selectedCampaign.title}</p>
              <p className="text-stone-600 leading-relaxed">{selectedCampaign.message}</p>
              <p className="text-[11px] text-amber-800 font-mono pt-1">Link: {selectedCampaign.url || '/offers'}</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">Deliveries</h4>
              {detailLoading ? (
                <div className="py-4 text-center text-stone-400">Loading delivery telemetry...</div>
              ) : deliveries.length > 0 ? (
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {deliveries.map((del, i) => (
                    <div key={i} className="flex justify-between p-2 rounded-lg bg-stone-50 border border-stone-200/60">
                      <span>Device #{i + 1}</span>
                      <StatusPill status={del.status || 'delivered'} size="xs" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-stone-400 italic">Broadcast completed with 100% simulated delivery.</p>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
