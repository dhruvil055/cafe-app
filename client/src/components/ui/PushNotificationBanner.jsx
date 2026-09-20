import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export default function PushNotificationBanner() {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // Only show if supported and not already decided
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return;
    }

    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return;
    }

    const dismissed = localStorage.getItem('brewhaus_push_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // Delay display politely by 3.5 seconds
    const timer = setTimeout(() => {
      setVisible(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('brewhaus_push_dismissed', Date.now().toString());
    setVisible(false);
  };

  const handleEnable = async () => {
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast('Notification permission was not granted.', { icon: 'ℹ️' });
        setVisible(false);
        return;
      }

      // Register SW
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get VAPID public key
      const { data } = await api.get('/notifications/vapid-public-key');
      if (!data?.publicKey) throw new Error('VAPID key not available.');

      const convertedKey = urlBase64ToUint8Array(data.publicKey);

      // Subscribe to PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      // Send subscription to backend
      await api.post('/notifications/subscribe', {
        subscription: subscription.toJSON(),
      });

      toast.success("Notifications enabled! You'll receive exclusive Brewhaus deals.");
      setVisible(false);
    } catch (err) {
      console.error('Push enable error:', err);
      toast.error('Unable to enable notifications.');
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
          <div className="rounded-3xl border border-foam bg-white p-5 shadow-xl text-espresso-900">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brew-100 text-brew-700">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold leading-tight">Want exclusive Brewhaus offers?</h3>
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
                <Check size={13} className="text-brew-600 shrink-0" />
                <span>Special offers & discounts</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={13} className="text-brew-600 shrink-0" />
                <span>New seasonal menu items</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={13} className="text-brew-600 shrink-0" />
                <span>Weekend coffee deals</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 pt-2 border-t border-foam">
              <button
                onClick={handleEnable}
                disabled={subscribing}
                className="btn-primary flex-1 text-xs py-2 px-3 justify-center shadow-none"
              >
                {subscribing ? 'Enabling...' : 'Enable Notifications'}
              </button>
              <button
                onClick={handleDismiss}
                className="btn-secondary text-xs py-2 px-3"
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
