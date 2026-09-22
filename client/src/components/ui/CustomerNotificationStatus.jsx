import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { isPushSupported, getNotificationPermission, subscribeToWebPush } from '../../utils/pushManager';

export default function CustomerNotificationStatus() {
  const [permission, setPermission] = useState('default');
  const [enabling, setEnabling] = useState(false);

  const refreshStatus = () => {
    if (!isPushSupported()) {
      setPermission('unsupported');
      return;
    }
    setPermission(getNotificationPermission());
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleEnable = async () => {
    setEnabling(true);
    try {
      await subscribeToWebPush();
      setPermission('granted');
      toast.success('☕ Notifications enabled successfully!');
    } catch (err) {
      if (err.message === 'PERMISSION_DENIED') {
        setPermission('denied');
        toast.error('Notifications are blocked by your browser settings.');
      } else {
        toast.error(err.message || 'Unable to enable notifications.');
      }
    } finally {
      setEnabling(false);
    }
  };

  if (permission === 'unsupported') {
    return null;
  }

  return (
    <div className="rounded-2xl border border-foam bg-white p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            permission === 'granted'
              ? 'bg-emerald-100 text-emerald-700'
              : permission === 'denied'
              ? 'bg-rose-100 text-rose-700'
              : 'bg-brew-100 text-brew-700'
          }`}>
            <Bell size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-espresso-900">Notifications</span>
              {permission === 'granted' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={12} /> Notifications Enabled
                </span>
              ) : permission === 'denied' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                  <XCircle size={12} /> Notifications Blocked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600 border border-stone-200">
                  Notifications Disabled
                </span>
              )}
            </div>
            <p className="text-xs text-espresso-500 mt-0.5">
              {permission === 'granted'
                ? 'You are all set to receive weekend specials, menu updates, and offers directly in this browser.'
                : permission === 'denied'
                ? 'Notifications are blocked in your browser site settings. Tap the lock icon in the address bar to allow them.'
                : 'Turn on notifications to get instant café updates and exclusive weekend specials.'}
            </p>
          </div>
        </div>

        {permission === 'default' && (
          <button
            onClick={handleEnable}
            disabled={enabling}
            className="btn-primary text-xs py-2 px-3 shrink-0 justify-center disabled:opacity-60"
          >
            {enabling ? 'Enabling...' : 'Enable Notifications'}
          </button>
        )}
      </div>
    </div>
  );
}
