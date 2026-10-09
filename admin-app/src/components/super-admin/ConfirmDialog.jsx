import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ShieldAlert, X, Loader2 } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' | 'warning' | 'info'
  requireReason = false,
  reasonPlaceholder = 'Please specify the reason for this administrative action...',
  suggestedReasons = [],
  loading = false,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setError('A reason is mandatory for this audit-logged platform action.');
      return;
    }
    onConfirm(reason.trim());
  };

  const isDanger = type === 'danger';
  const isWarning = type === 'warning';

  const getTypeStyles = () => {
    if (isDanger) {
      return {
        iconBg: 'bg-[var(--danger-bg)] border-[var(--danger-border)] text-[var(--danger-text)]',
        icon: <ShieldAlert size={22} />,
        confirmBtn: 'bg-red-600 text-white hover:bg-red-500',
      };
    }
    if (isWarning) {
      return {
        iconBg: 'bg-[var(--warning-bg)] border-[var(--warning-border)] text-[var(--warning-text)]',
        icon: <AlertTriangle size={22} />,
        confirmBtn: 'bg-amber-500 text-stone-950 hover:bg-amber-400',
      };
    }
    return {
      iconBg: 'bg-[var(--info-bg)] border-[var(--info-border)] text-[var(--info-text)]',
      icon: <AlertTriangle size={22} />,
      confirmBtn: 'bg-cyan-600 text-white hover:bg-cyan-500',
    };
  };

  const styles = getTypeStyles();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0"
          style={{ backgroundColor: 'var(--modal-backdrop)', backdropFilter: 'blur(4px)' }}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl text-[var(--text-primary)] z-10"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition"
          >
            <X size={16} />
          </button>

          {/* Header Icon + Title */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${styles.iconBg}`}
            >
              {styles.icon}
            </div>

            <div className="pr-6">
              <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">{title}</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Reason Input (Mandatory for Suspend / Status Changes) */}
          {requireReason && (
            <div className="my-4 space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Action Reason <span className="text-red-500">*</span>
              </label>

              {suggestedReasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {suggestedReasons.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        setReason(sug);
                        setError('');
                      }}
                      className="rounded-md border border-[var(--border-primary)] bg-[var(--hover-bg)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-300 transition"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError('');
                }}
                rows={3}
                placeholder={reasonPlaceholder}
                className="input-field"
              />

              {error && <p className="text-xs font-medium text-red-500">{error}</p>}
              <p className="text-[11px] text-[var(--text-muted)]">
                This note will be recorded in the immutable platform audit trail for compliance.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-primary)]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition disabled:opacity-50"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm disabled:opacity-50 ${styles.confirmBtn}`}
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}