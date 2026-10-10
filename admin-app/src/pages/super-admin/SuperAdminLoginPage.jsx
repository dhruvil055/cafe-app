import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Lock, Mail, Eye, EyeOff, Loader2, AlertCircle,
  CheckCircle2, ArrowRight, ShieldAlert, Sparkles, Building2, Smartphone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [require2fa, setRequire2fa] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide administrative email and password.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/platform/admin/login', {
        email,
        password,
        twoFactorCode: require2fa ? twoFactorCode : undefined,
      });

      if (data.require2fa) {
        setRequire2fa(true);
        setLoading(false);
        return;
      }

      // Save platform admin session token
      sessionStorage.setItem('brewhaus_superadmin_token', data.token);
      sessionStorage.setItem('brewhaus_superadmin_user', JSON.stringify(data.admin));

      navigate('/super-admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Invalid platform admin credentials.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-stone-50 text-stone-900 font-body">
      {/* ── Left Side: Brand Visual & SaaS Platform Overview ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 border-r border-stone-200 bg-gradient-to-br from-amber-500/10 via-stone-100 to-orange-500/10 overflow-hidden">
        {/* Glow ambient effects */}
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-amber-500/15 blur-[120px] pointer-events-none" />
        <div className="absolute right-10 bottom-20 h-96 w-96 rounded-full bg-orange-500/15 blur-[120px] pointer-events-none" />

        {/* Top brand header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-700 font-bold shadow-sm">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="font-display text-xl font-bold tracking-tight text-stone-900 block">
              Brewhaus
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 block">
              Platform Administration
            </span>
          </div>
        </div>

        {/* Center narrative & value props */}
        <div className="relative z-10 my-auto py-12 space-y-8 max-w-lg">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-800 mb-4">
              <Sparkles size={13} /> Multi-Tenant Dining Infrastructure
            </span>
            <h1 className="font-display text-4xl xl:text-5xl font-bold tracking-tight text-stone-900 leading-tight">
              Centralized Command for 18+ Live Cafés.
            </h1>
            <p className="mt-4 text-sm text-stone-600 leading-relaxed">
              Real-time platform metrics, tenant isolation oversight, automated QR table-ordering provision, and bank-grade audit trail compliance.
            </p>
          </div>

          {/* Highlights Cards */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-900">Full Tenant Lifecycle & Quotas</div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  Automated table generation, menu catalog sync, and plan tier quota management.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700">
                <ShieldCheck size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-900">Secure Impersonation & Audit Trail</div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  Troubleshoot owner dashboards safely with mandatory reason capture and tamper-evident logs.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-700">
                <Smartphone size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-900">Integrated User Panel Workstation</div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  Preview live dining ordering panels across mobile, tablet, and desktop views.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom security assurance */}
        <div className="relative z-10 flex items-center justify-between text-xs text-stone-500 border-t border-stone-200 pt-6">
          <span>Brewhaus Platform v2.4 (Enterprise Core)</span>
          <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            99.99% Systems Nominal
          </span>
        </div>
      </div>

      {/* ── Right Side: Admin Authentication Card ── */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 bg-stone-50">
        <motion.div
          animate={shake ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md space-y-6 bg-white p-8 sm:p-10 rounded-3xl border border-stone-200 shadow-xl shadow-stone-200/50"
        >
          {/* Header */}
          <div>
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-700 shadow-sm">
              <ShieldCheck size={26} />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-stone-900">
              Super Admin Sign In
            </h2>
            <p className="mt-1.5 text-xs text-stone-500">
              Enter your elevated administrative credentials to access platform controls.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-600">
                Super Admin Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-3.5 text-stone-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@brewhaus.com"
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50/50 pl-11 pr-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-xs transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                  Password
                </label>
                <span className="text-[11px] text-amber-700 hover:text-amber-800 font-medium cursor-pointer" title="Contact systems security administrator">
                  Forgot credentials?
                </span>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-3.5 text-stone-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50/50 pl-11 pr-11 py-3 text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-xs transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-stone-400 hover:text-stone-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 2FA input if required */}
            {require2fa && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-1.5"
              >
                <label className="block text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Two-Factor Authentication Code (TOTP)
                </label>
                <input
                  type="text"
                  required
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="6-digit code or backup code"
                  className="w-full rounded-2xl border border-amber-400 bg-white px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:outline-none shadow-xs"
                />
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 py-3.5 font-bold text-stone-950 shadow-lg shadow-amber-500/20 transition disabled:opacity-60 mt-6 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Authenticating Core Session...
                </>
              ) : (
                <>
                  Sign in to Platform <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-[11px] text-stone-500 leading-relaxed">
            <span className="font-semibold text-stone-700">Security Notice:</span> Access to this platform is strictly monitored and rate-limited. Unauthorized access attempts are flagged, IP-logged, and automatically blocked.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
