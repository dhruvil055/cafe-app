import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Lock, Shield, CheckCircle2, AlertCircle,
  Eye, EyeOff, Save, KeyRound, CalendarDays, Crown,
} from 'lucide-react';
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
      <label htmlFor={id} className="block text-sm font-semibold text-espresso-800">
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

  /* derived */
  const initials = (user?.name || 'A')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
    : '—';

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
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message });
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
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message });
    } finally {
      setPwSaving(false);
    }
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
    <div className="mx-auto max-w-3xl space-y-6">

      {/* ── Hero card ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-espresso-900 p-6 text-white shadow-soft"
      >
        {/* decorative circles */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brew-500/20" />
        <div className="pointer-events-none absolute -bottom-16 -right-4 h-52 w-52 rounded-full bg-espresso-700/40" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* avatar */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brew-500 font-display text-3xl font-bold text-white ring-4 ring-brew-500/30">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold">{user?.name || 'Admin'}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-brew-500/25 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brew-100">
                <Crown size={10} />
                {user?.role || 'admin'}
              </span>
            </div>
            <div className="mt-1 text-sm text-espresso-300">{user?.email}</div>
          </div>
        </div>

        {/* stat row */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-espresso-800/60 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-espresso-400">
              <Shield size={10} /> Role
            </div>
            <div className="mt-1 text-sm font-semibold text-white capitalize">{user?.role || '—'}</div>
          </div>
          <div className="rounded-xl bg-espresso-800/60 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-espresso-400">
              <CalendarDays size={10} /> Member since
            </div>
            <div className="mt-1 text-sm font-semibold text-white">{memberSince}</div>
          </div>
          <div className="rounded-xl bg-espresso-800/60 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-espresso-400">
              <CheckCircle2 size={10} /> Status
            </div>
            <div className="mt-1 text-sm font-semibold text-emerald-400">Active</div>
          </div>
        </div>
      </motion.div>

      {/* ── Edit profile ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brew-50 text-brew-600">
            <User size={18} />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-espresso-900">Edit Profile</h3>
            <p className="text-xs text-stone-500">Update your name and email address</p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4">
          {profileMsg && <Alert type={profileMsg.type} message={profileMsg.text} />}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="profile-name" className="block text-sm font-semibold text-espresso-800">
                Full Name
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                  <User size={15} />
                </span>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-4 text-sm text-stone-900 outline-none ring-brew-400 transition placeholder:text-stone-400 focus:border-brew-400 focus:ring-2"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="profile-email" className="block text-sm font-semibold text-espresso-800">
                Email Address
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                  <Mail size={15} />
                </span>
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-4 text-sm text-stone-900 outline-none ring-brew-400 transition placeholder:text-stone-400 focus:border-brew-400 focus:ring-2"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={profileSaving}
              className="btn-primary gap-2 px-5 py-2.5 text-sm disabled:cursor-wait"
            >
              <Save size={15} />
              {profileSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* ── Change password ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <KeyRound size={18} />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-espresso-900">Change Password</h3>
            <p className="text-xs text-stone-500">Use a strong password with at least 8 characters</p>
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
                    <span>Strength</span>
                    <span>{pwStrength.label}</span>
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

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pwSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
            >
              <Lock size={15} />
              {pwSaving ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* ── Account details (read-only) ──────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Shield size={18} />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-espresso-900">Account Details</h3>
            <p className="text-xs text-stone-500">Read-only account metadata</p>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'Account ID', value: user?._id || user?.id || '—' },
            { label: 'Role', value: <span className="capitalize">{user?.role || '—'}</span> },
            { label: 'Email', value: user?.email || '—' },
            { label: 'Member Since', value: memberSince },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-stone-50 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">{label}</dt>
              <dd className="mt-1 truncate text-sm font-medium text-espresso-900">{value}</dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </div>
  );
}
