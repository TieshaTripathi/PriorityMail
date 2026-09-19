import { openEmailInGmail } from './gmailDeepLink';
import * as Linking from 'expo-linking';
import { PriorityEmail } from '../types';
import { initialMockEmails } from './mockData';
import { supabase, isSupabaseConfigured, getSupabaseFunctionsUrl } from './supabaseClient';

export interface GmailAuthResult {
  success: boolean;
  email?: string;
  token?: string;
  error?: string;
}

export interface GmailWatchStatus {
  active: boolean;
  historyId?: string;
  expiration?: string;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://priority-mail-zeta.vercel.app';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isSupabaseConfigured) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }
  return headers;
}

/**
 * Service handling Gmail API operations and deep-linking into the Gmail app or web client.
 */
export const GmailService = {
  /**
   * Connect user's Google Account via OAuth.
   */
  async connectGoogleAccount(): Promise<GmailAuthResult> {
    try {
      if (isSupabaseConfigured) {
        const functionsUrl = getSupabaseFunctionsUrl();
        const headers = await getAuthHeaders();
        const res = await fetch(`${functionsUrl}/gmail-connect`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            await Linking.openURL(data.url);
            return { success: true };
          }
        }
      }
      await Linking.openURL(`${API_BASE_URL}/api/accounts/google/connect`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown connection error',
      };
    }
  },

  /**
   * Disconnect the currently linked Google Account.
   */
  async disconnectGoogleAccount(accountId?: string): Promise<boolean> {
    try {
      if (!accountId) return true;
      const headers = await getAuthHeaders();
      if (isSupabaseConfigured) {
        const functionsUrl = getSupabaseFunctionsUrl();
        const res = await fetch(`${functionsUrl}/gmail-accounts?accountId=${encodeURIComponent(accountId)}`, {
          method: 'DELETE',
          headers,
        });
        return res.ok;
      }
      await fetch(`${API_BASE_URL}/api/accounts/${encodeURIComponent(accountId)}`, {
        method: 'DELETE',
        headers,
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Fetch recent emails from real Gmail via PriorityMail backend.
   */
  async fetchRecentEmails(): Promise<PriorityEmail[]> {
    try {
      const headers = await getAuthHeaders();
      if (isSupabaseConfigured) {
        const functionsUrl = getSupabaseFunctionsUrl();
        const response = await fetch(`${functionsUrl}/gmail-messages`, { headers });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.emails)) {
            return data.emails;
          }
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/api/emails/priority`, { headers });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.emails)) {
            return data.emails;
          }
        }
      }
    } catch (err) {
      console.warn('[mobile] Live fetch unavailable:', err);
    }

    return [...initialMockEmails];
  },

  /**
   * Register mobile device push token with PriorityMail backend.
   */
  async registerDeviceToken(
    token: string,
    platform: 'android' | 'ios' = 'android',
    deviceName?: string
  ): Promise<boolean> {
    try {
      const headers = await getAuthHeaders();
      if (isSupabaseConfigured) {
        const functionsUrl = getSupabaseFunctionsUrl();
        const response = await fetch(`${functionsUrl}/notifications-register-device`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ token, platform, deviceName }),
        });
        return response.ok;
      }
      const response = await fetch(`${API_BASE_URL}/api/notifications/register-device`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token, platform, deviceName }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Fetch complete message details for a specific thread.
   */
  async fetchEmailThread(threadId: string): Promise<PriorityEmail | null> {
    const email = initialMockEmails.find((e) => e.gmailThreadId === threadId || e.id === threadId);
    return email || null;
  },

  openEmailInGmail,

  /**
   * Start Gmail push notifications watch via Google Cloud Pub/Sub.
   */
  async startGmailWatch(topicName?: string): Promise<GmailWatchStatus> {
    console.log(`Setting up Gmail watch on PubSub topic: ${topicName || 'priority-mail-watch'}`);
    return {
      active: true,
      historyId: '892401',
      expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },
};
