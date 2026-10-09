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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-2xl text-slate-800 dark:text-stone-100 z-10"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X size={16} />
          </button>

          {/* Header Icon + Title */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                isDanger
                  ? 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                  : isWarning
                  ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-cyan-200 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
              }`}
            >
              {isDanger ? <ShieldAlert size={22} /> : <AlertTriangle size={22} />}
            </div>

            <div className="pr-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-stone-400 leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Reason Input (Mandatory for Suspend / Status Changes) */}
          {requireReason && (
            <div className="my-4 space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-stone-300">
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
                      className="rounded-md border border-slate-200 dark:border-stone-800 bg-slate-100 dark:bg-stone-950/80 px-2 py-1 text-[11px] text-slate-600 dark:text-stone-400 hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-300 transition"
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
                className="w-full rounded-xl border border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-950 px-3.5 py-2.5 text-xs text-slate-900 dark:text-stone-100 placeholder-slate-400 dark:placeholder-stone-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
              />

              {error && <p className="text-xs font-medium text-red-500">{error}</p>}
              <p className="text-[11px] text-slate-400 dark:text-stone-500">
                This note will be recorded in the immutable platform audit trail for compliance.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-50"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm disabled:opacity-50 ${
                isDanger
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-amber-500 text-stone-950 hover:bg-amber-400'
              }`}
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
