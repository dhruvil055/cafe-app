import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Bell, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { isPushSupported, getNotificationPermission, subscribeToWebPush } from '../../utils/pushManager';

export default function NotificationPermissionPrompt({
  customerId = null,
  phone = null,
  variant = 'card', // 'card' or 'floating'
  onSuccess = () => {},
  onDismiss = () => {},
}) {
  const [permissionState, setPermissionState] = useState('default');
  const [subscribing, setSubscribing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setPermissionState('unsupported');
      return;
    }
    setPermissionState(getNotificationPermission());

    const isDismissed = localStorage.getItem('brewhaus_push_dismissed_at');
    if (isDismissed && Date.now() - Number(isDismissed) < 7 * 24 * 60 * 60 * 1000) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('brewhaus_push_dismissed_at', Date.now().toString());
    setDismissed(true);
    onDismiss();
  };

  const handleEnable = async () => {
    setSubscribing(true);
    try {
      await subscribeToWebPush({ customerId, phone });
      setPermissionState('granted');
      toast.success('☕ Notifications enabled! You will now receive exclusive Brewhaus deals.');
      onSuccess();
    } catch (err) {
      if (err.message === 'PERMISSION_DENIED') {
        setPermissionState('denied');
        toast.error('Notifications were blocked. Please enable them in your browser site settings.');
      } else if (err.message === 'PERMISSION_DISMISSED') {
        toast('Notification request was dismissed.', { icon: 'ℹ️' });
      } else {
        toast.error(err.message || 'Failed to enable notifications.');
      }
    } finally {
      setSubscribing(false);
    }
  };

  if (permissionState === 'granted' || permissionState === 'unsupported' || dismissed) {
    return null;
  }

  const content = (
    <div className="rounded-2xl border border-brew-200/80 bg-white p-5 shadow-lg text-espresso-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brew-500/15 text-brew-700">
            <span className="text-xl">☕</span>
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-espresso-900 leading-tight">
              Stay Updated with Brewhaus
            </h3>
            <p className="text-xs text-espresso-500 mt-0.5">Get notified about:</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-espresso-400 hover:text-espresso-700 p-1 rounded-full transition"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {permissionState === 'denied' ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
          <AlertCircle size={16} className="shrink-0 text-amber-600 mt-0.5" />
          <p>
            Notifications are currently blocked in your browser. To enable them, please tap the lock icon in your browser address bar and allow notifications for this site.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-2 text-xs text-espresso-700 pl-1">
            <div className="flex items-center gap-2">
              <Check size={14} className="text-brew-600 shrink-0 font-bold" />
              <span>Special offers & seasonal discounts</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={14} className="text-brew-600 shrink-0 font-bold" />
              <span>New menu items & handcrafted drinks</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={14} className="text-brew-600 shrink-0 font-bold" />
              <span>Weekend coffee deals</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={14} className="text-brew-600 shrink-0 font-bold" />
              <span>Café updates & specials</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 pt-2 border-t border-foam">
            <button
              onClick={handleEnable}
              disabled={subscribing}
              className="btn-primary flex-1 text-xs py-2.5 px-3 justify-center shadow-none disabled:opacity-60"
            >
              {subscribing ? 'Enabling...' : 'Enable Notifications'}
            </button>
            <button
              onClick={handleDismiss}
              className="btn-secondary text-xs py-2.5 px-3"
            >
              Maybe Later
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (variant === 'floating') {
    return (
      <AnimatePresence>
        {!dismissed && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-20 sm:bottom-6 right-4 left-4 sm:left-auto sm:max-w-sm z-40"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full my-3"
    >
      {content}
    </motion.div>
  );
}
