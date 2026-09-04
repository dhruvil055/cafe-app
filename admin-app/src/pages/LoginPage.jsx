import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
            B
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Brewhaus Admin</h1>
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
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-100"
              placeholder="admin@brewhaus.com"
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
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 pr-11 text-sm text-stone-800 placeholder:text-stone-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-100"
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

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3.5 font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-75"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign in'}
          </button>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-center text-xs text-stone-500">
            Demo account: <span className="font-medium text-stone-700">admin@brewhaus.com</span> / <span className="font-medium text-stone-700">admin123</span>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
