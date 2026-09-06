import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import useCartStore from '../context/cartStore';

const SESSION_EXPIRY_CODES = new Set(['SESSION_EXPIRED', 'SESSION_INVALID', 'SESSION_CLOSED']);
const VALIDATE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * useSessionValidator
 *
 * Validates the stored dining session token on:
 *   1. Component mount (page load / refresh / back-forward navigation)
 *   2. Route change
 *   3. Every VALIDATE_INTERVAL_MS while the tab is active
 *
 * On expiry/invalidity it calls invalidateSession() which clears the token
 * but keeps cart items so the customer can re-scan and continue.
 */
export function useSessionValidator() {
  const location = useLocation();
  const hasWarnedRef = useRef(false);

  const validate = useCallback(async () => {
    const { diningSessionToken, invalidateSession, sessionExpired, tableNumber } =
      useCartStore.getState();

    // Nothing to validate
    if (!diningSessionToken || sessionExpired) return;

    try {
      const res = await api.get('/session/validate', {
        params: { diningSessionToken },
      });
      const data = res.data;

      if (!data.valid) {
        if (!hasWarnedRef.current) {
          hasWarnedRef.current = true;
          toast.error(
            SESSION_EXPIRY_CODES.has(data.code)
              ? 'Your table session has expired. Please scan the table QR code again.'
              : 'Your table session is no longer valid. Please scan the table QR code again.',
            { duration: 6000, id: 'session-expired' }
          );
        }
        invalidateSession();
        return;
      }

      // Session is valid — reset the warning flag so it can fire again if needed
      hasWarnedRef.current = false;

      // If tableNumber drifted (e.g. URL param changed), keep store in sync
      if (data.tableNumber && data.tableNumber !== tableNumber) {
        useCartStore.getState().setTable(data.tableNumber);
      }
    } catch {
      // Network errors are silently ignored — we don't invalidate on connectivity issues
    }
  }, []);

  // Validate on mount and on every route change
  useEffect(() => {
    validate();
  }, [location.pathname, validate]);

  // Periodic recheck while the tab is open
  useEffect(() => {
    const interval = setInterval(validate, VALIDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [validate]);
}
