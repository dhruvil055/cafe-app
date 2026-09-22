import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { isPushSupported, getNotificationPermission, subscribeToWebPush } from '../../utils/pushManager';

export default function PushNotificationBanner() {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;

    const perm = getNotificationPermission();
    if (perm === 'granted' || perm === 'denied') return;

    const dismissed = localStorage.getItem('brewhaus_push_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // Delay politely after customer interacts with the website
    const timer = setTimeout(() => {
      setVisible(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('brewhaus_push_dismissed', Date.now().toString());
    setVisible(false);
  };

  const handleEnable = async () => {
    setSubscribing(true);
    try {
      await subscribeToWebPush();
      toast.success("☕ Notifications enabled! You'll receive exclusive Brewhaus deals.");
      setVisible(false);
    } catch (err) {
      if (err.message === 'PERMISSION_DENIED') {
        toast.error('Notification permission was blocked in your browser settings.');
      } else if (err.message === 'PERMISSION_DISMISSED') {
        toast('Notification request was dismissed.', { icon: 'ℹ️' });
      } else {
        toast.error(err.message || 'Unable to enable notifications.');
      }
      setVisible(false);
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed bottom-20 sm:bottom-6 right-4 left-4 sm:left-auto sm:max-w-md z-40"
        >
          <div className="rounded-3xl border border-brew-200/90 bg-white p-5 shadow-2xl text-espresso-900">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brew-100 text-brew-700">
                  <span className="text-xl">☕</span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold leading-tight">Stay Updated with Brewhaus</h3>
                  <p className="text-xs text-espresso-500">Get notified about:</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-espresso-400 hover:text-espresso-700 p-1 rounded-full hover:bg-cream transition"
                aria-label="Close notification prompt"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-espresso-700 pl-1">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-brew-600 shrink-0 font-bold" />
                <span>Special offers</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-brew-600 shrink-0 font-bold" />
                <span>New menu items</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-brew-600 shrink-0 font-bold" />
                <span>Weekend deals</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-brew-600 shrink-0 font-bold" />
                <span>Café updates</span>
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
