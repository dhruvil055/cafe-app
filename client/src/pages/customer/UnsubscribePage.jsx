import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldOff, Loader2 } from 'lucide-react';
import api from '../../services/api';

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const p = searchParams.get('phone');
    if (p) {
      setPhone(p.replace(/\D/g, '').slice(-10));
    }
  }, [searchParams]);

  const handleUnsubscribe = async (e) => {
    e.preventDefault();
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/customers/public-unsubscribe', { phone: phone.trim() });
      setUnsubscribed(true);
    } catch (err) {
      setError(err.message || 'Failed to process your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-espresso-900">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/menu" className="btn-secondary text-sm py-2 px-3 inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back to Menu
          </Link>
          <span className="font-display font-bold text-lg text-espresso-900">Brewhaus Café</span>
        </div>

        <div className="rounded-3xl border border-foam bg-white p-6 shadow-sm sm:p-8">
          {unsubscribed ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={32} />
              </div>
              <h1 className="font-display text-2xl font-bold text-espresso-900">Unsubscribe Confirmed</h1>
              <p className="text-sm leading-relaxed text-espresso-600 max-w-md mx-auto">
                You will no longer receive promotional offers, discounts, or marketing updates from Brewhaus Café.
              </p>
              <div className="rounded-2xl bg-stone-50 border border-foam p-3.5 text-xs text-espresso-500">
                ℹ️ Note: If you place future orders at Brewhaus Café, you will still receive transactional receipts and order status updates.
              </div>
              <div className="pt-4">
                <Link to="/menu" className="btn-primary inline-flex justify-center text-sm py-2.5 px-6">
                  Return to Café Menu
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUnsubscribe} className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brew-100 text-brew-700">
                  <ShieldOff size={20} />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold text-espresso-900">Marketing Preferences</h1>
                  <p className="text-xs text-espresso-500">Opt-out of promotional communications</p>
                </div>
              </div>

              <p className="text-xs text-espresso-600 leading-relaxed">
                We respect your privacy. If you would like to stop receiving SMS, WhatsApp, and promotional messages from Brewhaus Café, enter your mobile number below.
              </p>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                  {error}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-espresso-700 block mb-1">Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400 text-sm">+91</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile"
                    className="input-field pl-12"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary justify-center text-sm py-3"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Unsubscribe from Offers'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
