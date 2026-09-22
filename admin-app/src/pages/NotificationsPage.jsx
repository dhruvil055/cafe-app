import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, Send, Users, CheckCircle2, AlertCircle, Clock,
  Calendar, Eye, RefreshCw, X, Loader2, Sparkles, Filter,
  Smartphone, Monitor, Tag, Plus, Check, ExternalLink,
  ChevronRight, Info, ShieldCheck, ArrowRight, Ban, XCircle, Phone,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../services/api';

const AUDIENCE_OPTIONS = [
  {
    id: 'all_enabled',
    label: 'All Notification-Enabled Customers',
    desc: 'Every customer with an active browser push subscription',
  },
  {
    id: 'single_customer',
    label: 'Single Customer (by Phone Number)',
    desc: 'Send web push directly to a specific customer mobile phone',
  },
  {
    id: 'new_customers',
    label: 'New Customers',
    desc: 'Customers who placed their first order in the last 30 days',
  },
  {
    id: 'returning_customers',
    label: 'Returning Customers',
    desc: 'Customers with 2 or more completed orders',
  },
  {
    id: 'inactive_30d',
    label: "Haven't Ordered in 30 Days",
    desc: 'Lapsed guests who have not ordered in the past 30 days',
  },
  {
    id: 'frequent_5plus',
    label: 'Customers with 5+ Orders',
    desc: 'Loyal café regulars with 5 or more orders',
  },
  {
    id: 'high_value',
    label: 'High-Value Customers',
    desc: 'Customers with total spend exceeding ₹5,000',
  },
  {
    id: 'custom',
    label: 'Custom Audience',
    desc: 'Specify exact order counts, spending, and inactivity criteria',
  },
];

const PRESETS = [
  {
    name: 'Weekend Special',
    title: '☕ Weekend Special!',
    message: 'Get 20% OFF on selected coffee this weekend at Brewhaus Café.',
    actionUrl: '/menu?offer=BREW20',
    offerCode: 'BREW20',
    audienceType: 'all_enabled',
  },
  {
    name: 'We Miss You Offer',
    title: '☕ We Miss You at Brewhaus!',
    message: 'Enjoy ₹100 OFF your next handcrafted brew with code BREWBACK.',
    actionUrl: '/menu?offer=BREWBACK',
    offerCode: 'BREWBACK',
    audienceType: 'inactive_30d',
  },
  {
    name: 'New Seasonal Menu',
    title: '✨ New Seasonal Beverages!',
    message: 'Try our brand new artisanal pour-overs and seasonal cold brews.',
    actionUrl: '/menu',
    offerCode: '',
    audienceType: 'all_enabled',
  },
];

const COLORS = ['#8c5835', '#2a1810', '#10b981', '#f59e0b', '#6366f1', '#ec4899'];

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState('overview'); // overview, create, campaigns, audience, analytics

  // Stats & Analytics State
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Campaigns List State
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsPage, setCampaignsPage] = useState(1);
  const [totalCampaigns, setTotalCampaigns] = useState(0);

  // Campaign Detail Modal State
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignDeliveries, setCampaignDeliveries] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create Form State
  const [campaignName, setCampaignName] = useState('');
  const [title, setTitle] = useState('☕ Weekend Special');
  const [message, setMessage] = useState('Get 20% OFF your coffee this weekend!');
  const [image, setImage] = useState('');
  const [actionUrl, setActionUrl] = useState('/menu?offer=BREW20');
  const [offerCode, setOfferCode] = useState('BREW20');
  const [scheduleType, setScheduleType] = useState('now'); // 'now' or 'schedule'
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [channel, setChannel] = useState('web_push');
  const [audienceType, setAudienceType] = useState('all_enabled');
  const [customFilters, setCustomFilters] = useState({
    minOrders: '',
    maxOrders: '',
    minSpent: '',
    maxDaysInactive: '',
  });

  // Audience Count State
  const [eligibleCount, setEligibleCount] = useState(0);
  const [estimatingCount, setEstimatingCount] = useState(false);
  const [targetPhone, setTargetPhone] = useState('');
  const [targetCustomerInfo, setTargetCustomerInfo] = useState(null);

  // URL Query Param Support for direct targeting
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const phoneParam = searchParams.get('phone');
    if (phoneParam) {
      setActiveTab('create');
      setAudienceType('single_customer');
      setTargetPhone(phoneParam);
    }
  }, [searchParams]);

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Analytics & Overview Data
  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const { data } = await api.get('/notifications/analytics');
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load notification analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Fetch Campaigns History
  const fetchCampaigns = async (page = 1) => {
    setCampaignsLoading(true);
    try {
      const { data } = await api.get(`/notifications?page=${page}&limit=12`);
      setCampaigns(data.campaigns || []);
      setTotalCampaigns(data.total || 0);
      setCampaignsPage(data.page || 1);
    } catch (err) {
      toast.error(err.message || 'Failed to load campaigns');
    } finally {
      setCampaignsLoading(false);
    }
  };

  // Recalculate Live Audience Count (Phase 13)
  const calculateAudienceCount = async () => {
    setEstimatingCount(true);
    try {
      const params = new URLSearchParams({ audienceType, channel });
      if (audienceType === 'custom') {
        if (customFilters.minOrders) params.set('minOrders', customFilters.minOrders);
        if (customFilters.maxOrders) params.set('maxOrders', customFilters.maxOrders);
        if (customFilters.minSpent) params.set('minSpent', customFilters.minSpent);
        if (customFilters.maxDaysInactive) params.set('maxDaysInactive', customFilters.maxDaysInactive);
      } else if (audienceType === 'single_customer') {
        if (targetPhone.trim()) {
          params.set('phone', targetPhone.trim());
        }
      }
      const { data } = await api.get(`/notifications/audience/count?${params.toString()}`);
      setEligibleCount(data.count || 0);
      if (audienceType === 'single_customer') {
        setTargetCustomerInfo(data.customer || null);
      }
    } catch (err) {
      console.error('Audience estimate failed:', err);
    } finally {
      setEstimatingCount(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchCampaigns();
  }, []);

  useEffect(() => {
    calculateAudienceCount();
  }, [audienceType, customFilters, targetPhone, channel]);

  // Open Campaign Details Drawer
  const openCampaignDetails = async (campaign) => {
    setSelectedCampaign(campaign);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/notifications/${campaign._id}`);
      setCampaignDeliveries(data.deliveries || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load campaign details');
    } finally {
      setDetailLoading(false);
    }
  };

  // Cancel a scheduled campaign
  const handleCancelCampaign = async (campaignId) => {
    try {
      await api.post(`/notifications/${campaignId}/cancel`);
      toast.success('Campaign has been cancelled.');
      fetchCampaigns(campaignsPage);
      if (selectedCampaign?._id === campaignId) {
        setSelectedCampaign({ ...selectedCampaign, status: 'cancelled' });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to cancel campaign');
    }
  };

  // Submit Notification Campaign (Phase 11, 15, 20)
  const handleSendOrSchedule = async () => {
    setSubmitting(true);
    try {
      let finalScheduledAt = null;
      if (scheduleType === 'schedule') {
        if (!scheduledDate || !scheduledTime) {
          toast.error('Please select both a date and time for scheduled delivery.');
          setSubmitting(false);
          return;
        }
        finalScheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
        if (isNaN(finalScheduledAt.getTime()) || finalScheduledAt <= new Date()) {
          toast.error('Scheduled time must be in the future.');
          setSubmitting(false);
          return;
        }
      }

      let audienceFilter = {};
      if (audienceType === 'custom') {
        audienceFilter = customFilters;
      } else if (audienceType === 'single_customer') {
        if (!targetPhone.trim()) {
          toast.error('Please enter customer phone number.');
          setSubmitting(false);
          return;
        }
        audienceFilter = { phone: targetPhone.trim() };
      }

      const payload = {
        name: campaignName.trim() || title.trim(),
        title: title.trim(),
        message: message.trim(),
        image: image.trim(),
        actionUrl: actionUrl.trim() || '/menu',
        offerCode: offerCode.trim().toUpperCase(),
        channel,
        audienceType,
        audienceFilter,
        scheduleType,
        scheduledAt: finalScheduledAt ? finalScheduledAt.toISOString() : null,
      };

      const { data } = await api.post('/notifications', payload);
      toast.success(data.message || 'Notification dispatched successfully!');
      setShowConfirmModal(false);
      setActiveTab('campaigns');
      fetchCampaigns(1);
      fetchAnalytics();
    } catch (err) {
      toast.error(err.message || 'Failed to process notification.');
    } finally {
      setSubmitting(false);
    }
  };

  const applyPreset = (preset) => {
    setCampaignName(preset.name);
    setTitle(preset.title);
    setMessage(preset.message);
    setActionUrl(preset.actionUrl);
    setOfferCode(preset.offerCode);
    setAudienceType(preset.audienceType);
    toast.success(`Applied template: "${preset.name}"`);
  };

  const summary = analytics?.summary || {
    totalCustomers: 0,
    pushEnabled: 0,
    pushDisabled: 0,
    activeSubscriptions: 0,
    campaignsSent: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
    deliveryRate: '100%',
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-brew-500/20 p-2 text-brew-700">
              <Bell size={22} />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold text-espresso-900">Website Notification Center</h2>
              <p className="text-xs text-stone-500">
                Manage web push notifications, broadcast offers to café guests, and monitor delivery
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-stone-200/70 p-1 text-xs font-semibold text-stone-700">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'create', label: 'Create Notification' },
            { id: 'campaigns', label: 'Campaigns & History' },
            { id: 'audience', label: 'Audience Segments' },
            { id: 'analytics', label: 'Analytics' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3.5 py-2 transition ${
                activeTab === tab.id
                  ? 'bg-white text-espresso-900 shadow-sm'
                  : 'text-stone-600 hover:text-espresso-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: OVERVIEW ──────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Metrics Cards (Phase 7 & 21) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Customers', value: summary.totalCustomers, tone: 'text-espresso-900' },
              { label: 'Push Enabled', value: summary.pushEnabled, tone: 'text-emerald-700', badge: 'Active' },
              { label: 'Push Disabled', value: summary.pushDisabled, tone: 'text-stone-500' },
              { label: 'Active Devices', value: summary.activeSubscriptions, tone: 'text-brew-700' },
              { label: 'Campaigns Sent', value: summary.campaignsSent, tone: 'text-espresso-900' },
              { label: 'Delivery Rate', value: summary.deliveryRate, tone: 'text-emerald-600' },
            ].map((stat, i) => (
              <div key={i} className="card p-4 flex flex-col justify-between">
                <span className="text-xs text-stone-500">{stat.label}</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className={`text-xl font-bold ${stat.tone}`}>
                    {analyticsLoading ? '...' : stat.value}
                  </span>
                  {stat.badge && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                      {stat.badge}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Action Banner */}
          <div className="rounded-3xl border border-brew-200 bg-gradient-to-r from-brew-900 via-espresso-900 to-brew-950 p-6 text-white shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-0.5 text-xs text-brew-200 backdrop-blur">
                  <Sparkles size={13} /> Only Browser Push Active
                </div>
                <h3 className="font-display text-xl font-bold text-cream">Send an instant offer to your café customers</h3>
                <p className="text-xs text-brew-200 max-w-xl">
                  Push notifications reach customers directly on their mobile and desktop browsers even when the café website is closed.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('create')}
                className="btn-primary bg-brew-500 hover:bg-brew-400 text-white font-semibold py-2.5 px-5 text-sm shadow-md shrink-0 flex items-center gap-2"
              >
                <Plus size={16} /> Create Notification
              </button>
            </div>
          </div>

          {/* Recent Campaigns Preview */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-espresso-900">Recent Notification Campaigns</h3>
                <p className="text-xs text-stone-500">Latest website push broadcasts dispatched to customers</p>
              </div>
              <button
                onClick={() => setActiveTab('campaigns')}
                className="text-xs font-semibold text-brew-700 hover:underline flex items-center gap-1"
              >
                View All <ArrowRight size={13} />
              </button>
            </div>

            {campaignsLoading ? (
              <div className="py-12 text-center text-stone-400">
                <Loader2 size={24} className="mx-auto animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center">
                <Bell size={28} className="mx-auto text-stone-400" />
                <p className="mt-2 text-sm font-semibold text-espresso-900">No campaigns created yet</p>
                <p className="text-xs text-stone-500 mt-0.5">Click "Create Notification" to compose your first café alert.</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="btn-primary mt-4 py-2 px-4 text-xs inline-flex items-center gap-1.5"
                >
                  <Plus size={14} /> Create Notification
                </button>
              </div>
            ) : (
              <div className="divide-y divide-foam overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-stone-500 border-b border-foam">
                      <th className="pb-3 font-medium">Campaign</th>
                      <th className="pb-3 font-medium">Audience</th>
                      <th className="pb-3 font-medium">Recipients</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foam text-xs">
                    {campaigns.slice(0, 5).map((c) => (
                      <tr key={c._id} className="hover:bg-stone-50/70 transition">
                        <td className="py-3 pr-3 font-semibold text-espresso-900">
                          <div>{c.name}</div>
                          <div className="text-[11px] font-normal text-stone-500 truncate max-w-xs">{c.title}</div>
                        </td>
                        <td className="py-3 pr-3 text-stone-600">
                          <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px]">
                            {AUDIENCE_OPTIONS.find((a) => a.id === c.audienceType)?.label || c.audienceType}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <span className="font-semibold text-espresso-900">{c.totalSent || c.totalRecipients || 0}</span>
                          {c.totalFailed > 0 && <span className="text-rose-600 ml-1">({c.totalFailed} failed)</span>}
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            c.status === 'sent' ? 'bg-emerald-100 text-emerald-800' :
                            c.status === 'scheduled' ? 'bg-sky-100 text-sky-800' :
                            c.status === 'sending' ? 'bg-amber-100 text-amber-800' :
                            c.status === 'cancelled' ? 'bg-stone-200 text-stone-700' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-stone-500">
                          {new Date(c.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => openCampaignDetails(c)}
                            className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-white hover:text-espresso-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: CREATE NOTIFICATION (Phases 11-15) ────────────────────────────── */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Notification Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="card p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-foam pb-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-espresso-900">Compose Push Notification</h3>
                  <p className="text-xs text-stone-500">Configure message details, audience targeting, and schedule</p>
                </div>
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-stone-400 font-medium">Templates:</span>
                  {PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="rounded-lg border border-foam bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {/* Campaign Name */}
                <div>
                  <label className="font-semibold text-espresso-900 block mb-1">
                    Campaign Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Weekend Coffee Promotion"
                    className="w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:border-brew-600 focus:outline-none"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">Internal name displayed in dashboard history</p>
                </div>

                {/* Title */}
                <div>
                  <label className="font-semibold text-espresso-900 block mb-1">
                    Notification Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="☕ Weekend Special!"
                    className="w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:border-brew-600 focus:outline-none"
                  />
                </div>

                {/* Message Body */}
                <div>
                  <label className="font-semibold text-espresso-900 block mb-1">
                    Notification Message <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Get 20% OFF your coffee this weekend at Brewhaus Café!"
                    className="w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:border-brew-600 focus:outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                    <span>Use placeholders like {'{{name}}'}, {'{{code}}'} if desired.</span>
                    <span>{message.length} characters</span>
                  </div>
                </div>

                {/* Action URL & Offer Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-espresso-900 block mb-1">Action URL</label>
                    <input
                      type="text"
                      value={actionUrl}
                      onChange={(e) => setActionUrl(e.target.value)}
                      placeholder="/menu?offer=BREW20"
                      className="w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:border-brew-600 focus:outline-none"
                    />
                    <p className="text-[10px] text-stone-400 mt-1">Target page opened when customer clicks notification</p>
                  </div>
                  <div>
                    <label className="font-semibold text-espresso-900 block mb-1">Offer Code</label>
                    <input
                      type="text"
                      value={offerCode}
                      onChange={(e) => setOfferCode(e.target.value.toUpperCase())}
                      placeholder="BREW20"
                      className="w-full rounded-xl border border-stone-200 p-2.5 text-sm uppercase focus:border-brew-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Delivery Channel (Added for SMS/WhatsApp) */}
                <div className="pt-3 border-t border-foam space-y-2">
                  <label className="font-semibold text-espresso-900 block">Delivery Channel</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-espresso-900">
                      <input
                        type="radio"
                        name="channel"
                        value="web_push"
                        checked={channel === 'web_push'}
                        onChange={() => setChannel('web_push')}
                        className="accent-brew-600"
                      />
                      <Bell size={16} /> Web Push Notification
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-espresso-900">
                      <input
                        type="radio"
                        name="channel"
                        value="sms"
                        checked={channel === 'sms'}
                        onChange={() => setChannel('sms')}
                        className="accent-brew-600"
                      />
                      <Smartphone size={16} /> SMS Text
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-espresso-900">
                      <input
                        type="radio"
                        name="channel"
                        value="whatsapp"
                        checked={channel === 'whatsapp'}
                        onChange={() => setChannel('whatsapp')}
                        className="accent-brew-600"
                      />
                      <Phone size={16} /> WhatsApp Message
                    </label>
                  </div>
                </div>

                {/* Notification Image URL (Optional) */}
                {channel === 'web_push' && (
                  <div>
                    <label className="font-semibold text-espresso-900 block mb-1">Notification Image URL (Optional)</label>
                    <input
                      type="text"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="https://example.com/banner.jpg"
                      className="w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:border-brew-600 focus:outline-none"
                    />
                  </div>
                )}

                {/* Audience Selection (Phase 13) */}
                <div className="pt-3 border-t border-foam space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-espresso-900">Select Target Audience</label>
                    <span className="text-xs font-bold text-brew-700 bg-brew-50 px-2 py-0.5 rounded-lg border border-brew-200">
                      {estimatingCount ? 'Calculating...' : `Eligible Recipients: ${eligibleCount}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AUDIENCE_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                          audienceType === opt.id
                            ? 'border-brew-600 bg-brew-50/50'
                            : 'border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="audience"
                          value={opt.id}
                          checked={audienceType === opt.id}
                          onChange={(e) => setAudienceType(e.target.value)}
                          className="mt-0.5 accent-brew-600"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-espresso-900">{opt.label}</div>
                          <div className="text-[10px] text-stone-500 leading-tight mt-0.5">{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Custom Audience Filters */}
                  {audienceType === 'custom' && (
                    <div className="mt-3 rounded-xl bg-stone-50 p-3.5 border border-foam grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[11px] text-stone-500 block mb-1">Min Orders</label>
                        <input
                          type="number"
                          value={customFilters.minOrders}
                          onChange={(e) => setCustomFilters({ ...customFilters, minOrders: e.target.value })}
                          placeholder="e.g. 3"
                          className="w-full rounded-lg border border-stone-200 p-1.5 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-stone-500 block mb-1">Min Spent (₹)</label>
                        <input
                          type="number"
                          value={customFilters.minSpent}
                          onChange={(e) => setCustomFilters({ ...customFilters, minSpent: e.target.value })}
                          placeholder="e.g. 1000"
                          className="w-full rounded-lg border border-stone-200 p-1.5 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-stone-500 block mb-1">Max Inactivity (Days)</label>
                        <input
                          type="number"
                          value={customFilters.maxDaysInactive}
                          onChange={(e) => setCustomFilters({ ...customFilters, maxDaysInactive: e.target.value })}
                          placeholder="e.g. 60"
                          className="w-full rounded-lg border border-stone-200 p-1.5 text-xs bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* Single Customer Target by Phone */}
                  {audienceType === 'single_customer' && (
                    <div className="mt-3 rounded-xl bg-stone-50 p-3.5 border border-foam space-y-2 text-xs">
                      <label className="font-semibold text-espresso-900 block">
                        Customer Mobile Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          value={targetPhone}
                          onChange={(e) => setTargetPhone(e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="flex-1 rounded-xl border border-stone-200 p-2 text-xs focus:border-brew-600 focus:outline-none bg-white font-mono"
                        />
                      </div>
                      {targetCustomerInfo ? (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="font-bold">{targetCustomerInfo.name}</span>{' '}
                            <span className="text-stone-500">({targetCustomerInfo.phone})</span>
                          </div>
                          <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-md ${targetCustomerInfo.deviceCount > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {targetCustomerInfo.deviceCount > 0
                              ? `✅ ${targetCustomerInfo.deviceCount} Active Web Push Device${targetCustomerInfo.deviceCount > 1 ? 's' : ''}`
                              : '⚠️ No Active Push Device'}
                          </span>
                        </div>
                      ) : targetPhone.trim().length >= 8 ? (
                        <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                          No customer found with phone number &ldquo;{targetPhone}&rdquo; or no browser notification permission granted yet.
                        </p>
                      ) : (
                        <p className="text-[10px] text-stone-400">
                          Enter customer phone number to send a website push notification directly to their device.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Schedule Options (Phase 20) */}
                <div className="pt-3 border-t border-foam space-y-3">
                  <label className="font-semibold text-espresso-900 block">Dispatch Schedule</label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-espresso-900">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="now"
                        checked={scheduleType === 'now'}
                        onChange={() => setScheduleType('now')}
                        className="accent-brew-600"
                      />
                      <span>Send Now</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-espresso-900">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="schedule"
                        checked={scheduleType === 'schedule'}
                        onChange={() => setScheduleType('schedule')}
                        className="accent-brew-600"
                      />
                      <span>Schedule for Later</span>
                    </label>
                  </div>

                  {scheduleType === 'schedule' && (
                    <div className="rounded-xl bg-sky-50/60 p-3.5 border border-sky-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-sky-900 block mb-1">Date</label>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="w-full rounded-lg border border-sky-200 p-2 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-sky-900 block mb-1">Time (Asia/Kolkata)</label>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="w-full rounded-lg border border-sky-200 p-2 text-xs bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Send Button */}
                <div className="pt-4 border-t border-foam flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!title.trim() || !message.trim()) {
                        toast.error('Title and message are required.');
                        return;
                      }
                      setShowConfirmModal(true);
                    }}
                    className="btn-primary py-2.5 px-6 text-sm font-semibold flex items-center gap-2"
                  >
                    <Send size={15} />
                    {scheduleType === 'schedule' ? 'Schedule Notification' : 'Review & Send Notification'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Realistic Live Preview (Phase 12) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-20 space-y-4">
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-foam pb-2.5">
                  <span className="font-display font-bold text-sm text-espresso-900 flex items-center gap-2">
                    <Monitor size={16} className="text-brew-600" />
                    Live Browser Preview
                  </span>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Real-time
                  </span>
                </div>

                <p className="text-xs text-stone-500">
                  This simulates how the push notification appears on customer desktop & mobile browsers:
                </p>

                {/* Realistic Notification Box (Phase 12) */}
                <div className="rounded-2xl border border-stone-300 bg-white p-4 shadow-xl text-stone-900 relative font-sans">
                  {/* Notification Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-espresso-900 text-white text-xs font-bold">
                        ☕
                      </div>
                      <span className="text-xs font-bold text-espresso-900 tracking-wide">
                        Brewhaus Café
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-400">Just now</span>
                  </div>

                  {/* Body Content */}
                  <div className="mt-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-espresso-950 leading-tight">
                        {title || '☕ Notification Title'}
                      </h4>
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed break-words">
                        {message || 'Your custom message text will appear here.'}
                      </p>
                      {offerCode && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-brew-100/70 px-2 py-0.5 text-[10px] font-bold text-brew-800">
                          <Tag size={10} /> CODE: {offerCode}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Optional Banner Image Preview */}
                  {image && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-stone-200">
                      <img
                        src={image}
                        alt="Preview"
                        className="h-32 w-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-[11px]">
                    <span className="text-stone-400">brewhauscafe.com</span>
                    <span className="font-semibold text-brew-700 flex items-center gap-1">
                      View Offer <ExternalLink size={11} />
                    </span>
                  </div>
                </div>

                {/* Recipient Targeting Summary Card */}
                <div className="rounded-2xl bg-stone-50 p-4 border border-foam text-xs space-y-2">
                  <div className="font-semibold text-espresso-900 flex items-center gap-1.5">
                    <ShieldCheck size={15} className="text-emerald-600" />
                    Audience & Delivery Guarantee
                  </div>
                  <div className="text-[11px] text-stone-600 space-y-1">
                    <p>• Only customers with active web push subscriptions receive this alert.</p>
                    <p>• Respects customer marketing opt-in preferences (Phase 14).</p>
                    <p>• Invalid or expired subscriptions are pruned automatically (Phase 26).</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: CAMPAIGNS & HISTORY (Phase 19) ─────────────────────────────────── */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-foam pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-espresso-900">Campaign History</h3>
                <p className="text-xs text-stone-500">Record of all sent and scheduled notification broadcasts</p>
              </div>
              <button
                onClick={() => fetchCampaigns(campaignsPage)}
                disabled={campaignsLoading}
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 self-start"
              >
                <RefreshCw size={13} className={campaignsLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {campaignsLoading ? (
              <div className="py-16 text-center text-stone-400">
                <Loader2 size={28} className="mx-auto animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-12 text-center">
                <Bell size={32} className="mx-auto text-stone-400" />
                <p className="mt-3 font-semibold text-espresso-900">No campaigns found</p>
                <p className="text-xs text-stone-500 mt-1">You haven't sent any notifications yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-stone-500 border-b border-foam bg-stone-50/50">
                      <th className="p-3 font-medium">Campaign Name</th>
                      <th className="p-3 font-medium">Audience</th>
                      <th className="p-3 font-medium">Recipients</th>
                      <th className="p-3 font-medium">Sent</th>
                      <th className="p-3 font-medium">Failed</th>
                      <th className="p-3 font-medium">Date</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foam text-xs">
                    {campaigns.map((camp) => (
                      <tr key={camp._id} className="hover:bg-stone-50/80 transition">
                        <td className="p-3 font-semibold text-espresso-900">
                          <div>{camp.name}</div>
                          <div className="text-[11px] font-normal text-stone-500">{camp.title}</div>
                        </td>
                        <td className="p-3 text-stone-600">
                          <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px]">
                            {AUDIENCE_OPTIONS.find((a) => a.id === camp.audienceType)?.label || camp.audienceType}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-stone-700">{camp.totalRecipients || 0}</td>
                        <td className="p-3 font-semibold text-emerald-700">{camp.totalSent || 0}</td>
                        <td className="p-3 font-semibold text-rose-600">{camp.totalFailed || 0}</td>
                        <td className="p-3 text-stone-500">
                          {new Date(camp.scheduledAt || camp.createdAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            camp.status === 'sent' ? 'bg-emerald-100 text-emerald-800' :
                            camp.status === 'scheduled' ? 'bg-sky-100 text-sky-800' :
                            camp.status === 'sending' ? 'bg-amber-100 text-amber-800' :
                            camp.status === 'cancelled' ? 'bg-stone-200 text-stone-700' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {camp.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {camp.status === 'scheduled' && (
                            <button
                              onClick={() => handleCancelCampaign(camp._id)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => openCampaignDetails(camp)}
                            className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: AUDIENCE SEGMENTS (Phase 13) ──────────────────────────────────── */}
      {activeTab === 'audience' && (
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-display text-lg font-bold text-espresso-900">Push Audience Segments</h3>
              <p className="text-xs text-stone-500">
                Only customers with active push subscriptions can receive broadcasts
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AUDIENCE_OPTIONS.map((opt) => (
                <div key={opt.id} className="rounded-2xl border border-foam bg-stone-50/50 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <h4 className="font-display font-bold text-sm text-espresso-900">{opt.label}</h4>
                    <span className="rounded-full bg-brew-100 px-2 py-0.5 text-[10px] font-bold text-brew-800">
                      Segment
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{opt.desc}</p>
                  <div className="pt-2 border-t border-foam flex items-center justify-between text-xs">
                    <button
                      onClick={() => {
                        setAudienceType(opt.id);
                        setActiveTab('create');
                      }}
                      className="text-xs font-semibold text-brew-700 hover:underline flex items-center gap-1"
                    >
                      Target this segment <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: ANALYTICS (Phase 21) ─────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Delivery Trend Chart */}
            <div className="card p-5 space-y-4">
              <div>
                <h3 className="font-display text-base font-bold text-espresso-900">Notification Deliveries Over Time</h3>
                <p className="text-xs text-stone-500">Daily successful vs failed push dispatches</p>
              </div>
              <div className="h-64 w-full">
                {analytics?.deliveryTrends?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.deliveryTrends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-stone-400">
                    No delivery records logged yet
                  </div>
                )}
              </div>
            </div>

            {/* Push Status Distribution */}
            <div className="card p-5 space-y-4">
              <div>
                <h3 className="font-display text-base font-bold text-espresso-900">Customer Push Subscription Share</h3>
                <p className="text-xs text-stone-500">Customers with browser notification permission enabled vs disabled</p>
              </div>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Push Enabled', value: summary.pushEnabled || 0 },
                        { name: 'Push Disabled', value: summary.pushDisabled || 0 },
                      ]}
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#a8a29e" />
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SEND CONFIRMATION MODAL (Phase 15) ──────────────────────────────────── */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card p-6 max-w-md w-full bg-white text-espresso-900 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brew-100 flex items-center justify-center text-brew-700">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">Confirm Notification</h3>
                  <p className="text-xs text-stone-500">Review campaign dispatch details before sending</p>
                </div>
              </div>

              <div className="rounded-2xl bg-stone-50 p-4 border border-foam text-xs space-y-2.5">
                <div className="flex justify-between py-1 border-b border-foam">
                  <span className="text-stone-500">Campaign</span>
                  <span className="font-semibold text-espresso-900">{campaignName || title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-foam">
                  <span className="text-stone-500">Audience</span>
                  <span className="font-semibold text-espresso-900">
                    {AUDIENCE_OPTIONS.find((a) => a.id === audienceType)?.label || audienceType}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-foam">
                  <span className="text-stone-500">Recipients</span>
                  <span className="font-bold text-brew-700">{eligibleCount} eligible devices</span>
                </div>
                <div className="flex justify-between py-1 border-b border-foam">
                  <span className="text-stone-500">Channel</span>
                  <span className="font-semibold text-emerald-700">Website Push Notification</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-500">Timing</span>
                  <span className="font-semibold text-espresso-900">
                    {scheduleType === 'schedule' ? `${scheduledDate} ${scheduledTime}` : 'Send Immediately'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                  className="btn-secondary py-2 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendOrSchedule}
                  disabled={submitting}
                  className="btn-primary py-2 px-5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {submitting ? 'Processing...' : 'Send Notification'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CAMPAIGN DETAIL MODAL (Phase 19) ────────────────────────────────────── */}
      <AnimatePresence>
        {selectedCampaign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card p-6 max-w-2xl w-full bg-white text-espresso-900 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-start justify-between border-b border-foam pb-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-espresso-900">{selectedCampaign.name}</h3>
                  <p className="text-xs text-stone-500">{selectedCampaign.title}</p>
                </div>
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="text-stone-400 hover:text-espresso-900 p-1 rounded-full"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-stone-50 p-3 border border-foam">
                  <span className="text-[11px] text-stone-500">Recipients</span>
                  <div className="text-base font-bold text-espresso-900">{selectedCampaign.totalRecipients || 0}</div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                  <span className="text-[11px] text-emerald-700">Delivered</span>
                  <div className="text-base font-bold text-emerald-800">{selectedCampaign.totalSent || 0}</div>
                </div>
                <div className="rounded-xl bg-rose-50 p-3 border border-rose-100">
                  <span className="text-[11px] text-rose-700">Failed</span>
                  <div className="text-base font-bold text-rose-800">{selectedCampaign.totalFailed || 0}</div>
                </div>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wide">Delivery Logs</h4>
                {detailLoading ? (
                  <div className="py-8 text-center text-stone-400">
                    <Loader2 size={20} className="mx-auto animate-spin" />
                  </div>
                ) : campaignDeliveries.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-400">
                    No individual delivery events recorded
                  </div>
                ) : (
                  <div className="divide-y divide-foam text-xs">
                    {campaignDeliveries.map((del) => (
                      <div key={del._id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-espresso-900">
                            {del.customerId?.name || 'Subscriber Device'}
                          </div>
                          <div className="text-[10px] text-stone-500">
                            {del.subscriptionId?.browser || 'Browser'} on {del.subscriptionId?.deviceType || 'Device'}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            del.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {del.status === 'delivered' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            {del.status}
                          </span>
                          {del.errorMessage && (
                            <p className="text-[10px] text-rose-600 truncate max-w-xs">{del.errorMessage}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-foam flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedCampaign(null)}
                  className="btn-secondary py-2 px-4 text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
