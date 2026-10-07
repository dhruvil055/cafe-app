import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, Mail, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export default function OtpLoginModal({ isOpen, onClose, onLogin }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const normalizePhone = (p) => p.replace(/\D/g, '').slice(0, 10);

  const handleSendOtp = async (e) => {
    e?.preventDefault?.();
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/send-otp', { phone: normalized });
      if (data?.devOtp) {
        setOtp(data.devOtp);
      }
      setStep('otp');
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault?.();
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const normalizedPhone = normalizePhone(phone);
      const { data } = await api.post('/auth/verify-otp', { phone: normalizedPhone, otp });
      const token = data.accessToken || data.token;
      if (token && data.user) {
        if (data.user.customerId) {
          try {
            const customerRes = await api.get(`/customers/${data.user.customerId}`);
            if (customerRes.data) {
              localStorage.setItem('brewhaus_customer_id', data.user.customerId);
            }
          } catch { /* ignore customer profile fetch error */ }
          localStorage.setItem('brewhaus_customer_id', data.user.customerId);
          localStorage.setItem('brewhaus_customer_phone', normalizedPhone);
        }
        if (onLogin) onLogin(data.user, token);
        setStep('phone');
        setOtp('');
      } else {
        setError('Invalid OTP code. Please verify and try again.');
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtp('');
    setError('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-[26px] bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-espresso-900">
                {step === 'phone' ? 'Login with Phone' : 'Enter OTP'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close login modal"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                aria-live="polite"
                className="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {step === 'phone' ? (
                <motion.form
                  key="phone"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleSendOtp}
                  className="space-y-4"
                >
                  <div>
                    <label htmlFor="otp-phone-input" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-600">Mobile Number</label>
                    <div className="relative">
                      <Smartphone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        id="otp-phone-input"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Enter 10-digit mobile number"
                        className="w-full rounded-2xl border border-stone-200 bg-stone-50/70 pl-11 pr-4 py-3 text-base text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-brew-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brew-500/20"
                        inputMode="numeric"
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || phone.length !== 10}
                    className="w-full btn-primary min-h-[44px] flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <Mail size={16} />
                        <span>Send OTP</span>
                      </>
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleVerifyOtp}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <p className="text-sm text-stone-600 mb-1">We sent a 6-digit code to</p>
                    <p className="font-semibold text-stone-900">+91 {phone.slice(0,5)} {phone.slice(5)}</p>
                  </div>

                  <div>
                    <label htmlFor="otp-code-input" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-stone-600">
                      Enter 6-Digit Code
                    </label>
                    <input
                      id="otp-code-input"
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full text-center tracking-[0.5em] font-mono text-2xl font-bold rounded-2xl border border-stone-200 bg-stone-50/70 py-3 text-stone-900 focus:border-brew-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brew-500/10"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full btn-primary min-h-[44px] flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify OTP</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={loading}
                    className="mt-4 w-full btn-secondary min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs"
                  >
                    Back to phone number
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="mt-6 text-center text-xs text-stone-500">
              <p>By continuing, you agree to our <Link to="/terms" onClick={onClose} className="underline hover:text-amber-700">Terms</Link> and <Link to="/privacy" onClick={onClose} className="underline hover:text-amber-700">Privacy Policy</Link>.</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}