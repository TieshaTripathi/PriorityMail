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

export function mockNotification(preferences: NotificationPreferences, kind: AlertKind = 'general', now = new Date()): string {
  if (!preferences.notifications) return 'Notifications are paused. Enable them in Settings.';
  if (kind === 'deadline' && !preferences.deadlineAlerts) return 'Deadline alerts are paused.';
  if (kind === 'vip' && !preferences.vipAlerts) return 'VIP alerts are paused.';
  const time = now.getHours() * 60 + now.getMinutes();
  const minutes = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const start = minutes(preferences.quietStart), end = minutes(preferences.quietEnd);
  const quiet = start === end || (start < end ? time >= start && time < end : time >= start || time < end);
  if (preferences.quietHours && quiet) return 'Quiet hours are active. Your demo alert was silenced.';
  return 'Demo alert · Placement Cell: your internship application needs attention.';
}

// For future OAuth-authenticated backend integration. No subscription is created yet.
export interface WebPushRegistration {
  accountId: string;
  subscription: PushSubscriptionJSON;
  preferences: NotificationPreferences;
}
export interface PushGateway {
  register(data: WebPushRegistration): Promise<void>;
  unregister(endpoint: string): Promise<void>;
}

export async function requestNotificationPermission(): Promise<string> {
  if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'System notifications need HTTPS and a supported browser. On iPhone, install to Home Screen first.';
  }
  try {
    const result = await Notification.requestPermission();
    return result === 'granted' ? 'Permission enabled. Live push delivery will be connected in a future release.' : 'Permission was not granted. In-app demo alerts still work.';
  } catch { return 'This browser could not enable notifications. Use the installed Home Screen app.'; }
}
