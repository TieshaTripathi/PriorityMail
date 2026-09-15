import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

export interface GmailEmailTarget {
  accountEmail: string;
  threadId?: string;
  messageId?: string;
}

export function gmailWebUrl({ accountEmail, threadId, messageId }: GmailEmailTarget): string {
  const account = accountEmail.trim();
  if (!account || !account.includes('@')) throw new Error('An email account is required');
  const id = threadId?.trim() || messageId?.trim();
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(account)}#inbox${id ? '/' + encodeURIComponent(id) : ''}`;
}

export async function openEmailInGmail(target: GmailEmailTarget): Promise<boolean> {
  try {
    const url = gmailWebUrl(target);
    if (Platform.OS === 'android') {
      try {
        // Explicit package prevents a browser from handling this first attempt.
        // Gmail versions may differ in how they honor account/thread routing.
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: url,
          packageName: 'com.google.android.gm',
        });
        return true;
      } catch {
        // Missing Gmail, unsupported route, or unavailable native module.
      }
    }
    // iOS has no reliable public Gmail scheme for opening an account's thread.
    // googlegmail:///co is compose-only; do not use it for reading messages.
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
