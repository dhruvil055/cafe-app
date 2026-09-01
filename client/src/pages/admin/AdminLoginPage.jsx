import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter email and password.'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/admin/orders');
    } catch (err) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-espresso-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {['☕', '🍕', '🍔', '🍰', '⭐'].map((e, i) => (
          <motion.span
            key={i}
            className="absolute text-3xl opacity-5"
            style={{ left: `${10 + i * 22}%`, top: `${20 + (i % 2) * 50}%` }}
            animate={{ y: [-15, 15, -15], rotate: [-10, 10, -10] }}
            transition={{ duration: 5 + i, repeat: Infinity, delay: i * 0.8 }}
          >
            {e}
          </motion.span>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brew-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brew-900/50">
            <span className="text-white font-display font-bold text-2xl">B</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-cream">Brewhaus Admin</h1>
          <p className="text-espresso-400 text-sm mt-1">Sign in to manage your café</p>
        </div>

        {/* Form */}
        <div className="bg-espresso-900/50 backdrop-blur-sm border border-espresso-700 rounded-3xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-espresso-300 text-xs font-medium block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@brewhaus.com"
                autoComplete="email"
                className="w-full px-4 py-3 bg-espresso-800 border border-espresso-600 rounded-xl
                           text-cream placeholder:text-espresso-500 focus:outline-none focus:border-brew-400
                           focus:ring-2 focus:ring-brew-400/20 transition-all text-sm"
              />
            </div>

            <div>
              <label className="text-espresso-300 text-xs font-medium block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 bg-espresso-800 border border-espresso-600 rounded-xl
                             text-cream placeholder:text-espresso-500 focus:outline-none focus:border-brew-400
                             focus:ring-2 focus:ring-brew-400/20 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso-400 hover:text-espresso-200"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3"
              >
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs">{error}</p>
              </motion.div>
            )}

            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full bg-brew-500 hover:bg-brew-600 text-white font-medium py-3.5 rounded-xl
                         transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" />Signing in...</> : 'Sign In'}
            </motion.button>
          </form>

          {/* Demo hint */}
          <div className="mt-4 p-3 bg-espresso-800/50 rounded-xl text-center">
            <p className="text-espresso-400 text-xs">
              Demo: <span className="text-espresso-200">admin@brewhaus.com</span> / <span className="text-espresso-200">admin123</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
