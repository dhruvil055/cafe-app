import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, UserPlus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InviteOwnerModal({ isOpen, onClose, tenant, onInviteSuccess }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !tenant) return null;

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Owner email is required.');
      return;
    }

    setLoading(true);
    try {
      // Simulate/trigger owner invitation logic
      await new Promise((r) => setTimeout(r, 600));
      toast.success(`Invitation successfully sent to ${email} for "${tenant.name}"!`);
      if (onInviteSuccess) {
        onInviteSuccess(tenant.id, { email, name: name || `${tenant.name} Owner` });
      }
      onClose();
    } catch (err) {
      toast.error('Failed to send invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0"
          style={{ backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(4px)' }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl text-[var(--text-primary)] z-10"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Assign & Invite Owner</h3>
              <p className="text-xs text-[var(--text-muted)]">Café: {tenant.name}</p>
            </div>
          </div>

          <form onSubmit={handleInvite} className="space-y-3.5 mt-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                Owner Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                Owner Work Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-3 text-[var(--text-muted)]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@domain.com"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] leading-normal pt-1">
              An onboarding email with a one-time secure activation link will be dispatched to this address.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-primary)] mt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-stone-950 hover:bg-amber-400 transition disabled:opacity-50"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                Send Invitation
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}