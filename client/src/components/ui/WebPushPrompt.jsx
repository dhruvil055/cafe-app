import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToWebPush,
  ensureWebPushSubscription,
} from '../../utils/pushManager';

const DISMISS_KEY = 'brewhaus_push_dismissed';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // ask at most once a week

const isDismissed = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && Date.now() - at < COOLDOWN_MS;
  } catch {
    return false;
  }
};

/**
 * Minimal floating Web Push enrollment prompt.
 *
 * - Tiny, non-blocking, theme-matched; never a modal.
 * - Native browser permission is requested ONLY after the customer taps
 *   "Enable" (never on page load).
 * - If permission is already granted, silently verifies the subscription
 *   in the background and never shows any UI.
 * - "Not now" is remembered for 7 days; "denied" is never re-prompted.
 */
export default function WebPushPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const enableRef = useRef(null);

  useEffect(() => {
    if (!isPushSupported()) return;

    // Already granted → silent background sync, zero UI.
    if (getNotificationPermission() === 'granted') {
      const run = () => ensureWebPushSubscription();
      if ('requestIdleCallback' in window) {
        const id = window.requestIdleCallback(run, { timeout: 8000 });
        return () => window.cancelIdleCallback?.(id);
      }
      const timer = setTimeout(run, 4000);
      return () => clearTimeout(timer);
    }

    // Not granted → maybe show the small prompt (never for denied).
    if (getNotificationPermission() === 'denied') return;
    if (isDismissed()) return;

    // Defer until the page is usable so enrollment never blocks rendering.
    let timer;
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => {
        timer = setTimeout(() => setVisible(true), 2500);
      }, { timeout: 10000 });
      return () => {
        window.cancelIdleCallback?.(id);
        clearTimeout(timer);
      };
    }
    timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Move keyboard focus to the primary action when the prompt appears.
  useEffect(() => {
    if (visible) enableRef.current?.focus({ preventScroll: true });
  }, [visible]);

  // Esc dismisses like "Not now".
  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      /* storage unavailable — prompt simply stays hidden this session */
    }
    setVisible(false);
  };

  const handleEnable = async () => {
    setBusy(true);
    try {
      await subscribeToWebPush();
      setVisible(false); // never ask again on this device
    } catch {
      // Permission denied/dismissed or unsupported → hide quietly.
      // The Notifications settings row explains blocked state if needed.
      setVisible(false);
      if (getNotificationPermission() !== 'granted') handleDismiss();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          role="dialog"
          aria-live="polite"
          aria-label="Stay updated with website notifications"
          className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:w-80 z-40 rounded-2xl border border-foam bg-white/95 p-4 shadow-lg backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brew-500/15 text-brew-700" aria-hidden="true">
              <Bell size={17} />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-espresso-900">Stay updated</p>
              <p className="mt-0.5 text-xs leading-relaxed text-espresso-500">
                Get important updates and offers directly from our website.
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              ref={enableRef}
              onClick={handleEnable}
              disabled={busy}
              className="btn-primary flex-1 px-4 py-2 text-xs disabled:opacity-60"
            >
              {busy ? 'Enabling…' : 'Enable'}
            </button>
            <button
              onClick={handleDismiss}
              disabled={busy}
              className="btn-secondary px-4 py-2 text-xs disabled:opacity-60"
            >
              Not now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
