import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, UtensilsCrossed, LayoutGrid, Key, QrCode,
  CheckCircle2, ArrowRight, ArrowLeft, Download, ExternalLink,
  Loader2, Sparkles, Plus, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTenant } from '../context/TenantContext';

const STEPS = [
  { id: 'branding', label: 'Branding', icon: Palette, desc: 'Colors & Style' },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed, desc: 'Starter Items' },
  { id: 'tables', label: 'Tables', icon: LayoutGrid, desc: 'Floor & Capacity' },
  { id: 'payments', label: 'Payments', icon: Key, desc: 'Razorpay Keys' },
  { id: 'qrcode', label: 'First QR', icon: QrCode, desc: 'Print & Test' },
];

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const tenant = useTenant();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Branding State
  const [cafeName, setCafeName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#c96b18');
  const [accentColor, setAccentColor] = useState('#1a0f08');
  const [address, setAddress] = useState('');

  // Menu State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  // Tables State
  const [tables, setTables] = useState([]);

  // Payments State
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  // Load existing café data
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [settingsRes, productsRes, categoriesRes, tablesRes] = await Promise.all([
          api.get('/tenant/settings').catch(() => ({ data: { tenant: {} } })),
          api.get('/menu').catch(() => ({ data: { products: [] } })),
          api.get('/categories').catch(() => ({ data: { categories: [] } })),
          api.get('/tables').catch(() => ({ data: { tables: [] } })),
        ]);

        const settings = settingsRes.data?.tenant?.settings || {};
        setCafeName(settings.cafeName || tenant.name || '');
        if (settings.primaryColor) setPrimaryColor(settings.primaryColor);
        if (settings.accentColor) setAccentColor(settings.accentColor);
        if (settings.address) setAddress(settings.address);

        setProducts(productsRes.data?.products || []);
        setCategories(categoriesRes.data?.categories || []);
        setTables(tablesRes.data?.tables || []);
      } catch (err) {
        setError('Failed to load initial café settings.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [tenant]);

  const handleNext = async () => {
    setError('');
    const step = STEPS[currentStepIndex].id;

    if (step === 'branding') {
      setSaving(true);
      try {
        await api.put('/tenant/settings', {
          settings: {
            cafeName: cafeName || tenant.name,
            primaryColor,
            accentColor,
            address,
            currency: 'INR',
            timezone: 'Asia/Kolkata',
            taxRate: 5,
          },
        });
      } catch (err) {
        setError(err.message || 'Could not save branding settings.');
        setSaving(false);
        return;
      }
      setSaving(false);
    } else if (step === 'payments') {
      if (keyId || keySecret || webhookSecret) {
        setSaving(true);
        try {
          await api.put('/tenant/settings', {
            payment: { keyId, keySecret, webhookSecret },
          });
        } catch (err) {
          setError(err.message || 'Failed to update payment keys.');
          setSaving(false);
          return;
        }
        setSaving(false);
      }
    }

    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      navigate('/dashboard');
    }
  };

  const handlePrev = () => {
    setError('');
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const firstTable = tables[0];

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 pb-16">
      {/* Top Header */}
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-600 to-orange-500 flex items-center justify-center text-white font-bold shadow-md shadow-orange-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="font-bold text-sm text-stone-900">{tenant.name || 'Your Café'}</div>
              <div className="text-[11px] text-stone-500">Quick Setup Wizard</div>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs text-stone-500 hover:text-stone-900 font-medium px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition"
          >
            Skip to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8">
        {/* Step Progress Bar */}
        <div className="mb-8">
          <div className="grid grid-cols-5 gap-2 sm:gap-4">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isDone = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div
                  key={s.id}
                  className={`flex flex-col items-center text-center p-2 rounded-2xl transition border ${
                    isCurrent
                      ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                      : isDone
                      ? 'border-emerald-300 bg-emerald-50/30'
                      : 'border-transparent text-stone-400'
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold mb-1.5 transition ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    {isDone ? <CheckCircle2 size={18} /> : <Icon size={16} />}
                  </div>
                  <span className={`text-xs font-semibold hidden sm:block ${isCurrent ? 'text-amber-900' : 'text-stone-600'}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Wizard Card */}
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-10 shadow-xl shadow-stone-200/40">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-stone-400">
              <Loader2 size={32} className="animate-spin text-amber-600 mb-3" />
              <p className="text-sm">Loading your starter configuration...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* Step 1: Branding */}
              {STEPS[currentStepIndex].id === 'branding' && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold font-display text-stone-900">Customize Your Brand</h2>
                    <p className="text-sm text-stone-500 mt-1">
                      Choose the visual style your customers will see when scanning table QR codes.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                        Display Café Name
                      </label>
                      <input
                        type="text"
                        value={cafeName}
                        onChange={(e) => setCafeName(e.target.value)}
                        placeholder="Velvet Roast Coffee"
                        className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                        Café Address / Location
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="124 Coffee Lane, Downtown"
                        className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                        Primary Theme Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="h-11 w-16 cursor-pointer rounded-xl border border-stone-200 p-1"
                        />
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="font-mono text-xs w-28 uppercase rounded-xl border border-stone-200 px-3 py-2.5"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                        Accent Theme Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="h-11 w-16 cursor-pointer rounded-xl border border-stone-200 p-1"
                        />
                        <input
                          type="text"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="font-mono text-xs w-28 uppercase rounded-xl border border-stone-200 px-3 py-2.5"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live Mobile Customer Preview */}
                  <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                      Customer Experience Preview
                    </div>
                    <div className="rounded-xl bg-white p-4 shadow-sm border border-stone-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm"
                          style={{ backgroundColor: primaryColor }}
                        >
                          ☕
                        </div>
                        <div>
                          <div className="font-bold text-sm text-stone-900">{cafeName || 'Your Café'}</div>
                          <div className="text-xs text-stone-500">Scan & Order from Table</div>
                        </div>
                      </div>
                      <div
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Order Now
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Starter Menu */}
              {STEPS[currentStepIndex].id === 'menu' && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold font-display text-stone-900">Starter Menu Ready</h2>
                      <p className="text-sm text-stone-500 mt-1">
                        We automatically provisioned starter categories and popular items for your café.
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 bg-amber-100 text-amber-900 rounded-full">
                      {products.length} Items Live
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    {products.map((item) => (
                      <div key={item._id} className="rounded-2xl border border-stone-200 p-4 bg-stone-50/50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xl">☕</span>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                              ₹{item.price}
                            </span>
                          </div>
                          <div className="font-bold text-sm text-stone-900">{item.name}</div>
                          <p className="text-xs text-stone-500 mt-1 line-clamp-2">{item.description}</p>
                        </div>
                        <div className="mt-4 pt-2 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500">
                          <span>Status: Available</span>
                          <span className="text-amber-700 font-medium">Ready</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-dashed border-stone-300 p-4 text-center">
                    <p className="text-xs text-stone-500">
                      You can add custom categories, modifiers, and high-res food photos later from the <strong>Products</strong> panel in your dashboard.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Tables & Dining Setup */}
              {STEPS[currentStepIndex].id === 'tables' && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold font-display text-stone-900">Floor Tables Configured</h2>
                      <p className="text-sm text-stone-500 mt-1">
                        Each table has an HMAC-signed cryptographic QR code to prevent table spoofing.
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 bg-amber-100 text-amber-900 rounded-full">
                      {tables.length} Tables Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    {tables.map((t) => (
                      <div key={t._id} className="rounded-2xl border border-stone-200 p-5 bg-stone-50/60 text-center">
                        <div className="h-12 w-12 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center font-display font-bold text-lg text-amber-800 mb-2">
                          #{t.tableNumber}
                        </div>
                        <div className="font-bold text-sm text-stone-900">{t.label || `Table ${t.tableNumber}`}</div>
                        <div className="text-xs text-stone-500 mt-0.5">{t.seats || 4} Seats Capacity</div>
                        <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 size={13} /> QR Verified
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-3">
                    <Sparkles size={18} className="shrink-0 mt-0.5 text-amber-700" />
                    <span>
                      Starter plan includes up to <strong>5 tables</strong>. You can expand to 25 tables anytime with the Pro plan in your Billing settings.
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Payments Configuration */}
              {STEPS[currentStepIndex].id === 'payments' && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold font-display text-stone-900">Online Payments Setup (Optional)</h2>
                    <p className="text-sm text-stone-500 mt-1">
                      Connect your Razorpay account so diners can pay instantly via UPI, Cards, or NetBanking right from their table.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
                    💡 <strong>Test Mode Friendly:</strong> You can leave these fields blank to test cash/counter ordering and demo payments right away, or enter Razorpay Test keys.
                  </div>

                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                        Razorpay Key ID
                      </label>
                      <input
                        type="text"
                        value={keyId}
                        onChange={(e) => setKeyId(e.target.value)}
                        placeholder="rzp_test_..."
                        className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-mono focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                        Razorpay Key Secret
                      </label>
                      <input
                        type="password"
                        value={keySecret}
                        onChange={(e) => setKeySecret(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-mono focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                        Razorpay Webhook Secret
                      </label>
                      <input
                        type="password"
                        value={webhookSecret}
                        onChange={(e) => setWebhookSecret(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-mono focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 5: First Table QR Code Download & Go Live */}
              {STEPS[currentStepIndex].id === 'qrcode' && (
                <motion.div
                  key="step-5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 text-center"
                >
                  <div>
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <CheckCircle2 size={32} />
                    </div>
                    <h2 className="text-3xl font-extrabold font-display text-stone-900">Your Café is Live!</h2>
                    <p className="text-sm text-stone-600 max-w-md mx-auto mt-1">
                      Here is your Table 1 QR code. Customers can scan this code to browse your menu and place orders.
                    </p>
                  </div>

                  {firstTable ? (
                    <div className="max-w-xs mx-auto rounded-3xl border-2 border-stone-900 p-6 bg-white shadow-2xl">
                      <div className="font-display font-black text-xl tracking-tight text-stone-900 uppercase">
                        {tenant.name || 'Café'}
                      </div>
                      <div className="text-xs font-semibold text-stone-500 mt-0.5">
                        {firstTable.label || 'Table 1'}
                      </div>

                      <div className="my-4 p-2 border border-stone-100 rounded-2xl bg-white flex justify-center">
                        {firstTable.qrCode ? (
                          <img
                            src={firstTable.qrCode}
                            alt="Table 1 QR Code"
                            className="w-48 h-48 object-contain"
                          />
                        ) : (
                          <div className="w-48 h-48 flex items-center justify-center text-stone-400">
                            QR Loading...
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 py-1.5 rounded-xl border border-amber-200">
                        Scan to View Menu & Order
                      </div>

                      <div className="mt-4 flex flex-col gap-2">
                        {firstTable.qrCode && (
                          <a
                            href={firstTable.qrCode}
                            download={`${tenant.slug || 'cafe'}-table-1-qr.png`}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-stone-800 transition"
                          >
                            <Download size={14} /> Download QR (.png)
                          </a>
                        )}

                        {firstTable.qrUrl && (
                          <a
                            href={firstTable.qrUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 font-semibold py-1"
                          >
                            Open Customer Menu <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-stone-400">Generating QR code...</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Navigation Controls */}
          <div className="mt-10 pt-6 border-t border-stone-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStepIndex === 0 || saving}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:brightness-105 disabled:opacity-60 transition"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving...
                </>
              ) : currentStepIndex === STEPS.length - 1 ? (
                <>
                  Go to Dashboard <CheckCircle2 size={16} />
                </>
              ) : (
                <>
                  Next Step <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
