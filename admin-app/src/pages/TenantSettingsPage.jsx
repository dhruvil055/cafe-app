import { useEffect, useState, useMemo } from 'react';
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
  Trash2,
  Calendar,
  Globe,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import api from '../services/api';

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
  { name: 'Warm Amber', primary: '#c96b18', accent: '#1a0f08' },
  { name: 'Rich Espresso', primary: '#8b4513', accent: '#23120b' },
  { name: 'Golden Roast', primary: '#d97706', accent: '#1e1b18' },
  { name: 'Botanical Matcha', primary: '#059669', accent: '#06281e' },
  { name: 'Berry Velvet', primary: '#be185d', accent: '#1c0a14' },
  { name: 'Midnight Bistro', primary: '#4f46e5', accent: '#0f172a' },
];

const initial = {
  cafeName: '',
  logoUrl: '',
  primaryColor: '#c96b18',
  accentColor: '#1a0f08',
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
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawHoursJson, setRawHoursJson] = useState('{}');

  // Structured hours parsed from openingHours
  const [schedule, setSchedule] = useState(() => {
    const defaultSchedule = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      defaultSchedule[key] = { open: true, from: '09:00', to: '22:00' };
    });
    return defaultSchedule;
  });

  // Load settings on mount
  useEffect(() => {
    let isMounted = true;
    api.get('/tenant/settings')
      .then(({ data }) => {
        if (!isMounted) return;
        const tenantData = { ...initial, ...data.tenant };
        setSettings(tenantData);
        setRawHoursJson(JSON.stringify(tenantData.openingHours || {}, null, 2));

        // Parse structured opening hours
        const rawHours = tenantData.openingHours || {};
        const parsedSchedule = {};
        DAYS_OF_WEEK.forEach(({ key }) => {
          const val = rawHours[key];
          if (val && typeof val === 'string' && val.toLowerCase() !== 'closed') {
            const parts = val.split('-').map((s) => s.trim());
            parsedSchedule[key] = {
              open: true,
              from: parts[0] || '09:00',
              to: parts[1] || '22:00',
            };
          } else {
            parsedSchedule[key] = {
              open: val ? false : true,
              from: '09:00',
              to: '22:00',
            };
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
  };

  const handleScheduleChange = (dayKey, field, value) => {
    setSchedule((current) => {
      const updated = {
        ...current,
        [dayKey]: {
          ...current[dayKey],
          [field]: value,
        },
      };

      // Sync to raw JSON
      const formatted = {};
      DAYS_OF_WEEK.forEach(({ key }) => {
        const item = updated[key];
        if (item.open) {
          formatted[key] = `${item.from} - ${item.to}`;
        } else {
          formatted[key] = 'Closed';
        }
      });
      setRawHoursJson(JSON.stringify(formatted, null, 2));
      return updated;
    });
  };

  const copyMondayToAll = () => {
    const monday = schedule.monday || { open: true, from: '09:00', to: '22:00' };
    const updated = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      updated[key] = { ...monday };
    });
    setSchedule(updated);

    const formatted = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      formatted[key] = monday.open ? `${monday.from} - ${monday.to}` : 'Closed';
    });
    setRawHoursJson(JSON.stringify(formatted, null, 2));
    toast.success('Copied Monday schedule to all days.');
  };

  const handleRawJsonChange = (val) => {
    setRawHoursJson(val);
    try {
      const parsed = JSON.parse(val);
      const updated = {};
      DAYS_OF_WEEK.forEach(({ key }) => {
        const dayVal = parsed[key];
        if (dayVal && typeof dayVal === 'string' && dayVal.toLowerCase() !== 'closed') {
          const parts = dayVal.split('-').map((s) => s.trim());
          updated[key] = { open: true, from: parts[0] || '09:00', to: parts[1] || '22:00' };
        } else {
          updated[key] = { open: false, from: '09:00', to: '22:00' };
        }
      });
      setSchedule(updated);
    } catch {
      // Allow invalid typing while in textarea
    }
  };

  const save = async (event) => {
    if (event) event.preventDefault();
    if (!settings.cafeName.trim()) {
      toast.error('Café name is required.');
      return;
    }

    let finalOpeningHours = {};
    if (rawJsonMode) {
      try {
        finalOpeningHours = JSON.parse(rawHoursJson);
      } catch {
        toast.error('Opening hours must be valid JSON.');
        return;
      }
    } else {
      DAYS_OF_WEEK.forEach(({ key }) => {
        const item = schedule[key];
        if (item && item.open) {
          finalOpeningHours[key] = `${item.from} - ${item.to}`;
        } else {
          finalOpeningHours[key] = 'Closed';
        }
      });
    }

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
      setRawHoursJson(JSON.stringify(data.tenant.openingHours || {}, null, 2));
      setPayment({
        keyId: data.payment.keyId || '',
        keySecret: '',
        webhookSecret: '',
        configured: Boolean(data.payment.configured),
        clear: false,
      });

      // Update CSS variables if changed
      if (data.tenant?.primaryColor) {
        document.documentElement.style.setProperty('--tenant-primary', data.tenant.primaryColor);
      }
      if (data.tenant?.accentColor) {
        document.documentElement.style.setProperty('--tenant-accent', data.tenant.accentColor);
      }

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
  }, [settings, payment, schedule, rawJsonMode, rawHoursJson]);

  const currencySymbol = useMemo(() => {
    const opt = CURRENCY_OPTIONS.find((c) => c.code === settings.currency);
    return opt?.symbol || settings.currency;
  }, [settings.currency]);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-amber-600" />
          <p className="text-sm font-medium text-stone-500">Loading café settings…</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-5xl space-y-8 pb-16">
      {/* Page Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
            <Store size={14} />
            <span>Storefront & Administration</span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-stone-900">
            Café Settings
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Customize your brand appearance, regional taxation, operational hours, and payment integration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary min-w-[140px] px-6 py-2.5 text-sm font-semibold shadow-md shadow-espresso-950/10"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SECTION 1: Brand & Visual Identity */}
      <section className="card space-y-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-800">
              <Palette size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">Brand & Visual Identity</h2>
              <p className="text-xs text-stone-500">Your logo, name, and theme applied across QR menus and admin.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Café Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Café Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Store className="pointer-events-none absolute left-3.5 top-3 text-stone-400" size={17} />
              <input
                type="text"
                required
                maxLength={100}
                value={settings.cafeName}
                onChange={(e) => updateSetting('cafeName', e.target.value)}
                placeholder="e.g. Brewhaus Artisanal Coffee"
                className="input-field pl-10"
              />
            </div>
            <p className="mt-1 text-[11px] text-stone-400">Displayed at the top of QR menu orders and receipts.</p>
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Logo Image URL
            </label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3.5 top-3 text-stone-400" size={17} />
              <input
                type="url"
                value={settings.logoUrl}
                onChange={(e) => updateSetting('logoUrl', e.target.value)}
                placeholder="https://example.com/logo.png"
                className="input-field pl-10"
              />
            </div>
            <p className="mt-1 text-[11px] text-stone-400">Direct link to a square or transparent PNG/SVG logo.</p>
          </div>
        </div>

        {/* Colors & Palette Selection */}
        <div className="rounded-2xl border border-stone-100 bg-stone-50/70 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700">Theme Colors</span>
              <p className="text-xs text-stone-500">Customize the buttons, accents, and sidebar highlights.</p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-stone-500 mr-1">Presets:</span>
              {BRAND_PALETTES.map((palette) => (
                <button
                  key={palette.name}
                  type="button"
                  onClick={() => {
                    updateSetting('primaryColor', palette.primary);
                    updateSetting('accentColor', palette.accent);
                    toast.success(`Applied ${palette.name} theme`);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 shadow-2xs hover:bg-stone-50 transition"
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: palette.primary }}></span>
                  <span>{palette.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Primary Brand Color */}
            <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-2xs">
              <label className="block text-xs font-semibold text-stone-700 mb-2">
                Primary Brand Color (Buttons & Highlights)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => updateSetting('primaryColor', e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-stone-200 bg-transparent p-0.5 shadow-2xs"
                />
                <input
                  type="text"
                  maxLength={7}
                  value={settings.primaryColor}
                  onChange={(e) => updateSetting('primaryColor', e.target.value)}
                  className="input-field font-mono text-xs uppercase"
                  placeholder="#C96B18"
                />
                <div
                  className="h-10 w-10 shrink-0 rounded-lg shadow-inner border border-black/10"
                  style={{ backgroundColor: settings.primaryColor }}
                  title="Color Preview"
                />
              </div>
            </div>

            {/* Accent Color */}
            <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-2xs">
              <label className="block text-xs font-semibold text-stone-700 mb-2">
                Accent Color (Headers & Dark Elements)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => updateSetting('accentColor', e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-stone-200 bg-transparent p-0.5 shadow-2xs"
                />
                <input
                  type="text"
                  maxLength={7}
                  value={settings.accentColor}
                  onChange={(e) => updateSetting('accentColor', e.target.value)}
                  className="input-field font-mono text-xs uppercase"
                  placeholder="#1A0F08"
                />
                <div
                  className="h-10 w-10 shrink-0 rounded-lg shadow-inner border border-black/10"
                  style={{ backgroundColor: settings.accentColor }}
                  title="Color Preview"
                />
              </div>
            </div>
          </div>

          {/* Mini Live Preview Badge */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-stone-300 bg-white/70 p-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold shadow-sm"
                style={{ backgroundColor: settings.primaryColor }}
              >
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                ) : (
                  settings.cafeName.charAt(0).toUpperCase() || 'C'
                )}
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-800">
                  {settings.cafeName || 'Your Café'}
                </span>
                <span className="block text-[11px] text-stone-400">Live Customer UI Preview</span>
              </div>
            </div>
            <button
              type="button"
              className="rounded-xl px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition"
              style={{ backgroundColor: settings.primaryColor }}
            >
              Order Now
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: Regional, Currency & Taxation */}
      <section className="card space-y-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-800">
              <Percent size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">Regional, Currency & Tax</h2>
              <p className="text-xs text-stone-500">Configure currency codes, GST taxation, and timezone standards.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Currency */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Currency
            </label>
            <select
              value={settings.currency}
              onChange={(e) => updateSetting('currency', e.target.value)}
              className="input-field"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-stone-400">Active currency symbol: <strong>{currencySymbol}</strong></p>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Operating Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => updateSetting('timezone', e.target.value)}
              className="input-field"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.tz} value={tz.tz}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-stone-400">Used for sales reports and order timestamps.</p>
          </div>

          {/* GST Number */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              GST / Business Tax ID
            </label>
            <input
              type="text"
              maxLength={32}
              value={settings.gstNumber}
              onChange={(e) => updateSetting('gstNumber', e.target.value.toUpperCase())}
              placeholder="e.g. 27AAPFU0939F1ZV"
              className="input-field uppercase font-mono"
            />
            <p className="mt-1 text-[11px] text-stone-400">Printed on customer invoices and billing receipts.</p>
          </div>

          {/* Tax Rate (%) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              GST Tax Rate (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={settings.taxRate}
                onChange={(e) => updateSetting('taxRate', Number(e.target.value))}
                className="input-field pr-10"
              />
              <span className="pointer-events-none absolute right-3.5 top-2.5 text-xs font-bold text-stone-400">
                %
              </span>
            </div>
            {/* Quick tax presets */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[11px] text-stone-500">Quick set:</span>
              {[0, 5, 12, 18].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => updateSetting('taxRate', rate)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                    settings.taxRate === rate
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tax Note */}
        <div className="rounded-xl border border-stone-200/80 bg-stone-50 p-3.5 text-xs text-stone-600 flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>
            Calculation sample: A {currencySymbol}500 order with {settings.taxRate}% tax will calculate {currencySymbol}
            {((500 * (Number(settings.taxRate) || 0)) / 100).toFixed(2)} tax (Total: {currencySymbol}
            {(500 + (500 * (Number(settings.taxRate) || 0)) / 100).toFixed(2)}).
          </span>
        </div>
      </section>

      {/* SECTION 3: Contact Details & Physical Location */}
      <section className="card space-y-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-800">
              <MapPin size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">Contact & Location</h2>
              <p className="text-xs text-stone-500">Customer communication channels and café address.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Contact Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-3 text-stone-400" size={17} />
              <input
                type="email"
                maxLength={254}
                value={settings.contactEmail}
                onChange={(e) => updateSetting('contactEmail', e.target.value)}
                placeholder="contact@yourcafe.com"
                className="input-field pl-10"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Contact Phone
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-3 text-stone-400" size={17} />
              <input
                type="tel"
                maxLength={32}
                value={settings.contactPhone}
                onChange={(e) => updateSetting('contactPhone', e.target.value)}
                placeholder="+91 98765 43210"
                className="input-field pl-10"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
            Physical Address
          </label>
          <textarea
            rows={2}
            maxLength={500}
            value={settings.address}
            onChange={(e) => updateSetting('address', e.target.value)}
            placeholder="Shop 4, Ground Floor, Heritage Square, MG Road..."
            className="input-field text-sm"
          />
        </div>
      </section>

      {/* SECTION 4: Operating Hours */}
      <section className="card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-800">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">Operating Hours</h2>
              <p className="text-xs text-stone-500">Configure weekly open and close hours for customer dine-in & ordering.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyMondayToAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs transition"
            >
              <Copy size={13} />
              <span>Apply Monday to All</span>
            </button>
            <button
              type="button"
              onClick={() => setRawJsonMode(!rawJsonMode)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition"
            >
              <Sliders size={13} />
              <span>{rawJsonMode ? 'Visual Schedule' : 'Raw JSON'}</span>
            </button>
          </div>
        </div>

        {rawJsonMode ? (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Operating Hours (JSON format)
            </label>
            <textarea
              rows={8}
              value={rawHoursJson}
              onChange={(e) => handleRawJsonChange(e.target.value)}
              className="input-field font-mono text-xs bg-stone-900 text-amber-200"
              placeholder={'{\n  "monday": "09:00 - 22:00",\n  "tuesday": "09:00 - 22:00"\n}'}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-1 divide-y divide-stone-100">
            {DAYS_OF_WEEK.map(({ key, label }) => {
              const item = schedule[key] || { open: true, from: '09:00', to: '22:00' };
              return (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 first:pt-0">
                  <div className="flex items-center gap-3 min-w-[130px]">
                    <span className="text-sm font-semibold text-stone-800">{label}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Open/Closed Toggle */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.open}
                        onChange={(e) => handleScheduleChange(key, 'open', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      <span className="ml-2 text-xs font-medium text-stone-600 w-14">
                        {item.open ? 'Open' : 'Closed'}
                      </span>
                    </label>

                    {/* Time Selectors */}
                    {item.open ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={item.from}
                          onChange={(e) => handleScheduleChange(key, 'from', e.target.value)}
                          className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-800 shadow-2xs focus:border-amber-600 focus:outline-none"
                        />
                        <span className="text-xs text-stone-400">to</span>
                        <input
                          type="time"
                          value={item.to}
                          onChange={(e) => handleScheduleChange(key, 'to', e.target.value)}
                          className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-800 shadow-2xs focus:border-amber-600 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <span className="text-xs italic text-stone-400 py-1">Closed for customer orders</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 5: Razorpay Payment Gateway */}
      <section className="card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-800">
              <CreditCard size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-stone-900">Razorpay Payment Gateway</h2>
                {payment.configured ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Active & Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                    Not Configured (Cash only)
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500">
                Collect UPI, cards, and net banking payments directly into your Razorpay account.
              </p>
            </div>
          </div>
        </div>

        {/* Security Reassurance Box */}
        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-xs text-stone-600 flex items-start gap-3">
          <ShieldCheck size={20} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-stone-800">Enterprise AES-256-GCM Encryption</p>
            <p className="text-[12px] text-stone-500 leading-relaxed">
              Your secret keys are encrypted before database storage and are never returned to client browsers.
              {payment.configured && ' Existing secret values are safely kept if you leave secret fields blank.'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Key ID */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Razorpay Key ID
            </label>
            <input
              type="text"
              value={payment.keyId}
              onChange={(e) => setPayment({ ...payment, keyId: e.target.value, clear: false })}
              placeholder="rzp_live_xxxxxxxxxxxx or rzp_test_xxxxxxxxxxxx"
              autoComplete="off"
              className="input-field font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-stone-400">Public key passed to customer Razorpay Checkout.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Key Secret */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                Key Secret
              </label>
              <div className="relative">
                <input
                  type={showKeySecret ? 'text' : 'password'}
                  value={payment.keySecret}
                  onChange={(e) => setPayment({ ...payment, keySecret: e.target.value, clear: false })}
                  placeholder={payment.configured ? '•••••••••••••••• (Leave blank to keep)' : 'Enter Razorpay Key Secret'}
                  autoComplete="new-password"
                  className="input-field font-mono text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKeySecret(!showKeySecret)}
                  className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
                >
                  {showKeySecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Webhook Secret */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                Webhook Secret
              </label>
              <div className="relative">
                <input
                  type={showWebhookSecret ? 'text' : 'password'}
                  value={payment.webhookSecret}
                  onChange={(e) => setPayment({ ...payment, webhookSecret: e.target.value, clear: false })}
                  placeholder={payment.configured ? '•••••••••••••••• (Leave blank to keep)' : 'Enter Webhook Secret'}
                  autoComplete="new-password"
                  className="input-field font-mono text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
                >
                  {showWebhookSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Remove Credentials Action */}
          {payment.configured && (
            <div className="pt-2">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-rose-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={payment.clear}
                  onChange={(e) =>
                    setPayment({
                      ...payment,
                      clear: e.target.checked,
                      keyId: e.target.checked ? '' : payment.keyId,
                    })
                  }
                  className="rounded border-rose-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                />
                <span className="flex items-center gap-1.5">
                  <Trash2 size={13} />
                  <span>Remove this café’s Razorpay credentials (disables online payment)</span>
                </span>
              </label>
            </div>
          )}
        </div>
      </section>

      {/* Floating / Bottom Sticky Save Bar */}
      <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-2xl border border-stone-200/90 bg-white/95 backdrop-blur-md p-4 shadow-xl shadow-stone-900/10">
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Sparkles size={16} className="text-amber-600" />
          <span>Press <strong>Ctrl+S</strong> to save anytime</span>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary min-w-[160px] px-7 py-3 text-sm font-semibold shadow-md shadow-espresso-900/15"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Saving changes…</span>
            </>
          ) : (
            <>
              <Check size={16} />
              <span>Save Café Settings</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
