import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Eye, EyeOff, Loader2, Clock } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

export default function LoginPage() {
  const tenant = useTenant();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  // Active countdown timer when rate limited (429)
  useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const interval = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev <= 1) {
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitCountdown]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading || rateLimitCountdown > 0) return; // Prevent double-submit or submission while in cooldown

    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email, password, twoFactorCode);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.code === 'TWO_FACTOR_REQUIRED') {
        setRequiresTwoFactor(true);
      }

      if (err.status === 429 || err.code === 'RATE_LIMITED') {
        const retrySec = Number(err.retryAfter) || 30;
        setRateLimitCountdown(retrySec);
        setError(`Too many login attempts. Please wait ${retrySec} seconds before trying again.`);
      } else {
        setError(err.message || 'Unable to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isButtonDisabled = loading || rateLimitCountdown > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f1eb] px-4 py-10">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-10 top-16 h-24 w-24 rounded-full bg-[#f0d9c4]/60 blur-3xl" />
        <div className="absolute bottom-12 right-16 h-32 w-32 rounded-full bg-[#f4c58d]/40 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md rounded-[30px] border border-stone-200 bg-white/80 p-6 shadow-[0_24px_80px_rgba(80,52,30,0.12)] backdrop-blur-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-2xl font-bold text-white shadow-lg shadow-orange-500/30">
            {tenant.name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">{tenant.name} Admin</h1>
          <p className="mt-2 text-sm text-stone-500">Secure café operations dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading || rateLimitCountdown > 0}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-100 disabled:opacity-75"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading || rateLimitCountdown > 0}
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 pr-11 text-sm text-stone-800 placeholder:text-stone-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-100 disabled:opacity-75"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition hover:text-stone-700"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {requiresTwoFactor && (
            <div>
              <label htmlFor="two-factor-code" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Authenticator code
              </label>
              <input
                id="two-factor-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading || rateLimitCountdown > 0}
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-sm focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-100 disabled:opacity-75"
                placeholder="6-digit code"
              />
            </div>
          )}

          {error && (
            <div className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-sm ${
              rateLimitCountdown > 0
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-red-200 bg-red-50 text-red-600'
            }`}>
              {rateLimitCountdown > 0 ? (
                <Clock size={16} className="mt-0.5 shrink-0 text-amber-600 animate-spin" />
              ) : (
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
              )}
              <div className="flex-1">
                <span className="font-medium">{error}</span>
                {rateLimitCountdown > 0 && (
                  <div className="mt-1 text-xs text-amber-700">
                    Button will re-enable automatically in <strong className="font-mono">{rateLimitCountdown}s</strong>.
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isButtonDisabled}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3.5 font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : rateLimitCountdown > 0 ? (
              <span className="flex items-center gap-1.5">
                <Clock size={15} />
                <span>Try again in {rateLimitCountdown}s</span>
              </span>
            ) : (
              'Sign in'
            )}
          </button>

          <div className="text-center pt-2 text-xs text-stone-500">
            Opening a new café?{' '}
            <Link to="/signup" className="font-semibold text-amber-700 hover:underline">
              Start 14-day free trial
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
