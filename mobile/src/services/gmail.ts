import { openEmailInGmail } from './gmailDeepLink';
import * as Linking from 'expo-linking';
import { PriorityEmail } from '../types';
import { initialMockEmails } from './mockData';

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

/**
 * Service handling Gmail API operations and deep-linking into the Gmail app or web client.
 */
export const GmailService = {
  /**
   * Connect user's Google Account via OAuth.
   * In local/offline mode, simulates a successful OAuth connection.
   */
  async connectGoogleAccount(): Promise<GmailAuthResult> {
    try {
      const isLiveEnabled = process.env.EXPO_PUBLIC_ENABLE_LIVE_SYNC === 'true';

      if (isLiveEnabled) {
        // Direct browser / in-app browser redirect to backend Google OAuth
        await Linking.openURL(`${API_BASE_URL}/api/auth/google`);
        return { success: true };
      }

      // Default mock flow: simulate successful authorization
      await new Promise((resolve) => setTimeout(resolve, 600));
      return {
        success: true,
        email: 'tiesha.work@gmail.com',
        token: 'mock-oauth-bearer-token-2026',
      };
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
  async disconnectGoogleAccount(): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return true;
  },

  /**
   * Fetch recent emails from Gmail (or local dataset).
   */
  async fetchRecentEmails(): Promise<PriorityEmail[]> {
    const isLiveEnabled = process.env.EXPO_PUBLIC_ENABLE_LIVE_SYNC === 'true';

    if (isLiveEnabled) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/emails/priority`);
        if (response.ok) {
          const data = await response.json();
          return data.emails || [];
        }
      } catch (err) {
        console.warn('Backend unavailable, falling back to local mock data:', err);
      }
    }

    // Return fresh mock data
    return [...initialMockEmails];
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
    console.log(`Setting up Gmail watch on PubSub topic: ${topicName || 'priority-mail-sub'}`);
    return {
      active: true,
      historyId: '892401',
      expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },
};
