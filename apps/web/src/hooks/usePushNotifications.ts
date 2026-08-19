'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface UsePushNotificationsReturn {
  /** Whether the browser supports push notifications at all. */
  supported: boolean;
  /** Current Notification.permission mapped to our PushPermission type. */
  permission: PushPermission;
  /** True while subscribe() is running. */
  subscribing: boolean;
  /** Subscribe the current device and POST the subscription to the backend. */
  subscribe: () => Promise<void>;
  /** Unsubscribe the current device and DELETE the subscription from the backend. */
  unsubscribe: () => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a URL-safe Base64 string (as returned by the VAPID key endpoint)
 * into a Uint8Array for use with PushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isBrowserSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

function readPermission(): PushPermission {
  if (!isBrowserSupported()) return 'unsupported';
  // Notification.permission is 'default' | 'granted' | 'denied'
  return Notification.permission as PushPermission;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages Web Push subscription lifecycle.
 *
 * Usage:
 *   const { supported, permission, subscribe, unsubscribe, subscribing } = usePushNotifications();
 *
 * The hook does NOT auto-subscribe on mount — it only reads the current state.
 * Call subscribe() explicitly (e.g. from a button onClick).
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const supported = isBrowserSupported();
  const [permission, setPermission] = useState<PushPermission>(readPermission);
  const [subscribing, setSubscribing] = useState(false);

  // Keep permission state in sync if the user changes it in the browser UI
  useEffect(() => {
    if (!supported) return;
    setPermission(readPermission());
  }, [supported]);

  const subscribe = useCallback(async (): Promise<void> => {
    if (!supported) return;
    setSubscribing(true);
    try {
      // 1. Fetch VAPID public key — no auth required
      const { data } = await apiClient.get<{ publicKey: string }>(
        '/notifications/push/vapid-public-key',
      );
      if (!data.publicKey) throw new Error('VAPID public key not available');

      // 2. Register service worker (must exist at /sw.js)
      const registration = await navigator.serviceWorker.ready;

      // 3. Subscribe via PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey).buffer as ArrayBuffer,
      });

      // 4. POST subscription to backend
      const raw = subscription.toJSON();
      // @reason: PushSubscriptionJSON.keys is typed as Record<string,string>|undefined; asserting presence
      const keys = raw.keys as { p256dh: string; auth: string } | undefined;
      if (!raw.endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error('Subscription object missing required fields');
      }
      await apiClient.post('/notifications/push/subscribe', {
        endpoint: raw.endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      });

      setPermission('granted');
    } catch (err) {
      // Re-read the actual browser permission in case the user denied
      setPermission(readPermission());
      throw err;
    } finally {
      setSubscribing(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notify backend so the row is removed
      await apiClient.delete('/notifications/push/unsubscribe', {
        data: { endpoint },
      });
    } finally {
      setPermission(readPermission());
    }
  }, [supported]);

  return { supported, permission, subscribing, subscribe, unsubscribe };
}
