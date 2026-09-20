import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Megaphone, Send, Users, CheckCircle2, AlertCircle, Clock,
  Calendar, Tag, Eye, RefreshCw, X, Loader2, Sparkles, Filter,
  Smartphone, Bell, MessageSquare, RotateCcw, Ban, ShieldCheck,
  ChevronRight, ArrowRight, Settings, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, desc: 'Official WhatsApp Business Cloud API' },
  { id: 'sms', label: 'SMS', icon: Smartphone, desc: 'Direct Telecom SMS Gateway' },
  { id: 'push', label: 'Web Push', icon: Bell, desc: 'Browser Push Notifications' },
  { id: 'all', label: 'Multi-Channel', icon: Megaphone, desc: 'Combined WhatsApp & SMS Delivery' },
];

const AUDIENCE_TYPES = [
  { id: 'all_opted_in', label: 'All Opted-In Customers', desc: 'Every active customer who explicitly opted in' },
  { id: 'new_customers', label: 'New Customers', desc: 'Customers whose first order was within 30 days' },
  { id: 'returning_customers', label: 'Returning Customers', desc: 'Customers with more than 1 order' },
  { id: 'inactive_customers', label: 'Inactive Customers', desc: 'Customers who haven’t ordered in 30+ days' },
  { id: 'high_value', label: 'High-Value Customers', desc: 'Customers with total spending > ₹5,000' },
  { id: 'frequent', label: 'Frequent Customers', desc: 'Loyal café guests with 5+ orders' },
  { id: 'custom', label: 'Custom Filters', desc: 'Combine order counts, spending, and inactivity days' },
];

const PREAPPROVED_TEMPLATES = [
  {
    title: 'Weekend Special',
    content: '☕ Weekend Special at Brewhaus Café! Get 20% OFF on all coffee this Saturday & Sunday. Visit us today!',
    code: 'BREW20',
  },
  {
    title: 'We Miss You!',
    content: 'Hello {{name}} 👋 It has been a while! Brewhaus Café misses you. Enjoy ₹100 OFF your next coffee order with code {{code}}.',
    code: 'COMEBACK100',
  },
  {
    title: 'New Seasonal Menu',
    content: '🍂 New handcrafted beverages are here at Brewhaus Café! Taste our signature brews and get 15% OFF today.',
    code: 'NEWBREW',
  },
  {
    title: 'VIP Regular Treat',
    content: 'Thank you for being one of our favorite regulars, {{name}}! Enjoy a complimentary dessert on your next visit.',
    code: 'VIPDESSERT',
  },
];

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState('overview'); // overview, campaigns, create, audience, settings

  // Stats & analytics
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Campaigns list
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsPage, setCampaignsPage] = useState(1);
  const [totalCampaigns, setTotalCampaigns] = useState(0);

  // Campaign Report Modal
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignDetails, setCampaignDetails] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Create Campaign Form State
  const [campaignName, setCampaignName] = useState('');
  const [campaignChannel, setCampaignChannel] = useState('whatsapp');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [audienceType, setAudienceType] = useState('all_opted_in');
  const [audienceFilter, setAudienceFilter] = useState({
    minOrders: '',
    maxOrders: '',
    minSpent: '',
    daysSinceFirstOrder: 30,
    maxDaysInactive: 30,
  });
  const [scheduleType, setScheduleType] = useState('now'); // now or schedule
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Audience estimate count
  const [estimatedRecipients, setEstimatedRecipients] = useState(0);
  const [estimating, setEstimating] = useState(false);

  // Send Safety Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittingCampaign, setSubmittingCampaign] = useState(false);

  // Test dispatch & sync state
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [syncingOrders, setSyncingOrders] = useState(false);

  // Marketing Settings State
  const [settings, setSettings] = useState({
    maxPromotionsPerCustomerPeriod: 3,
    periodDays: 30,
    enabledChannels: { sms: true, whatsapp: true, push: true },
    whatsappCloud: { accessToken: '', phoneNumberId: '', businessAccountId: '' },
    twilio: { accountSid: '', authToken: '', phoneNumber: '' },
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Fetch Marketing Stats
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/marketing/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch marketing stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch Campaigns
  const fetchCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const { data } = await api.get(`/marketing/campaigns?page=${campaignsPage}&limit=15`);
      setCampaigns(data.campaigns || []);
      setTotalCampaigns(data.total || 0);
    } catch (err) {
      toast.error(err.message || 'Failed to load campaigns');
    } finally {
      setCampaignsLoading(false);
    }
  };

  // Fetch Settings
  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/marketing/settings');
      if (data.settings) {
        setSettings({
          maxPromotionsPerCustomerPeriod: data.settings.maxPromotionsPerCustomerPeriod || 3,
          periodDays: data.settings.periodDays || 30,
          enabledChannels: data.settings.enabledChannels || { sms: true, whatsapp: true, push: true },
          whatsappCloud: data.settings.whatsappCloud || { accessToken: '', phoneNumberId: '', businessAccountId: '' },
          twilio: data.settings.twilio || { accountSid: '', authToken: '', phoneNumber: '' },
        });
      }
    } catch (err) {
      console.error('Failed to load marketing settings:', err);
    }
  };

  // Estimate Audience Count
  const estimateAudience = async () => {
    setEstimating(true);
    try {
      const params = new URLSearchParams();
      params.set('audienceType', audienceType);
      if (audienceFilter.minOrders) params.set('minOrders', audienceFilter.minOrders);
      if (audienceFilter.maxOrders) params.set('maxOrders', audienceFilter.maxOrders);
      if (audienceFilter.minSpent) params.set('minSpent', audienceFilter.minSpent);
      if (audienceFilter.daysSinceFirstOrder) params.set('daysSinceFirstOrder', audienceFilter.daysSinceFirstOrder);
      if (audienceFilter.maxDaysInactive) params.set('maxDaysInactive', audienceFilter.maxDaysInactive);

      const { data } = await api.get(`/marketing/audience/count?${params.toString()}`);
      setEstimatedRecipients(data.count || 0);
    } catch (err) {
      console.error('Audience estimate error:', err);
    } finally {
      setEstimating(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'campaigns') fetchCampaigns();
  }, [activeTab, campaignsPage]);

  useEffect(() => {
    estimateAudience();
  }, [audienceType, audienceFilter]);

  // Open Campaign Report Modal
  const openCampaignReport = async (camp) => {
    setSelectedCampaign(camp);
    setReportLoading(true);
    try {
      const { data } = await api.get(`/marketing/campaigns/${camp._id}`);
      setCampaignDetails(data);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch campaign report');
    } finally {
      setReportLoading(false);
    }
  };

  // Trigger immediate send for draft campaign
  const handleTriggerSend = async (campaignId) => {
    try {
      await api.post(`/marketing/campaigns/${campaignId}/send`);
      toast.success('Campaign delivery triggered!');
      fetchCampaigns();
      if (selectedCampaign?._id === campaignId) {
        openCampaignReport(selectedCampaign);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to trigger campaign send');
    }
  };

  // Cancel scheduled campaign
  const handleCancelCampaign = async (campaignId) => {
    try {
      await api.post(`/marketing/campaigns/${campaignId}/cancel`);
      toast.success('Campaign cancelled');
      fetchCampaigns();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel campaign');
    }
  };

  // Retry Failed Deliveries
  const handleRetryFailed = async (campaignId) => {
    setRetrying(true);
    try {
      const { data } = await api.post(`/marketing/campaigns/${campaignId}/retry-failed`);
      toast.success(`Retried ${data.retried} failed messages (${data.recovered} recovered)`);
      openCampaignReport(selectedCampaign);
      fetchCampaigns();
    } catch (err) {
      toast.error(err.message || 'Failed to retry deliveries');
    } finally {
      setRetrying(false);
    }
  };

  // Validate campaign creation form
  const validateForm = () => {
    if (!campaignName.trim()) {
      toast.error('Please enter a Campaign Name (Step 1).');
      return false;
    }
    if (!campaignTitle.trim()) {
      toast.error('Please enter a Campaign Headline / Title (Step 2).');
      return false;
    }
    if (!campaignMessage.trim()) {
      toast.error('Please enter the Message Body (Step 2).');
      return false;
    }
    if (scheduleType === 'schedule') {
      if (!scheduledDate || !scheduledTime) {
        toast.error('Please select both date and time for scheduled dispatch.');
        return false;
      }
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (scheduledAt <= new Date()) {
        toast.error('Scheduled dispatch time must be in the future.');
        return false;
      }
    }
    return true;
  };

  // Open confirmation modal
  const handleReviewClick = () => {
    if (!validateForm()) return;
    setShowConfirmModal(true);
  };

  // Save campaign as draft
  const handleSaveDraft = async () => {
    if (!campaignName.trim()) {
      toast.error('Please enter at least a Campaign Name to save as draft.');
      return;
    }
    setSubmittingCampaign(true);
    try {
      const payload = {
        name: campaignName.trim(),
        title: campaignTitle.trim() || 'Draft Campaign',
        message: campaignMessage.trim() || 'Draft Campaign Message',
        channel: campaignChannel,
        audienceType,
        audienceFilter,
        offerCode: offerCode.trim().toUpperCase(),
        scheduledAt: null,
        sendImmediately: false,
      };
      const { data } = await api.post('/marketing/campaigns', payload);
      toast.success('Campaign saved as draft!');
      setShowConfirmModal(false);

      // Reset form
      setCampaignName('');
      setCampaignTitle('');
      setCampaignMessage('');
      setOfferCode('');
      setScheduleType('now');
      setScheduledDate('');
      setScheduledTime('');

      setActiveTab('campaigns');
      fetchCampaigns();
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Failed to save draft');
    } finally {
      setSubmittingCampaign(false);
    }
  };

  // Send test message directly to device or open in real WhatsApp
  const handleSendTest = async (mode = 'auto') => {
    if (!testPhone.trim()) {
      toast.error('Please enter your mobile number (e.g. 6359781054).');
      return;
    }

    // Clean phone number (Indian default 10-digits -> 91...)
    let digits = testPhone.trim().replace(/[^\d]/g, '');
    if (digits.length === 10) digits = '91' + digits;

    const formattedTitle = campaignTitle.trim() || '☕ Weekend Special at Brewhaus Café!';
    const formattedBody = campaignMessage.trim() || 'Get 20% OFF on all handcrafted coffee this weekend. Visit us today!';
    const code = offerCode.trim().toUpperCase() || 'BREW20';
    const fullMessage = `*${formattedTitle}*\n\n${formattedBody}${code ? `\n\nUse Promo Code: *${code}*` : ''}\n\nVisit Brewhaus Café`;
    const directUrl = `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(fullMessage)}`;

    // If user explicitly chose direct WhatsApp or channel is WhatsApp, open WhatsApp Web/App immediately!
    if (mode === 'direct' || campaignChannel === 'whatsapp' || campaignChannel === 'all') {
      window.open(directUrl, '_blank');
      toast.success(`Opening real WhatsApp chat for +${digits}...`);
    }

    setTestSending(true);
    try {
      const { data } = await api.post('/marketing/test-dispatch', {
        channel: campaignChannel,
        phone: testPhone.trim(),
        title: formattedTitle,
        message: formattedBody,
        offerCode: code,
      });

      if (data.directWhatsAppUrl && mode !== 'direct' && !data.result?.providerMessageId?.startsWith('wa_')) {
        window.open(data.directWhatsAppUrl, '_blank');
      }

      toast.success(data.message || 'Test message dispatched!');
    } catch (err) {
      toast.error(err.message || 'Failed to dispatch test message');
    } finally {
      setTestSending(false);
    }
  };

  // Sync historical orders into customer CRM profiles
  const handleSyncOrders = async () => {
    setSyncingOrders(true);
    try {
      const { data } = await api.post('/marketing/sync-orders');
      toast.success(`Successfully synced ${data.syncedOrders || 0} orders to CRM profiles!`);
      fetchStats();
      estimateAudience();
    } catch (err) {
      toast.error(err.message || 'Failed to sync orders');
    } finally {
      setSyncingOrders(false);
    }
  };

  // Submit Create Campaign
  const handleCreateCampaignSubmit = async () => {
    if (!validateForm()) return;

    setSubmittingCampaign(true);
    try {
      let scheduledAt = null;
      if (scheduleType === 'schedule') {
        if (!scheduledDate || !scheduledTime) {
          toast.error('Please select both date and time for scheduled send.');
          setSubmittingCampaign(false);
          return;
        }
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
        if (scheduledAt <= new Date()) {
          toast.error('Scheduled time must be in the future.');
          setSubmittingCampaign(false);
          return;
        }
      }

      const payload = {
        name: campaignName.trim(),
        title: campaignTitle.trim(),
        message: campaignMessage.trim(),
        channel: campaignChannel,
        audienceType,
        audienceFilter,
        offerCode: offerCode.trim().toUpperCase(),
        scheduledAt,
        sendImmediately: scheduleType === 'now',
      };

      const { data } = await api.post('/marketing/campaigns', payload);
      toast.success(data.message || 'Campaign processed successfully!');
      setShowConfirmModal(false);

      // Reset form
      setCampaignName('');
      setCampaignTitle('');
      setCampaignMessage('');
      setOfferCode('');
      setScheduleType('now');
      setScheduledDate('');
      setScheduledTime('');

      // Navigate to Campaigns tab
      setActiveTab('campaigns');
      fetchCampaigns();
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Failed to create campaign');
    } finally {
      setSubmittingCampaign(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      await api.put('/marketing/settings', settings);
      toast.success('Marketing settings and anti-spam rules updated!');
    } catch (err) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  // Apply template helper
  const applyTemplate = (tpl) => {
    setCampaignTitle(tpl.title);
    setCampaignMessage(tpl.content);
    setOfferCode(tpl.code);
    toast.success(`Loaded template "${tpl.title}"`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso-900">Marketing & Offers</h1>
          <p className="text-xs text-stone-500">Create targeted campaigns, broadcast offers, and monitor message delivery</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('create')}
            className="btn-primary text-xs py-2 px-3.5 inline-flex items-center gap-1.5 shadow-soft"
          >
            <Plus size={15} /> Create Campaign
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-stone-200 overflow-x-auto gap-6 text-xs font-semibold">
        {[
          { id: 'overview', label: 'Overview & Analytics', icon: Sparkles },
          { id: 'campaigns', label: 'Campaigns History', icon: Megaphone },
          { id: 'create', label: 'Create Campaign', icon: Send },
          { id: 'audience', label: 'Audience Segments', icon: Users },
          { id: 'settings', label: 'Templates & Anti-Spam', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 border-b-2 transition whitespace-nowrap ${
                active
                  ? 'border-espresso-900 text-espresso-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: OVERVIEW & ANALYTICS                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Opted-In Guests', value: stats?.metrics?.optedInCustomers, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Campaigns Sent', value: stats?.metrics?.campaignsSent, icon: Megaphone, color: 'text-brew-600', bg: 'bg-brew-50' },
              { label: 'Messages Sent', value: stats?.metrics?.messagesSent, icon: Send, color: 'text-sky-600', bg: 'bg-sky-50' },
              { label: 'Delivered', value: stats?.metrics?.messagesDelivered, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Failed', value: stats?.metrics?.messagesFailed, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
              { label: 'Delivery Rate', value: `${stats?.metrics?.deliveryRate || 100}%`, icon: ShieldCheck, color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-stone-400">{kpi.label}</span>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${kpi.bg} ${kpi.color}`}>
                      <Icon size={14} />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold text-stone-900">
                    {statsLoading ? '—' : kpi.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Growth Chart */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold text-espresso-900">Customer & Opt-In Growth</h3>
                  <p className="text-xs text-stone-400">Total café customers vs marketing opted-in subscribers</p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  Consent Compliant
                </span>
              </div>
              <div className="h-64">
                {stats?.growthData?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1a0f08" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#1a0f08" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c96b18" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#c96b18" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1ece6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#78716c' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="totalCustomers" name="Total Customers" stroke="#1a0f08" fillOpacity={1} fill="url(#totalGrad)" />
                      <Area type="monotone" dataKey="optedIn" name="Opted-In Customers" stroke="#c96b18" fillOpacity={1} fill="url(#optGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-stone-400 text-xs">No chart data yet.</div>
                )}
              </div>
            </div>

            {/* Channel Performance Breakdown */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
              <h3 className="font-display text-base font-bold text-espresso-900 mb-1">Channel Breakdown</h3>
              <p className="text-xs text-stone-400 mb-4">Message distribution across communication channels</p>

              <div className="space-y-4">
                {[
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                  { id: 'sms', label: 'SMS Gateway', icon: Smartphone, color: 'text-sky-700 bg-sky-50 border-sky-200' },
                  { id: 'push', label: 'Browser Push', icon: Bell, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                ].map((ch) => {
                  const chStat = stats?.channelStats?.find((c) => c._id === ch.id);
                  const count = chStat?.total || 0;
                  const delivered = chStat?.delivered || 0;
                  const pct = count > 0 ? Math.round((delivered / count) * 100) : 100;
                  const Icon = ch.icon;

                  return (
                    <div key={ch.id} className="rounded-xl border border-stone-100 p-3 bg-stone-50/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg border ${ch.color}`}>
                            <Icon size={14} />
                          </div>
                          <span className="text-xs font-semibold text-stone-800">{ch.label}</span>
                        </div>
                        <span className="text-xs font-bold text-stone-900">{count} sent</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span>Delivered: {delivered}</span>
                        <span className="font-medium text-emerald-600">{pct}% Success</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Campaigns Overview */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-bold text-espresso-900">Recent Campaigns</h3>
                <p className="text-xs text-stone-400">Latest marketing broadcasts</p>
              </div>
              <button
                onClick={() => setActiveTab('campaigns')}
                className="text-xs font-semibold text-brew-600 hover:text-brew-800 inline-flex items-center gap-1"
              >
                View All History <ArrowRight size={13} />
              </button>
            </div>

            {!stats?.recentCampaigns || stats.recentCampaigns.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-xs">
                No campaigns launched yet. Click "Create Campaign" to send your first offer!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-[0.08em] bg-stone-50">
                    <tr>
                      <th className="px-3 py-2.5">Campaign</th>
                      <th className="px-3 py-2.5">Channel</th>
                      <th className="px-3 py-2.5 text-center">Recipients</th>
                      <th className="px-3 py-2.5 text-center">Delivered</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3 py-2.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {stats.recentCampaigns.slice(0, 5).map((camp) => (
                      <tr key={camp._id} className="hover:bg-stone-50/50">
                        <td className="px-3 py-2.5 font-semibold text-stone-900">{camp.name}</td>
                        <td className="px-3 py-2.5 uppercase font-medium text-stone-600">{camp.channel}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-stone-800">{camp.totalRecipients || 0}</td>
                        <td className="px-3 py-2.5 text-center text-emerald-600 font-bold">{camp.totalDelivered || 0}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            camp.status === 'sent'
                              ? 'bg-emerald-50 text-emerald-700'
                              : camp.status === 'scheduled'
                              ? 'bg-amber-50 text-amber-700'
                              : camp.status === 'sending'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-stone-100 text-stone-700'
                          }`}>
                            {camp.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-stone-400">
                          {new Date(camp.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
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

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: CAMPAIGNS LIST & HISTORY                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-stone-500">
              Total <span className="font-bold text-stone-800">{totalCampaigns}</span> campaigns launched
            </div>
            <button
              onClick={fetchCampaigns}
              className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 p-1.5 rounded-lg border border-stone-200"
            >
              <RefreshCw size={13} className={campaignsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 bg-stone-50 font-semibold uppercase tracking-[0.08em] text-stone-500">
                  <tr>
                    <th className="px-4 py-3.5">Campaign Name</th>
                    <th className="px-4 py-3.5">Channel</th>
                    <th className="px-4 py-3.5">Offer Code</th>
                    <th className="px-4 py-3.5 text-center">Recipients</th>
                    <th className="px-4 py-3.5 text-center">Delivered</th>
                    <th className="px-4 py-3.5 text-center">Failed</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5">Scheduled / Sent</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {campaignsLoading ? (
                    <tr>
                      <td colSpan="9" className="py-16 text-center text-stone-400">
                        <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                        Loading campaign history...
                      </td>
                    </tr>
                  ) : campaigns.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-16 text-center text-stone-400">
                        No campaigns found. Launch your first campaign by clicking "Create Campaign".
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((camp) => (
                      <tr key={camp._id} className="transition hover:bg-stone-50/60">
                        <td className="px-4 py-3">
                          <div className="font-bold text-stone-900">{camp.name}</div>
                          <div className="text-[10px] text-stone-400 truncate max-w-[200px]">{camp.title}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 text-stone-700">
                            {camp.channel}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-brew-700 font-bold">
                          {camp.offerCode || '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-stone-800">
                          {camp.totalRecipients || 0}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-emerald-600">
                          {camp.totalDelivered || 0}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-rose-600">
                          {camp.totalFailed || 0}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            camp.status === 'sent'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : camp.status === 'scheduled'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : camp.status === 'sending'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : camp.status === 'partially_failed'
                              ? 'bg-orange-50 text-orange-700 border border-orange-200'
                              : camp.status === 'failed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-stone-100 text-stone-600'
                          }`}>
                            {camp.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-500">
                          {camp.scheduledAt
                            ? new Date(camp.scheduledAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : new Date(camp.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openCampaignReport(camp)}
                              title="View Delivery Report"
                              className="inline-flex h-7 px-2.5 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                            >
                              <Eye size={12} className="mr-1" /> Report
                            </button>

                            {camp.status === 'draft' && (
                              <button
                                onClick={() => handleTriggerSend(camp._id)}
                                className="inline-flex h-7 px-2 items-center justify-center rounded-lg bg-brew-600 text-white text-[11px] font-semibold hover:bg-brew-700"
                              >
                                Send
                              </button>
                            )}

                            {camp.status === 'scheduled' && (
                              <button
                                onClick={() => handleCancelCampaign(camp._id)}
                                className="inline-flex h-7 px-2 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 text-[11px] font-semibold hover:bg-red-100"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: CREATE CAMPAIGN WIZARD WITH LIVE PREVIEW & CONFIRMATION      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'create' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Form (8 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft space-y-5">
              <h2 className="font-display text-lg font-bold text-espresso-900 border-b border-stone-100 pb-3">
                1. Campaign Identity & Channel
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Weekend Coffee Special 20% OFF"
                    className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:border-espresso-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1.5">Communication Channel *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {CHANNELS.map((ch) => {
                      const Icon = ch.icon;
                      const selected = campaignChannel === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setCampaignChannel(ch.id)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition text-left ${
                            selected
                              ? 'border-espresso-900 bg-espresso-900 text-white'
                              : 'border-stone-200 bg-stone-50/50 text-stone-700 hover:border-stone-300'
                          }`}
                        >
                          <Icon size={18} />
                          <span className="font-semibold text-xs">{ch.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Message Content */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft space-y-5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h2 className="font-display text-lg font-bold text-espresso-900">
                  2. Message Content & Offer
                </h2>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-stone-400">Quick template:</span>
                  <select
                    onChange={(e) => {
                      const tpl = PREAPPROVED_TEMPLATES[e.target.value];
                      if (tpl) applyTemplate(tpl);
                    }}
                    defaultValue=""
                    className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700"
                  >
                    <option value="" disabled>Select template</option>
                    {PREAPPROVED_TEMPLATES.map((t, idx) => (
                      <option key={t.title} value={idx}>{t.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Campaign Headline / Title *</label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    placeholder="e.g. ☕ Weekend Special at Brewhaus Café!"
                    className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:border-espresso-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-stone-700">Message Body *</label>
                    <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
                      <span>Insert:</span>
                      <button
                        type="button"
                        onClick={() => setCampaignMessage((m) => m + ' {{name}}')}
                        className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 hover:bg-stone-200 font-mono"
                      >
                        {`{{name}}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCampaignMessage((m) => m + ' {{code}}')}
                        className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 hover:bg-stone-200 font-mono"
                      >
                        {`{{code}}`}
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={campaignMessage}
                    onChange={(e) => setCampaignMessage(e.target.value)}
                    rows="4"
                    placeholder="e.g. Get 20% OFF on all coffee this Saturday & Sunday. Visit us today! Use code: {{code}}"
                    className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-espresso-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Offer Code (Optional)</label>
                    <input
                      type="text"
                      value={offerCode}
                      onChange={(e) => setOfferCode(e.target.value.toUpperCase())}
                      placeholder="e.g. BREW20"
                      className="w-full rounded-xl border border-stone-200 p-2.5 text-xs font-mono font-bold focus:border-espresso-500 focus:outline-none uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Audience Segmentation */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft space-y-5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-espresso-900">
                    3. Target Audience Segmentation
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">Select which café guests receive this campaign</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">Matching audience:</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display font-bold text-xs ${
                    estimatedRecipients > 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {estimating ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      `${estimatedRecipients} Guest${estimatedRecipients === 1 ? '' : 's'}`
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={estimateAudience}
                    title="Recalculate matching audience"
                    className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition"
                  >
                    <RefreshCw size={13} className={estimating ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {AUDIENCE_TYPES.map((aud) => {
                    const selected = audienceType === aud.id;
                    return (
                      <button
                        key={aud.id}
                        type="button"
                        onClick={() => setAudienceType(aud.id)}
                        className={`p-3 rounded-xl border-2 text-left transition ${
                          selected
                            ? 'border-espresso-900 bg-stone-50 text-espresso-900'
                            : 'border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="font-semibold text-xs">{aud.label}</div>
                        <div className="text-[10px] text-stone-500 mt-0.5">{aud.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Filters Builder */}
                {audienceType === 'custom' && (
                  <div className="rounded-xl border border-foam bg-stone-50/70 p-4 space-y-3 text-xs">
                    <span className="font-bold text-stone-700 block">Custom Segmentation Criteria:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-1">Min Orders</label>
                        <input
                          type="number"
                          value={audienceFilter.minOrders}
                          onChange={(e) => setAudienceFilter({ ...audienceFilter, minOrders: e.target.value })}
                          placeholder="e.g. 2"
                          className="w-full rounded-lg border border-stone-200 bg-white p-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-1">Max Orders</label>
                        <input
                          type="number"
                          value={audienceFilter.maxOrders}
                          onChange={(e) => setAudienceFilter({ ...audienceFilter, maxOrders: e.target.value })}
                          placeholder="e.g. 10"
                          className="w-full rounded-lg border border-stone-200 bg-white p-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-1">Min Spent (₹)</label>
                        <input
                          type="number"
                          value={audienceFilter.minSpent}
                          onChange={(e) => setAudienceFilter({ ...audienceFilter, minSpent: e.target.value })}
                          placeholder="e.g. 1500"
                          className="w-full rounded-lg border border-stone-200 bg-white p-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 block mb-1">Days Inactive</label>
                        <input
                          type="number"
                          value={audienceFilter.maxDaysInactive}
                          onChange={(e) => setAudienceFilter({ ...audienceFilter, maxDaysInactive: e.target.value })}
                          placeholder="e.g. 30"
                          className="w-full rounded-lg border border-stone-200 bg-white p-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 4: Dispatch & Schedule */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft space-y-5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h2 className="font-display text-lg font-bold text-espresso-900">
                  4. Schedule & Dispatch
                </h2>
                <span className="text-[11px] font-medium text-stone-400">
                  Step 4 of 4
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleType('now')}
                  className={`p-3 rounded-xl border-2 font-semibold text-xs text-center transition flex items-center justify-center gap-2 ${
                    scheduleType === 'now'
                      ? 'border-espresso-900 bg-espresso-900 text-white shadow-sm'
                      : 'border-stone-200 bg-stone-50/50 hover:border-stone-300 text-stone-700'
                  }`}
                >
                  <Send size={14} /> Send Immediately
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('schedule')}
                  className={`p-3 rounded-xl border-2 font-semibold text-xs text-center transition flex items-center justify-center gap-2 ${
                    scheduleType === 'schedule'
                      ? 'border-espresso-900 bg-espresso-900 text-white shadow-sm'
                      : 'border-stone-200 bg-stone-50/50 hover:border-stone-300 text-stone-700'
                  }`}
                >
                  <Clock size={14} /> Schedule for Later
                </button>
              </div>

              {scheduleType === 'schedule' && (
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">Dispatch Date *</label>
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full rounded-xl border border-stone-200 bg-white p-2.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">Dispatch Time (Asia/Kolkata) *</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full rounded-xl border border-stone-200 bg-white p-2.5 text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    💡 The system will automatically evaluate matching opted-in customers at the scheduled moment.
                  </p>
                </div>
              )}

              {/* Audience Match Summary Alert */}
              {estimatedRecipients > 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-start gap-2.5 text-xs text-emerald-800">
                  <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold text-emerald-900">
                      Ready to dispatch to {estimatedRecipients} opted-in guest{estimatedRecipients === 1 ? '' : 's'}
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      All recipients have verified consent and comply with the café's anti-spam frequency rules.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-2.5 text-xs text-amber-800">
                  <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold text-amber-900">
                      0 opted-in customers currently match this filter
                    </div>
                    <div className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                      You can still <strong>Save as Draft</strong> to dispatch later, <strong>Schedule</strong> it for later (it queries guests dynamically when fired), or adjust your filter in Step 3.
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: Review & Send + Save Draft */}
              <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleReviewClick}
                  className="w-full sm:flex-1 btn-primary justify-center text-xs sm:text-sm py-3 shadow-md inline-flex items-center gap-2"
                >
                  <Megaphone size={16} />
                  {scheduleType === 'schedule' ? 'Review & Schedule Campaign' : 'Review & Send Campaign'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={submittingCampaign}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {submittingCampaign ? <Loader2 size={14} className="animate-spin" /> : 'Save as Draft'}
                </button>
              </div>

              {/* Real Test Message Dispatcher */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 text-sm">📲</span>
                    <div>
                      <span className="font-bold text-xs text-espresso-900 block">Send Real Test to Your Phone</span>
                      <span className="text-[10px] text-stone-500">Instant delivery directly to your personal WhatsApp or device</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    {campaignChannel}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Enter mobile number (e.g. 6359781054 or +919876543210)"
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs font-mono font-medium focus:border-emerald-600 focus:outline-none shadow-inner"
                  />

                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-0.5">
                    {/* Primary Instant Real WhatsApp Button */}
                    <button
                      type="button"
                      onClick={() => handleSendTest('direct')}
                      className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-[#25D366] text-white hover:bg-[#1EBE5D] text-xs font-bold inline-flex items-center justify-center gap-2 transition shadow-md"
                    >
                      <MessageSquare size={15} />
                      <span>Open & Send via WhatsApp Now</span>
                    </button>

                    {/* Gateway API Button */}
                    <button
                      type="button"
                      onClick={() => handleSendTest('auto')}
                      disabled={testSending}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-espresso-900 text-white hover:bg-espresso-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                      title="Dispatch using configured background Meta Cloud API / Twilio gateway"
                    >
                      {testSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      <span>Dispatch via API</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1">
                    <span>💡 Clicking "Open & Send via WhatsApp Now" opens real WhatsApp with pre-filled message.</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="text-brew-700 font-semibold underline hover:text-brew-900 ml-2 shrink-0"
                    >
                      Configure Cloud API & Twilio →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Mobile Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-6">
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <h3 className="font-display text-sm font-bold text-espresso-900 flex items-center gap-1.5">
                    <Smartphone size={15} /> Live Message Preview
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-brew-600">
                    {campaignChannel}
                  </span>
                </div>

                {/* Mobile Preview Frame */}
                <div className="mx-auto max-w-[280px] rounded-[2.2rem] border-4 border-espresso-900 bg-stone-100 p-2 shadow-2xl">
                  {/* Speaker notch */}
                  <div className="h-4 w-24 bg-espresso-900 rounded-full mx-auto mb-2" />

                  {/* Screen Content */}
                  <div className="rounded-[1.6rem] bg-white overflow-hidden border border-stone-200 min-h-[380px] flex flex-col justify-between text-xs">
                    {/* App Header */}
                    <div className="bg-espresso-900 text-white p-3 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brew-500 font-display font-bold text-[10px] text-white">
                        B
                      </div>
                      <div>
                        <div className="font-display font-bold text-xs">Brewhaus Café</div>
                        <div className="text-[9px] text-espresso-300">Verified Business</div>
                      </div>
                    </div>

                    {/* Chat Area / Message Bubble */}
                    <div className="p-3 flex-1 flex flex-col justify-end space-y-2 bg-[#efeae2]">
                      <div className="rounded-2xl bg-white p-3.5 shadow-sm space-y-2.5 max-w-[95%]">
                        <div className="font-display font-bold text-sm text-espresso-900 leading-tight">
                          {campaignTitle || '☕ Weekend Special at Brewhaus!'}
                        </div>
                        <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">
                          {campaignMessage
                            ? campaignMessage
                                .replace(/{{\s*name\s*}}/gi, 'John')
                                .replace(/{{\s*offer\s*}}/gi, campaignTitle || 'Special Offer')
                                .replace(/{{\s*code\s*}}/gi, offerCode || 'BREW20')
                            : 'Get 20% OFF on all handcrafted coffee this weekend. Visit us today!'}
                        </p>

                        {offerCode && (
                          <div className="rounded-xl bg-brew-50 border border-brew-200 p-2 text-center">
                            <span className="text-[10px] text-brew-600 block uppercase font-bold tracking-wider">Use Promo Code</span>
                            <span className="font-mono text-sm font-bold text-brew-900 tracking-wider">{offerCode}</span>
                          </div>
                        )}

                        <div className="text-[9px] text-stone-400 text-right">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                        </div>
                      </div>
                    </div>

                    {/* Call to action footer */}
                    <div className="p-2.5 border-t border-stone-200 bg-stone-50 text-center text-[10px] text-stone-500">
                      Visit Brewhaus Café · Terms & Conditions apply
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-stone-50 p-3 text-[11px] text-stone-600 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-700">Safety Check:</span>
                    <span className="text-emerald-700 font-bold">✓ Opt-in Only</span>
                  </div>
                  <div className="text-stone-500">
                    Never dispatched to unsubscribed or blocked customers. Frequency capping active (max 3/month).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: AUDIENCE SEGMENTS EXPLORER                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'audience' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE_TYPES.map((aud) => (
              <div key={aud.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-base text-espresso-900">{aud.label}</span>
                  <span className="rounded-full bg-brew-50 px-2.5 py-1 text-xs font-bold text-brew-700">
                    Segment
                  </span>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">{aud.desc}</p>
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setAudienceType(aud.id);
                      setActiveTab('create');
                    }}
                    className="text-xs font-semibold text-brew-600 hover:text-brew-800 inline-flex items-center gap-1"
                  >
                    Target in Campaign <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: TEMPLATES & ANTI-SPAM SETTINGS                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft space-y-5">
            <div className="flex items-center gap-2.5 border-b border-stone-100 pb-3">
              <ShieldCheck size={20} className="text-emerald-600" />
              <div>
                <h3 className="font-display text-base font-bold text-espresso-900">Anti-Spam Frequency Capping</h3>
                <p className="text-xs text-stone-500">Protect café customer goodwill and prevent message fatigue</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Max Promotional Messages per Customer
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.maxPromotionsPerCustomerPeriod}
                  onChange={(e) => setSettings({ ...settings, maxPromotionsPerCustomerPeriod: e.target.value })}
                  className="w-full max-w-xs rounded-xl border border-stone-200 p-2 text-xs"
                />
                <p className="text-[11px] text-stone-400 mt-1">Default recommendation is 3 messages</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Time Window (Days)
                </label>
                <input
                  type="number"
                  min="7"
                  max="90"
                  value={settings.periodDays}
                  onChange={(e) => setSettings({ ...settings, periodDays: e.target.value })}
                  className="w-full max-w-xs rounded-xl border border-stone-200 p-2 text-xs"
                />
                <p className="text-[11px] text-stone-400 mt-1">Default window is 30 days</p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveSettings}
                  disabled={settingsLoading}
                  className="btn-primary text-xs py-2 px-4"
                >
                  {settingsLoading ? 'Saving...' : 'Save Anti-Spam Policy'}
                </button>
              </div>
            </div>
          </div>

          {/* API Gateway Configuration Card */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <MessageSquare size={20} className="text-emerald-600" />
                <div>
                  <h3 className="font-display text-base font-bold text-espresso-900">API Gateway Configuration</h3>
                  <p className="text-xs text-stone-500">Configure Meta WhatsApp Business Cloud API & Twilio for automated background dispatch</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                settings.whatsappCloud?.accessToken && settings.whatsappCloud?.phoneNumberId
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {settings.whatsappCloud?.accessToken && settings.whatsappCloud?.phoneNumberId
                  ? '✓ Meta Cloud API Connected'
                  : 'Direct WhatsApp Active'}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="rounded-xl bg-stone-50 p-3 text-[11px] text-stone-600 space-y-1.5 border border-stone-200">
                <div className="font-bold text-stone-800">📱 Two Real Messaging Options:</div>
                <div>
                  <strong>1. Direct WhatsApp (Active with Zero Setup):</strong> When you click "Open & Send via WhatsApp Now" in campaigns or tests, WhatsApp Web or App opens with the customer's phone number and pre-filled offer text.
                </div>
                <div>
                  <strong>2. Automated Meta Cloud API:</strong> For automated background sending to all customers at once, paste your Meta Graph API Token & Phone Number ID below from <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-brew-700 underline font-semibold">developers.facebook.com</a>.
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <h4 className="font-bold text-xs text-stone-800 uppercase tracking-wider">Meta WhatsApp Cloud API</h4>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    WhatsApp Access Token (Permanent / System User Token)
                  </label>
                  <input
                    type="password"
                    value={settings.whatsappCloud?.accessToken || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      whatsappCloud: { ...settings.whatsappCloud, accessToken: e.target.value }
                    })}
                    placeholder="EAAB..."
                    className="w-full rounded-xl border border-stone-200 p-2.5 font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      WhatsApp Phone Number ID
                    </label>
                    <input
                      type="text"
                      value={settings.whatsappCloud?.phoneNumberId || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        whatsappCloud: { ...settings.whatsappCloud, phoneNumberId: e.target.value }
                      })}
                      placeholder="e.g. 100609349424..."
                      className="w-full rounded-xl border border-stone-200 p-2.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      Business Account ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={settings.whatsappCloud?.businessAccountId || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        whatsappCloud: { ...settings.whatsappCloud, businessAccountId: e.target.value }
                      })}
                      placeholder="e.g. 1067204928..."
                      className="w-full rounded-xl border border-stone-200 p-2.5 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-stone-100">
                <h4 className="font-bold text-xs text-stone-800 uppercase tracking-wider">Twilio Gateway (Optional Alternative)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Account SID</label>
                    <input
                      type="text"
                      value={settings.twilio?.accountSid || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        twilio: { ...settings.twilio, accountSid: e.target.value }
                      })}
                      placeholder="AC..."
                      className="w-full rounded-xl border border-stone-200 p-2.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Auth Token</label>
                    <input
                      type="password"
                      value={settings.twilio?.authToken || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        twilio: { ...settings.twilio, authToken: e.target.value }
                      })}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-stone-200 p-2.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">From Number</label>
                    <input
                      type="text"
                      value={settings.twilio?.phoneNumber || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        twilio: { ...settings.twilio, phoneNumber: e.target.value }
                      })}
                      placeholder="+1234567890"
                      className="w-full rounded-xl border border-stone-200 p-2.5 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={settingsLoading}
                  className="btn-primary text-xs py-2.5 px-4 inline-flex items-center gap-2"
                >
                  {settingsLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  <span>Save Gateway Credentials</span>
                </button>
              </div>
            </div>
          </div>

          {/* Legacy Order Sync Card */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft space-y-4">
            <div className="flex items-center gap-2.5 border-b border-stone-100 pb-3">
              <RefreshCw size={20} className="text-brew-600" />
              <div>
                <h3 className="font-display text-base font-bold text-espresso-900">Historical Customer Sync</h3>
                <p className="text-xs text-stone-500">Sync all past café orders into CRM profiles & calculate lifetime metrics</p>
              </div>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              If new orders were placed before CRM tracking or imported from external systems, click below to recalculate customer order history, lifetime spending, and marketing opt-in statuses.
            </p>
            <div>
              <button
                type="button"
                onClick={handleSyncOrders}
                disabled={syncingOrders}
                className="inline-flex items-center gap-2 rounded-xl border border-brew-200 bg-brew-50 text-brew-800 hover:bg-brew-100 px-4 py-2 text-xs font-semibold transition"
              >
                <RefreshCw size={13} className={syncingOrders ? 'animate-spin' : ''} />
                <span>{syncingOrders ? 'Syncing Past Orders...' : 'Sync Orders to Customers Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CAMPAIGN SAFETY CONFIRMATION MODAL                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showConfirmModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmModal(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-stone-200">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brew-100 text-brew-700">
                    <Megaphone size={20} />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-espresso-900">
                      {scheduleType === 'schedule' ? 'Confirm Campaign Schedule' : 'Campaign Safety & Dispatch'}
                    </h3>
                    <p className="text-xs text-stone-500">Review parameters before proceeding</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-stone-50 border border-stone-200 p-4 space-y-2.5 text-xs text-stone-700">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Campaign Name:</span>
                    <span className="font-bold text-stone-900 text-right">{campaignName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Audience Segment:</span>
                    <span className="font-bold text-stone-900 capitalize">{audienceType.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Communication Channel:</span>
                    <span className="font-bold uppercase text-stone-900">{campaignChannel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Eligible Recipients:</span>
                    <span className={`font-bold ${estimatedRecipients > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {estimatedRecipients} Opted-In Guest{estimatedRecipients === 1 ? '' : 's'}
                    </span>
                  </div>
                  {offerCode && (
                    <div className="flex justify-between">
                      <span className="text-stone-400">Promo Code:</span>
                      <span className="font-mono font-bold text-brew-700">{offerCode}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-stone-400">Dispatch Timing:</span>
                    <span className="font-bold text-brew-700">
                      {scheduleType === 'now' ? 'Send Immediately' : `${scheduledDate} at ${scheduledTime}`}
                    </span>
                  </div>
                </div>

                {estimatedRecipients === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle size={14} className="text-amber-600" />
                      0 customers currently match this filter
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      No immediate messages will be dispatched. You can <strong>Save as Draft</strong> to keep your content, or <strong>Schedule for Later</strong> so it reaches guests who qualify by that time.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    ✓ Only customers with verified marketing consent will receive this offer. Unsubscribed and frequency-capped customers are strictly excluded.
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="btn-secondary text-xs py-2 px-3.5"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={submittingCampaign}
                    className="px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 text-xs font-semibold transition"
                  >
                    Save as Draft
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateCampaignSubmit}
                    disabled={submittingCampaign}
                    className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
                  >
                    {submittingCampaign ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : scheduleType === 'schedule' ? (
                      'Confirm & Schedule'
                    ) : estimatedRecipients > 0 ? (
                      'Confirm & Send Now'
                    ) : (
                      'Queue Campaign'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CAMPAIGN DELIVERY REPORT MODAL                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedCampaign && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCampaign(null)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-2xl max-h-[85vh] rounded-3xl bg-white p-6 shadow-2xl border border-stone-200 flex flex-col">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-espresso-900">{selectedCampaign.name}</h3>
                    <p className="text-xs text-stone-500">Delivery Diagnostics & Failure Audit</p>
                  </div>
                  <button
                    onClick={() => setSelectedCampaign(null)}
                    className="p-1 rounded-full text-stone-400 hover:bg-stone-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
                  {reportLoading ? (
                    <div className="py-12 text-center text-stone-400">
                      <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                      Loading delivery report...
                    </div>
                  ) : (
                    <>
                      {/* Summary Badges */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="rounded-xl bg-stone-50 p-2.5 border border-stone-200">
                          <span className="text-[10px] text-stone-400 block uppercase">Recipients</span>
                          <span className="text-base font-bold text-stone-900">{selectedCampaign.totalRecipients || 0}</span>
                        </div>
                        <div className="rounded-xl bg-sky-50 p-2.5 border border-sky-100 text-sky-800">
                          <span className="text-[10px] text-sky-500 block uppercase">Sent</span>
                          <span className="text-base font-bold">{selectedCampaign.totalSent || 0}</span>
                        </div>
                        <div className="rounded-xl bg-emerald-50 p-2.5 border border-emerald-100 text-emerald-800">
                          <span className="text-[10px] text-emerald-500 block uppercase">Delivered</span>
                          <span className="text-base font-bold">{selectedCampaign.totalDelivered || 0}</span>
                        </div>
                        <div className="rounded-xl bg-rose-50 p-2.5 border border-rose-100 text-rose-800">
                          <span className="text-[10px] text-rose-500 block uppercase">Failed</span>
                          <span className="text-base font-bold">{selectedCampaign.totalFailed || 0}</span>
                        </div>
                      </div>

                      {/* Retry Failed button if failures exist */}
                      {selectedCampaign.totalFailed > 0 && (
                        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-center justify-between">
                          <div className="text-rose-800">
                            <span className="font-bold block">Delivery Failures Detected</span>
                            <span className="text-[11px] text-rose-600">You can safely re-attempt sending to failed recipients only.</span>
                          </div>
                          <button
                            onClick={() => handleRetryFailed(selectedCampaign._id)}
                            disabled={retrying}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            <RotateCcw size={12} className={retrying ? 'animate-spin' : ''} />
                            {retrying ? 'Retrying...' : 'Retry Failed'}
                          </button>
                        </div>
                      )}

                      {/* Deliveries Table */}
                      <div className="rounded-xl border border-stone-200 overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold">
                            <tr>
                              <th className="px-3 py-2">Recipient</th>
                              <th className="px-3 py-2">Phone</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Provider ID</th>
                              <th className="px-3 py-2 text-right">Error / Detail</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {!campaignDetails?.deliveries || campaignDetails.deliveries.length === 0 ? (
                              <tr>
                                <td colSpan="5" className="py-6 text-center text-stone-400">
                                  No delivery records yet.
                                </td>
                              </tr>
                            ) : (
                              campaignDetails.deliveries.map((del) => (
                                <tr key={del._id}>
                                  <td className="px-3 py-2 font-medium text-stone-900">{del.customerId?.name || 'Customer'}</td>
                                  <td className="px-3 py-2 font-mono text-stone-600">{del.recipientPhone || '—'}</td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      del.status === 'delivered'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : del.status === 'failed'
                                        ? 'bg-rose-50 text-rose-700'
                                        : 'bg-stone-100 text-stone-600'
                                    }`}>
                                      {del.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[10px] text-stone-400">
                                    {del.providerMessageId || '—'}
                                  </td>
                                  <td className="px-3 py-2 text-right text-[10px] text-rose-600 truncate max-w-[140px]">
                                    {del.errorMessage || 'Delivered successfully'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
