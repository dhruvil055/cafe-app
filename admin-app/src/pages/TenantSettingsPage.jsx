import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Store,
  Palette,
  Clock,
  CreditCard,
  Percent,
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Sparkles,
  AlertCircle,
  Smartphone,
  QrCode,
  Save,
  CheckCircle2
} from 'lucide-react';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';
import PageHeader from '../components/common/PageHeader';
import ImageUploader from '../components/common/ImageUploader';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const CURRENCY_OPTIONS = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (INR - ₹)' },
  { code: 'USD', symbol: '$', label: 'US Dollar (USD - $)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR - €)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (GBP - £)' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham (AED - د.إ)' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar (CAD - C$)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (AUD - A$)' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar (SGD - S$)' },
];

const TIMEZONE_OPTIONS = [
  { tz: 'Asia/Kolkata', label: 'India Standard Time (Asia/Kolkata, UTC+5:30)' },
  { tz: 'Asia/Dubai', label: 'Gulf Standard Time (Asia/Dubai, UTC+4:00)' },
  { tz: 'Asia/Singapore', label: 'Singapore Standard Time (Asia/Singapore, UTC+8:00)' },
  { tz: 'Europe/London', label: 'London (Europe/London, GMT/BST)' },
  { tz: 'Europe/Paris', label: 'Central European Time (Europe/Paris, CET)' },
  { tz: 'America/New_York', label: 'Eastern Time (America/New_York, EST)' },
  { tz: 'America/Chicago', label: 'Central Time (America/Chicago, CST)' },
  { tz: 'America/Los_Angeles', label: 'Pacific Time (America/Los_Angeles, PST)' },
  { tz: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];

const BRAND_PALETTES = [
  { name: 'Berry Velvet', primary: '#B8284C', accent: '#1a050e' },
  { name: 'Warm Amber', primary: '#c96b18', accent: '#1a0f08' },
  { name: 'Rich Espresso', primary: '#8b4513', accent: '#23120b' },
  { name: 'Golden Roast', primary: '#d97706', accent: '#1e1b18' },
  { name: 'Botanical Matcha', primary: '#059669', accent: '#06281e' },
  { name: 'Midnight Bistro', primary: '#4f46e5', accent: '#0f172a' },
];

const initial = {
  cafeName: '',
  logoUrl: '',
  primaryColor: '#B8284C',
  accentColor: '#1a050e',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  gstNumber: '',
  taxRate: 5,
  address: '',
  contactEmail: '',
  contactPhone: '',
  openingHours: {},
};

export default function TenantSettingsPage() {
  const tenantContext = useTenant();
  const [activeTab, setActiveTab] = useState('brand'); // 'brand' | 'tax' | 'hours' | 'payments' | 'qr'
  const [settings, setSettings] = useState(initial);
  const [payment, setPayment] = useState({
    keyId: '',
    keySecret: '',
    webhookSecret: '',
    configured: false,
    clear: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // Structured hours parsed from openingHours
  const [schedule, setSchedule] = useState(() => {
    const defaultSchedule = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      defaultSchedule[key] = { open: true, from: '09:00', to: '22:00' };
    });
    return defaultSchedule;
  });

  useEffect(() => {
    let isMounted = true;
    api.get('/tenant/settings')
      .then(({ data }) => {
        if (!isMounted) return;
        const tenantData = { ...initial, ...data.tenant };
        setSettings(tenantData);

        // Apply branding immediately to document
        if (tenantData.primaryColor) {
          document.documentElement.style.setProperty('--tenant-primary', tenantData.primaryColor);
        }
        if (tenantData.accentColor) {
          document.documentElement.style.setProperty('--tenant-accent', tenantData.accentColor);
        }

        const rawHours = tenantData.openingHours || {};
        const parsedSchedule = {};
        DAYS_OF_WEEK.forEach(({ key }) => {
          const val = rawHours[key];
          if (val && typeof val === 'string' && val.toLowerCase() !== 'closed') {
            const parts = val.split('-').map((s) => s.trim());
            parsedSchedule[key] = { open: true, from: parts[0] || '09:00', to: parts[1] || '22:00' };
          } else {
            parsedSchedule[key] = { open: val ? false : true, from: '09:00', to: '22:00' };
          }
        });
        setSchedule(parsedSchedule);

        setPayment((current) => ({
          ...current,
          keyId: data.payment?.keyId || '',
          configured: Boolean(data.payment?.configured),
        }));
      })
      .catch((error) => {
        toast.error(error.response?.data?.error || error.message || 'Could not load café settings.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setIsDirty(true);

    // Live update CSS variables for instant theme preview!
    if (key === 'primaryColor') {
      document.documentElement.style.setProperty('--tenant-primary', value);
      tenantContext.setBranding?.({ primaryColor: value });
    }
    if (key === 'accentColor') {
      document.documentElement.style.setProperty('--tenant-accent', value);
      tenantContext.setBranding?.({ accentColor: value });
    }
    if (key === 'cafeName') {
      tenantContext.setBranding?.({ name: value });
    }
    if (key === 'logoUrl') {
      tenantContext.setBranding?.({ logo: value });
    }
  };

  const applyPalette = (palette) => {
    updateSetting('primaryColor', palette.primary);
    updateSetting('accentColor', palette.accent);
    toast.success(`Theme preset "${palette.name}" applied`);
  };

  const handleScheduleChange = (dayKey, field, value) => {
    setSchedule((current) => ({
      ...current,
      [dayKey]: {
        ...current[dayKey],
        [field]: value,
      },
    }));
    setIsDirty(true);
  };

  const copyMondayToAll = () => {
    const monday = schedule.monday || { open: true, from: '09:00', to: '22:00' };
    const updated = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      updated[key] = { ...monday };
    });
    setSchedule(updated);
    setIsDirty(true);
    toast.success('Copied Monday schedule to all days.');
  };

  const save = async (event) => {
    if (event) event.preventDefault();
    if (!settings.cafeName.trim()) {
      toast.error('Café name is required.');
      return;
    }

    const finalOpeningHours = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      const item = schedule[key];
      if (item && item.open) {
        finalOpeningHours[key] = `${item.from} - ${item.to}`;
      } else {
        finalOpeningHours[key] = 'Closed';
      }
    });

    setSaving(true);
    try {
      const body = {
        settings: {
          ...settings,
          cafeName: settings.cafeName.trim(),
          openingHours: finalOpeningHours,
        },
      };

      if (payment.clear) {
        body.payment = { clear: true };
      } else if (payment.keySecret || payment.webhookSecret || payment.keyId) {
        body.payment = {
          keyId: payment.keyId.trim(),
          keySecret: payment.keySecret.trim(),
          webhookSecret: payment.webhookSecret.trim(),
        };
      }

      const { data } = await api.put('/tenant/settings', body);
      setSettings({ ...initial, ...data.tenant });
      setPayment({
        keyId: data.payment.keyId || '',
        keySecret: '',
        webhookSecret: '',
        configured: Boolean(data.payment.configured),
        clear: false,
      });

      // Update runtime theme tokens
      if (data.tenant?.primaryColor) {
        document.documentElement.style.setProperty('--tenant-primary', data.tenant.primaryColor);
        tenantContext.setBranding?.({ primaryColor: data.tenant.primaryColor });
      }
      if (data.tenant?.accentColor) {
        document.documentElement.style.setProperty('--tenant-accent', data.tenant.accentColor);
        tenantContext.setBranding?.({ accentColor: data.tenant.accentColor });
      }

      setIsDirty(false);
      toast.success('Café settings saved successfully!');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings, payment, schedule]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-stone-200 border-t-amber-600" />
      </div>
    );
  }

  const navItems = [
    { id: 'brand', label: 'Brand & Appearance', icon: Palette },
    { id: 'tax', label: 'Tax, Currency & Contact', icon: Percent },
    { id: 'hours', label: 'Opening Hours', icon: Clock },
    { id: 'payments', label: 'Payment Gateway', icon: CreditCard },
    { id: 'qr', label: 'QR & Digital Ordering', icon: QrCode },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      {/* Page Header */}
      <PageHeader
        title="Café Settings"
        subtitle="Customize your brand palette, live QR theme, regional taxation, and payment gateways."
        breadcrumbs={[
          { label: 'Admin', to: '/settings' },
          { label: 'Settings' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/user-panel"
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs transition"
              title="Preview Customer Digital Menu"
            >
              <Smartphone size={14} className="text-amber-600" />
              <span>Preview Customer View</span>
            </Link>
          </div>
        }
      />

      {/* Main 2-column layout: Left sub-navigation + Right active section panel */}
      <div className="grid gap-6 md:grid-cols-4 items-start">
        {/* Left Sub-nav */}
        <div className="md:col-span-1 rounded-3xl border border-stone-200/90 bg-white p-2 shadow-xs space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition text-left ${
                  isActive
                    ? 'bg-espresso-950 text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-amber-400' : 'text-stone-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Section Content */}
        <div className="md:col-span-3 space-y-6">
          {/* TAB 1: BRAND IDENTITY & APPEARANCE */}
          {activeTab === 'brand' && (
            <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-espresso-950">
                  Brand Identity & Visual Theme
                </h3>
                <p className="text-xs text-stone-500">
                  Colors selected here immediately theme both your admin console and customer QR table ordering app.
                </p>
              </div>

              {/* Logo Uploader */}
              <div className="pt-2">
                <ImageUploader
                  value={settings.logoUrl}
                  onChange={(val) => updateSetting('logoUrl', val)}
                  label="Café Brand Logo"
                  fallbackText={settings.cafeName || 'Café'}
                />
              </div>

              {/* Café Name */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Café Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={settings.cafeName}
                  onChange={(e) => updateSetting('cafeName', e.target.value)}
                  placeholder="e.g. Brewhaus Café & Roastery"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Curated Theme Presets */}
              <div className="space-y-2.5 pt-2 border-t border-stone-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                  Curated Brand Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {BRAND_PALETTES.map((palette) => (
                    <button
                      key={palette.name}
                      type="button"
                      onClick={() => applyPalette(palette)}
                      className={`flex items-center gap-2.5 rounded-2xl border p-2.5 transition text-left ${
                        settings.primaryColor?.toLowerCase() === palette.primary.toLowerCase()
                          ? 'border-stone-900 bg-stone-50 ring-2 ring-stone-900/10'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <span
                        className="h-6 w-6 rounded-xl shadow-2xs shrink-0"
                        style={{ backgroundColor: palette.primary }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-stone-900 truncate">{palette.name}</p>
                        <p className="text-[10px] text-stone-400 font-mono">{palette.primary}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Hex Color Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Primary Accent Color (Hex)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.primaryColor || '#B8284C'}
                      onChange={(e) => updateSetting('primaryColor', e.target.value)}
                      className="h-10 w-12 rounded-xl border border-stone-200 cursor-pointer p-1"
                    />
                    <input
                      type="text"
                      value={settings.primaryColor || '#B8284C'}
                      onChange={(e) => updateSetting('primaryColor', e.target.value)}
                      className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono uppercase focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Sidebar Dark Accent (Hex)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.accentColor || '#1a050e'}
                      onChange={(e) => updateSetting('accentColor', e.target.value)}
                      className="h-10 w-12 rounded-xl border border-stone-200 cursor-pointer p-1"
                    />
                    <input
                      type="text"
                      value={settings.accentColor || '#1a050e'}
                      onChange={(e) => updateSetting('accentColor', e.target.value)}
                      className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono uppercase focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TAX, CURRENCY & CONTACT */}
          {activeTab === 'tax' && (
            <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-espresso-950">
                  Tax, Currency & Outlet Contact
                </h3>
                <p className="text-xs text-stone-500">
                  Regional settings printed on customer receipts and used in daily tax settlement.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Currency *
                  </label>
                  <select
                    value={settings.currency}
                    onChange={(e) => updateSetting('currency', e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none font-medium"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Timezone *
                  </label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => updateSetting('timezone', e.target.value)}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none font-medium"
                  >
                    {TIMEZONE_OPTIONS.map((t) => (
                      <option key={t.tz} value={t.tz}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    GSTIN / Tax Registration No.
                  </label>
                  <input
                    type="text"
                    value={settings.gstNumber || ''}
                    onChange={(e) => updateSetting('gstNumber', e.target.value.toUpperCase())}
                    placeholder="e.g. 24ABCDE1234F1Z5"
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono uppercase focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    GST Rate (% applied on bills)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="28"
                    step="0.5"
                    value={settings.taxRate}
                    onChange={(e) => updateSetting('taxRate', Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Physical Address & Contact */}
              <div className="space-y-4 pt-4 border-t border-stone-100">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Storefront Physical Address
                  </label>
                  <textarea
                    rows={2}
                    value={settings.address || ''}
                    onChange={(e) => updateSetting('address', e.target.value)}
                    placeholder="Shop 4, Ground Floor, Indiranagar 100ft Road, Bengaluru, Karnataka"
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={settings.contactEmail || ''}
                      onChange={(e) => updateSetting('contactEmail', e.target.value)}
                      placeholder="support@brewhauscafe.com"
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Support Phone / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={settings.contactPhone || ''}
                      onChange={(e) => updateSetting('contactPhone', e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OPENING HOURS */}
          {activeTab === 'hours' && (
            <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold text-espresso-950">
                    Weekly Operating Hours
                  </h3>
                  <p className="text-xs text-stone-500">
                    Tables will only accept QR orders during operating hours.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyMondayToAll}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
                >
                  Copy Monday to All Days
                </button>
              </div>

              <div className="divide-y divide-stone-100">
                {DAYS_OF_WEEK.map(({ key, label }) => {
                  const day = schedule[key] || { open: true, from: '09:00', to: '22:00' };
                  return (
                    <div key={key} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="w-28 font-bold text-stone-800">
                        {label}
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={day.open}
                            onChange={(e) => handleScheduleChange(key, 'open', e.target.checked)}
                            className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className={day.open ? 'font-semibold text-emerald-700' : 'text-stone-400'}>
                            {day.open ? 'Open' : 'Closed'}
                          </span>
                        </label>

                        {day.open && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="time"
                              value={day.from}
                              onChange={(e) => handleScheduleChange(key, 'from', e.target.value)}
                              className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs"
                            />
                            <span className="text-stone-400">to</span>
                            <input
                              type="time"
                              value={day.to}
                              onChange={(e) => handleScheduleChange(key, 'to', e.target.value)}
                              className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: PAYMENT GATEWAY (RAZORPAY) */}
          {activeTab === 'payments' && (
            <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-espresso-950">
                  Razorpay Payment Gateway Setup
                </h3>
                <p className="text-xs text-stone-500">
                  Enable instant UPI, Google Pay, PhonePe, Paytm, and credit cards directly into your café bank account.
                </p>
              </div>

              {payment.configured ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-200 text-emerald-900">
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <p className="font-bold text-xs text-emerald-950">Razorpay Integration Active</p>
                      <p className="text-[11px] text-emerald-700 font-mono">Key ID: {payment.keyId}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPayment((cur) => ({ ...cur, clear: true, configured: false }))}
                    className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <p className="text-xs text-amber-900 font-semibold">
                    No custom payment gateway attached. Dine-in orders will default to Counter Cash settlement.
                  </p>
                </div>
              )}

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Razorpay Key ID (rzp_live_...)
                  </label>
                  <input
                    type="text"
                    value={payment.keyId}
                    onChange={(e) => {
                      setPayment((cur) => ({ ...cur, keyId: e.target.value, clear: false }));
                      setIsDirty(true);
                    }}
                    placeholder="rzp_live_xxxxxxxxxxxxxxxx"
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Razorpay Key Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showKeySecret ? 'text' : 'password'}
                      value={payment.keySecret}
                      onChange={(e) => {
                        setPayment((cur) => ({ ...cur, keySecret: e.target.value, clear: false }));
                        setIsDirty(true);
                      }}
                      placeholder="••••••••••••••••••••••••"
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono focus:border-amber-500 focus:outline-none pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeySecret(!showKeySecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                    >
                      {showKeySecret ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Webhook Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showWebhookSecret ? 'text' : 'password'}
                      value={payment.webhookSecret}
                      onChange={(e) => {
                        setPayment((cur) => ({ ...cur, webhookSecret: e.target.value, clear: false }));
                        setIsDirty(true);
                      }}
                      placeholder="••••••••••••••••••••••••"
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono focus:border-amber-500 focus:outline-none pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                    >
                      {showWebhookSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: QR & ORDERING PREFERENCES */}
          {activeTab === 'qr' && (
            <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-espresso-950">
                  QR Table Ordering Preferences
                </h3>
                <p className="text-xs text-stone-500">
                  Configure digital menu behavior, kitchen dispatch timers, and customer convenience options.
                </p>
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-3 rounded-2xl border border-stone-200 p-4 cursor-pointer hover:bg-stone-50 transition">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-stone-900">Allow Customer Notes & Cooking Instructions</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">Guests can request customizations like 'Less spicy', 'Oat milk', or 'No onions'.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-stone-200 p-4 cursor-pointer hover:bg-stone-50 transition">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-stone-900">Enable 'Call Waiter' & 'Request Bill' Buttons</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">Alerts front-of-house staff instantly on the Orders live dashboard.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-stone-200 p-4 cursor-pointer hover:bg-stone-50 transition">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-stone-900">Strict Pure-Veg Tag Display</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">Enforces Indian FSSAI green vegetarian icons across all items.</p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Save Bar with Dirty State & Ctrl+S indicator */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-stone-200/90 py-3.5 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            {isDirty ? (
              <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 size={14} />
                All changes saved
              </span>
            )}
            <span className="hidden sm:inline text-stone-400">· Shortcut: Press Ctrl+S to save</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary rounded-xl px-6 py-2.5 text-xs font-bold shadow-md flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
