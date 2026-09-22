import api from '../services/api';

/**
 * Converts a base64 string to a Uint8Array for PushManager applicationServerKey
 */
export const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Checks if Push Notifications are supported in the current browser environment
 */
export const isPushSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
};

/**
 * Gets current notification permission status: 'default', 'granted', or 'denied'
 */
export const getNotificationPermission = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

/**
 * Subscribes the current device to Web Push.
 * Never registers twice: reuses an existing registration/subscription and
 * upserts it on the backend (idempotent by endpoint).
 */
export const subscribeToWebPush = async ({ customerId, phone } = {}) => {
  if (!isPushSupported()) {
    throw new Error('Notifications are not supported on this browser.');
  }

  // 1. Request user permission (only after explicit user click upstream)
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'PERMISSION_DENIED' : 'PERMISSION_DISMISSED');
  }

  // 2. Reuse existing Service Worker registration (avoid duplicates)
  let registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js');
  }
  await navigator.serviceWorker.ready;

  // 3. Fetch VAPID public key (never the private key)
  let publicKey = null;
  try {
    const res = await api.get('/notifications/vapid-public-key');
    publicKey = res.data?.publicKey;
  } catch {
    const res = await api.get('/push/vapid-public-key');
    publicKey = res.data?.publicKey;
  }

  if (!publicKey) {
    throw new Error('VAPID public key could not be retrieved from server.');
  }

  // 4. Reuse an existing push subscription when present
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  // 5. Send subscription payload to backend (upsert by endpoint)
  const resolvedCustomerId = customerId || localStorage.getItem('brewhaus_customer_id') || undefined;
  const resolvedPhone = phone || localStorage.getItem('brewhaus_customer_phone') || undefined;

  const payload = {
    subscription: subscription.toJSON(),
    customerId: resolvedCustomerId,
    phone: resolvedPhone,
    userAgent: navigator.userAgent,
  };

  try {
    await api.post('/notifications/subscribe', payload);
  } catch {
    await api.post('/push/subscribe', payload);
  }

  localStorage.setItem('brewhaus_push_enabled', 'true');
  return subscription;
};

/**
 * Unsubscribes current device from Web Push
 */
export const unsubscribeFromWebPush = async () => {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        try {
          await api.delete('/notifications/unsubscribe', { data: { endpoint: subscription.endpoint } });
        } catch {
          await api.delete('/push/unsubscribe', { data: { endpoint: subscription.endpoint } });
        }
      }
    }
    localStorage.removeItem('brewhaus_push_enabled');
  } catch (err) {
    console.error('Error during web push unsubscribe:', err);
    throw err;
  }
};
