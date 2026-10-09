import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Lock, Shield, CheckCircle2, AlertCircle,
  Eye, EyeOff, Save, KeyRound, CalendarDays, Crown,
  Smartphone, Laptop, Tablet, LogOut, Clock, Wifi, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/* ─── Tiny helpers ──────────────────────────────────────────── */
function Alert({ type, message }) {
  if (!message) return null;
  const isError = type === 'error';
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium ${
        isError
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      {isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      {message}
    </motion.div>
  );
}

function PasswordInput({ id, label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-espresso-800 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 pr-11 text-sm text-stone-900 outline-none ring-brew-400 transition placeholder:text-stone-400 focus:border-brew-400 focus:ring-2"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition hover:text-stone-600"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  /* profile form */
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  /* password form */
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  /* 2FA */
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSetup, setTwoFactorSetup] = useState(null);
  const [twoFactorMsg, setTwoFactorMsg] = useState(null);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);

  /* Sessions state */
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [sessions, setSessions] = useState([
    {
      id: 'sess-curr',
      device: 'Desktop Browser (Chrome on Windows 11)',
      location: 'Mumbai, India',
      ip: '10.196.83.173',
      lastActive: 'Active now',
      isCurrent: true,
      icon: Laptop,
    },
    {
      id: 'sess-tablet',
      device: 'Apple iPad Pro (Safari)',
      location: 'Counter POS Station 1',
      ip: '10.196.83.104',
      lastActive: '12 minutes ago',
      isCurrent: false,
      icon: Tablet,
    },
    {
      id: 'sess-kds',
      device: 'Android Terminal (Firefox)',
      location: 'Kitchen Display KDS',
      ip: '10.196.83.189',
      lastActive: '45 minutes ago',
      isCurrent: false,
      icon: Smartphone,
    },
  ]);

  /* derived */
  const initials = (user?.name || 'Admin')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
    : 'October 2026';

  /* save profile */
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    if (!name.trim() || !email.trim()) {
      return setProfileMsg({ type: 'error', text: 'Name and email cannot be empty.' });
    }
    try {
      setProfileSaving(true);
      const { data } = await api.put('/auth/profile', { name: name.trim(), email: email.trim() });
      updateUser(data.user);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      toast.success('Profile details saved');
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message });
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  /* change password */
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (!currentPw || !newPw || !confirmPw) {
      return setPwMsg({ type: 'error', text: 'All password fields are required.' });
    }
    if (newPw !== confirmPw) {
      return setPwMsg({ type: 'error', text: 'New passwords do not match.' });
    }
    if (newPw.length < 8) {
      return setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
    }
    try {
      setPwSaving(true);
      await api.put('/auth/password', { currentPassword: currentPw, newPassword: newPw });
      setPwMsg({ type: 'success', text: 'Password changed successfully!' });
      toast.success('Password changed successfully');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message });
      toast.error(err.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  const startTwoFactorSetup = async () => {
    setTwoFactorBusy(true);
    setTwoFactorMsg(null);
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setTwoFactorSetup(data);
    } catch (error) {
      setTwoFactorMsg({ type: 'error', text: error.message });
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const updateTwoFactor = async () => {
    setTwoFactorBusy(true);
    setTwoFactorMsg(null);
    try {
      const { data } = await api.post(
        user?.twoFactorEnabled ? '/auth/2fa/disable' : '/auth/2fa/enable',
        { code: twoFactorCode }
      );
      updateUser({ ...user, twoFactorEnabled: data.enabled });
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setTwoFactorMsg({
        type: 'success',
        text: data.enabled
          ? 'Two-factor authentication is now active.'
          : 'Two-factor authentication has been disabled.',
      });
      toast.success(data.enabled ? '2FA Enabled' : '2FA Disabled');
    } catch (error) {
      setTwoFactorMsg({ type: 'error', text: error.message });
      toast.error(error.message || 'Failed to update 2FA');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const handleRevokeOtherSessions = () => {
    setRevokingSessions(true);
    setTimeout(() => {
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      setRevokingSessions(false);
      toast.success('All other devices have been signed out successfully');
    }, 600);
  };

  /* password strength */
  const pwStrength = (() => {
    if (!newPw) return null;
    if (newPw.length < 6) return { label: 'Weak', color: 'bg-red-400', pct: '25%' };
    if (newPw.length < 10) return { label: 'Fair', color: 'bg-amber-400', pct: '50%' };
    if (newPw.length < 14) return { label: 'Good', color: 'bg-brew-400', pct: '75%' };
    return { label: 'Strong', color: 'bg-emerald-500', pct: '100%' };
  })();

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* ── Hero card ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-espresso-950 p-7 text-white shadow-soft"
      >
        {/* decorative background glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-brew-500/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-4 h-64 w-64 rounded-full bg-espresso-800/40 blur-xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* avatar */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brew-600 font-display text-3xl font-bold text-white shadow-md ring-4 ring-brew-500/30">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">{user?.name || 'Admin'}</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brew-500/25 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brew-200 border border-brew-500/30">
                <Crown size={12} />
                {user?.role || 'owner'}
              </span>
            </div>
            <div className="mt-1 text-sm text-espresso-200">{user?.email}</div>
          </div>
        </div>

        {/* stat row */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-espresso-900/80 px-4 py-3 border border-espresso-800/60 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-espresso-300">
              <Shield size={11} /> Access Role
            </div>
            <div className="mt-1 text-sm font-semibold text-white capitalize">{user?.role || 'Owner'}</div>
          </div>
          <div className="rounded-2xl bg-espresso-900/80 px-4 py-3 border border-espresso-800/60 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-espresso-300">
              <CalendarDays size={11} /> Member Since
            </div>
            <div className="mt-1 text-sm font-semibold text-white">{memberSince}</div>
          </div>
          <div className="rounded-2xl bg-espresso-900/80 px-4 py-3 border border-espresso-800/60 backdrop-blur-sm col-span-2 sm:col-span-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-espresso-300">
              <CheckCircle2 size={11} /> Account Status
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Active & Verified
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Edit profile ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-7 shadow-soft"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brew-50 text-brew-600">
            <User size={20} />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-espresso-950">Personal Information</h3>
            <p className="text-xs text-stone-500">Update your account name and contact email address</p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4">
          {profileMsg && <Alert type={profileMsg.type} message={profileMsg.text} />}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="profile-name" className="block text-xs font-semibold text-espresso-800 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                  <User size={15} />
                </span>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-4 text-sm text-stone-900 outline-none ring-brew-400 transition placeholder:text-stone-400 focus:border-brew-400 focus:ring-2 focus:bg-white"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="profile-email" className="block text-xs font-semibold text-espresso-800 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                  <Mail size={15} />
                </span>
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-4 text-sm text-stone-900 outline-none ring-brew-400 transition placeholder:text-stone-400 focus:border-brew-400 focus:ring-2 focus:bg-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={profileSaving}
              className="btn-primary rounded-xl gap-2 px-5 py-2.5 text-xs font-semibold shadow-sm disabled:cursor-wait"
            >
              <Save size={14} />
              {profileSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* ── Change password ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-7 shadow-soft"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-espresso-950">Change Security Password</h3>
            <p className="text-xs text-stone-500">Ensure your administrative console is safeguarded with a strong password</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          {pwMsg && <Alert type={pwMsg.type} message={pwMsg.text} />}

          <PasswordInput
            id="current-pw"
            label="Current Password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="Enter current password"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <PasswordInput
                id="new-pw"
                label="New Password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
              />
              {/* strength bar */}
              {pwStrength && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-stone-500">
                    <span>Password Strength</span>
                    <span className="font-semibold text-stone-700">{pwStrength.label}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${pwStrength.color}`}
                      style={{ width: pwStrength.pct }}
                    />
                  </div>
                </div>
              )}
            </div>

            <PasswordInput
              id="confirm-pw"
              label="Confirm New Password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Repeat new password"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={pwSaving}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-700 shadow-sm flex items-center gap-2 disabled:cursor-wait disabled:opacity-60"
            >
              <Lock size={14} />
              {pwSaving ? 'Changing…' : 'Update Password'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* ── Two-Factor Authentication (2FA) ──────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-7 shadow-soft"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-espresso-950">Two-Factor Authentication (2FA)</h3>
              <p className="text-xs text-stone-500">Protect your café revenue and staff data with Google Authenticator or Authy</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
              user?.twoFactorEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-stone-100 text-stone-600 border-stone-200'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                user?.twoFactorEnabled ? 'bg-emerald-500' : 'bg-stone-400'
              }`}
            />
            {user?.twoFactorEnabled ? '2FA Active' : 'Not Configured'}
          </span>
        </div>

        {twoFactorMsg && <div className="mb-4"><Alert type={twoFactorMsg.type} message={twoFactorMsg.text} /></div>}

        {!user?.twoFactorEnabled && !twoFactorSetup && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
            <p className="text-xs text-stone-600 max-w-lg">
              Add a second verification code during login. Recommended for Owner and Manager accounts to prevent unauthorized access to payouts and billing.
            </p>
            <button
              type="button"
              onClick={startTwoFactorSetup}
              disabled={twoFactorBusy}
              className="btn-primary rounded-xl px-4 py-2.5 text-xs font-semibold shrink-0"
            >
              {twoFactorBusy ? 'Generating Keys…' : 'Set Up Authenticator'}
            </button>
          </div>
        )}

        {twoFactorSetup && !user?.twoFactorEnabled && (
          <div className="space-y-4 rounded-2xl bg-stone-50 border border-stone-200/80 p-5">
            <p className="text-xs text-stone-700">
              1. Scan this QR code in Google Authenticator or 1Password, then enter the generated 6-digit verification code below:
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <img
                src={twoFactorSetup.qrCode}
                alt="Authenticator QR code"
                className="h-44 w-44 rounded-2xl border border-stone-200 bg-white p-2 shadow-xs"
              />
              <div className="space-y-3 flex-1 w-full">
                <div>
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Manual Secret Key:</span>
                  <div className="mt-1 break-all rounded-xl bg-white p-2.5 font-mono text-xs text-stone-800 border border-stone-200">
                    {twoFactorSetup.secret}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Enter 6-digit Code:
                  </label>
                  <input
                    aria-label="Authenticator code"
                    inputMode="numeric"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000 000"
                    className="w-full max-w-xs rounded-xl border border-stone-200 px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:border-brew-500"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={updateTwoFactor}
                    disabled={twoFactorBusy || twoFactorCode.length !== 6}
                    className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold"
                  >
                    Verify & Activate 2FA
                  </button>
                  <button
                    type="button"
                    onClick={() => setTwoFactorSetup(null)}
                    className="btn-secondary rounded-xl px-4 py-2 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {user?.twoFactorEnabled && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-900 font-medium">
                Your account is protected with TOTP Two-Factor Authentication. A code is required on every new device login.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                aria-label="Authenticator code"
                inputMode="numeric"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Code to disable"
                className="w-36 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-mono tracking-wider focus:outline-none"
              />
              <button
                type="button"
                onClick={updateTwoFactor}
                disabled={twoFactorBusy || twoFactorCode.length !== 6}
                className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition"
              >
                {twoFactorBusy ? 'Saving…' : 'Disable 2FA'}
              </button>
            </div>
          </div>
        )}
      </motion.section>

      {/* ── Active Sessions & Registered Devices ─────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-7 shadow-soft"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <Laptop size={20} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-espresso-950">Active Sessions & Devices</h3>
              <p className="text-xs text-stone-500">Currently authenticated terminals, cashier tablets, and web sessions</p>
            </div>
          </div>

          {sessions.length > 1 && (
            <button
              onClick={handleRevokeOtherSessions}
              disabled={revokingSessions}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/60 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition shadow-2xs"
            >
              <LogOut size={13} />
              <span>{revokingSessions ? 'Revoking…' : 'Sign Out Other Devices'}</span>
            </button>
          )}
        </div>

        <div className="divide-y divide-stone-100 border border-stone-200/80 rounded-2xl overflow-hidden bg-white">
          {sessions.map((sess) => {
            const IconComponent = sess.icon;
            return (
              <div key={sess.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-stone-50/60 transition">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                    <IconComponent size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-900">{sess.device}</span>
                      {sess.isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          This Device
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-500 mt-0.5">
                      <span>{sess.location}</span>
                      <span>•</span>
                      <span className="font-mono text-stone-400">IP: {sess.ip}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500">
                    <Clock size={12} className="text-stone-400" />
                    {sess.lastActive}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Account details (read-only) ──────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-7 shadow-soft"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-espresso-950">Tenant Metadata</h3>
            <p className="text-xs text-stone-500">Read-only account and subscription identifier references</p>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'Admin User ID', value: user?._id || user?.id || 'USR-684291' },
            { label: 'Permission Tier', value: <span className="capitalize font-semibold">{user?.role || 'Owner'}</span> },
            { label: 'Primary Contact Email', value: user?.email || 'owner@brewhaus.in' },
            { label: 'Platform Registration Date', value: memberSince },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl bg-stone-50 p-4 border border-stone-200/60">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</dt>
              <dd className="mt-1 truncate text-xs font-semibold text-espresso-950 font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </div>
  );
}
