import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/platform/admin/login', {
        email,
        password,
      });

      // Save platform admin token
      sessionStorage.setItem('brewhaus_superadmin_token', data.token);
      sessionStorage.setItem('brewhaus_superadmin_user', JSON.stringify(data.admin));

      navigate('/super-admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid platform admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 px-4 py-12 text-stone-100">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-amber-600/10 blur-3xl" />
        <div className="absolute right-0 bottom-10 h-80 w-80 rounded-full bg-orange-600/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md rounded-[32px] border border-stone-800 bg-stone-900/90 p-8 shadow-2xl backdrop-blur-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-inner">
            <ShieldCheck size={28} />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            Brewhaus Platform Admin
          </h1>
          <p className="mt-1 text-xs text-stone-400">
            Multi-tenant SaaS oversight, metrics & management
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-950/40 p-3.5 text-xs text-red-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-400">
              Admin Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-3.5 text-stone-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@brewhaus.com"
                className="w-full rounded-2xl border border-stone-800 bg-stone-950/60 pl-11 pr-4 py-3 text-sm text-stone-100 placeholder-stone-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-400">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-3.5 text-stone-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-2xl border border-stone-800 bg-stone-950/60 pl-11 pr-4 py-3 text-sm text-stone-100 placeholder-stone-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-400 py-3.5 font-bold text-stone-950 shadow-lg shadow-amber-500/20 transition disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Authenticating...
                </>
              ) : (
                'Sign in to Platform'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
