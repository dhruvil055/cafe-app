import { useState } from 'react';
import { AlertTriangle, LogOut, Loader2, ShieldCheck } from 'lucide-react';
import api from '../../services/api';

export default function ImpersonationBanner({ cafeName, onExit }) {
  const [loading, setLoading] = useState(false);

  const handleExit = async () => {
    setLoading(true);
    try {
      await api.post('/platform/admin/exit-impersonation').catch(() => {});
    } finally {
      sessionStorage.removeItem('brewhaus_impersonating_cafe');
      if (onExit) {
        onExit();
      } else {
        window.location.reload();
      }
    }
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between border-b border-amber-500/30 bg-[var(--warning-bg)] px-4 py-2.5 text-xs font-medium text-amber-200 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
          <AlertTriangle size={13} />
        </span>
        <span>
          <strong className="font-semibold text-amber-300">Impersonation Mode Active:</strong>{' '}
          You are currently viewing the platform as{' '}
          <span className="underline decoration-amber-400/50 underline-offset-2 font-bold text-white">
            {cafeName || 'Selected Café'}
          </span>
          . All actions are attributed in the platform audit log.
        </span>
      </div>

      <button
        onClick={handleExit}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1 font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
        Exit Impersonation
      </button>
    </div>
  );
}