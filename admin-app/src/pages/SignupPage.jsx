import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, CheckCircle2, AlertCircle, Loader2, Store, Mail, Lock, Globe } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const RESERVED_SLUGS = new Set([
  'admin', 'administrator', 'api', 'app', 'auth', 'billing', 'brewhaus', 'cdn',
  'dashboard', 'dev', 'developer', 'docs', 'help', 'login', 'mail', 'master',
  'metrics', 'oauth', 'platform', 'portal', 'root', 'saas', 'settings', 'signin',
  'signup', 'staging', 'status', 'superadmin', 'support', 'sysadmin', 'system',
  'test', 'webhook', 'webhooks', 'www',
]);

export default function SignupPage() {
  const navigate = useNavigate();
  const { setAuthSession } = useAuth();

  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [cafeName, setCafeName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [slug, setSlug] = useState('');
  const [slugAutoModified, setSlugAutoModified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [demoCode, setDemoCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle café name change and auto-generate slug unless manually edited
  const handleNameChange = (e) => {
    const name = e.target.value;
    setCafeName(name);
    if (!slugAutoModified) {
      const generated = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 28);
      setSlug(generated);
    }
  };

  const handleSlugChange = (e) => {
    setSlugAutoModified(true);
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30));
  };

  // Client-side quick slug check
  const slugIsReserved = RESERVED_SLUGS.has(slug);

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!cafeName || !email || !password || !slug) {
      setError('Please fill out all fields.');
      return;
    }

    if (slugIsReserved) {
      setError(`"${slug}" is a reserved system URL. Please pick another URL slug.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/platform/auth/signup', {
        cafeName,
        email,
        password,
        slug,
      });

      if (data.demoCode) {
        setDemoCode(data.demoCode);
        setVerificationCode(data.demoCode);
      }
      setStep('verify');
    } catch (err) {
      setError(err.message || 'Unable to register café. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!verificationCode) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/platform/auth/verify-email', {
        email,
        code: verificationCode,
      });

      setAuthSession(data.token, data.user);
      navigate('/setup-wizard', { replace: true });
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0] px-4 py-12">
      {/* Background aesthetics */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute right-0 bottom-10 h-80 w-80 rounded-full bg-orange-200/30 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-lg rounded-[32px] border border-stone-200/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(80,52,30,0.08)] backdrop-blur-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-orange-500 text-white shadow-lg shadow-orange-500/25">
            <Sparkles size={28} />
          </div>
          <h1 className="font-display text-3xl font-extrabold text-stone-900">
            {step === 'form' ? 'Launch Your Café' : 'Verify Your Email'}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {step === 'form'
              ? 'Start your 14-day free trial. QR table-ordering and kitchen management in minutes.'
              : `We sent a 6-digit confirmation code to ${email}`}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.form
              key="step-form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleSignupSubmit}
              className="space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-600">
                  Café Name
                </label>
                <div className="relative">
                  <Store size={18} className="absolute left-4 top-3.5 text-stone-400" />
                  <input
                    type="text"
                    required
                    value={cafeName}
                    onChange={handleNameChange}
                    placeholder="e.g. Velvet Roast Artisan Coffee"
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50/70 pl-11 pr-4 py-3 text-sm focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-600">
                  Custom Subdomain / URL Slug
                </label>
                <div className="relative">
                  <Globe size={18} className="absolute left-4 top-3.5 text-stone-400" />
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={handleSlugChange}
                    placeholder="velvet-roast"
                    className={`w-full rounded-2xl border ${
                      slugIsReserved ? 'border-red-400 bg-red-50/50' : 'border-stone-200 bg-stone-50/70'
                    } pl-11 pr-4 py-3 text-sm focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10`}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-stone-500">
                    Live URL: <span className="font-semibold text-amber-700">{slug ? `${slug}.localhost:5173` : 'your-cafe.localhost:5173'}</span>
                  </span>
                  {slugIsReserved && (
                    <span className="font-medium text-red-600">Reserved word</span>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-600">
                  Owner Email
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-3.5 text-stone-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@yourcafe.com"
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50/70 pl-11 pr-4 py-3 text-sm focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-600">
                  Password (min 8 characters)
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-3.5 text-stone-400" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50/70 pl-11 pr-4 py-3 text-sm focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || slugIsReserved}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 py-3.5 font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Creating your account...
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-3 text-xs text-stone-500">
                Already have a café account?{' '}
                <Link to="/login" className="font-semibold text-amber-700 hover:underline">
                  Sign in here
                </Link>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="step-verify"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleVerifySubmit}
              className="space-y-5"
            >
              {demoCode && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800">
                  <span className="font-bold">🧪 Dev Demo Mode:</span> Your verification code is{' '}
                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-900">
                    {demoCode}
                  </span>
                  . (Auto-filled below).
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-600 text-center">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full text-center tracking-[0.5em] font-mono text-2xl font-bold rounded-2xl border border-stone-200 bg-stone-50/70 py-3.5 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                  placeholder="000000"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Auto-provisioning café & menu...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} /> Verify & Launch Café
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="text-xs text-stone-500 hover:text-stone-800 underline"
                >
                  ← Back to details
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
