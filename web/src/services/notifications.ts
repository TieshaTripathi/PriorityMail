import {
  getVapidPublicKey,
  subscribeWebPush,
  unsubscribeWebPush,
  sendTestNotificationApi,
} from './apiClient.ts';

export interface NotificationPreferences {
  notifications: boolean;
  aiClassification: boolean;
  deadlineAlerts: boolean;
  vipAlerts: boolean;
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
}

export type AlertKind = 'general' | 'deadline' | 'vip';

export function mockNotification(
  preferences: NotificationPreferences,
  kind: AlertKind = 'general',
  now = new Date(),
): string {
  if (!preferences.notifications) return 'Notifications are paused. Enable them in Settings.';
  if (kind === 'deadline' && !preferences.deadlineAlerts) return 'Deadline alerts are paused.';
  if (kind === 'vip' && !preferences.vipAlerts) return 'VIP alerts are paused.';
  const time = now.getHours() * 60 + now.getMinutes();
  const minutes = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const start = minutes(preferences.quietStart),
    end = minutes(preferences.quietEnd);
  const quiet =
    start === end || (start < end ? time >= start && time < end : time >= start || time < end);
  if (preferences.quietHours && quiet) return 'Quiet hours are active. Your demo alert was silenced.';
  return 'Demo alert · Placement Cell: your internship application needs attention.';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the browser currently supports Push notifications and service workers.
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Check if the current user already has an active push subscription in this browser.
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Enable push notifications from a direct user interaction (button click).
 * 1. Requests system permission
 * 2. Fetches VAPID key from backend
 * 3. Subscribes PushManager
 * 4. Sends subscription to backend for storage
 */
export async function enablePushNotifications(): Promise<{
  success: boolean;
  message: string;
}> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      message:
        'Push notifications require HTTPS. On iPhone, you must Add to Home Screen first and launch from the icon.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        message: 'Notification permission was denied. Please allow notifications in your browser or device settings.',
      };
    }

    const reg = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        return { success: false, message: 'VAPID public key not available from server.' };
      }

      const convertedKey = urlBase64ToUint8Array(vapidKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
    }

    // Register subscription with backend
    await subscribeWebPush(subscription.toJSON());

    return {
      success: true,
      message: 'Push notifications enabled successfully! You can now receive real-time email alerts.',
    };
  } catch (err) {
    console.error('[notifications] Enable push failed:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Could not enable push notifications.',
    };
  }
}

/**
 * Disable push notifications on this device.
 */
export async function disablePushNotifications(): Promise<{ success: boolean; message: string }> {
  if (!isPushNotificationSupported()) {
    return { success: true, message: 'Push notifications are not supported.' };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await unsubscribeWebPush(subscription.endpoint);
      await subscription.unsubscribe();
    }
    return { success: true, message: 'Push notifications have been disabled on this device.' };
  } catch (err) {
    console.error('[notifications] Disable push failed:', err);
    return { success: false, message: 'Failed to disable notifications.' };
  }
}

/**
 * Trigger an immediate test push to verify iPhone PWA or desktop push delivery.
 */
export async function triggerTestPush(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await sendTestNotificationApi();
    return { success: res.success, message: res.message };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to send test push.',
    };
  }
}
