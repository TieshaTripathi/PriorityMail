export interface GmailTarget { accountEmail: string; threadId?: string; messageId?: string }

export function gmailWebUrl({ accountEmail, threadId, messageId }: GmailTarget): string {
  const account = accountEmail.trim();
  if (!account || !account.includes('@')) throw new Error('This email needs a Gmail account.');
  const id = threadId?.trim() || messageId?.trim();
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(account)}#inbox${id ? '/' + encodeURIComponent(id) : ''}`;
}

export function gmailAndroidIntent(target: GmailTarget): string {
  const url = gmailWebUrl(target);
  // Gmail's fragment belongs in encoded data, not the intent's #Intent block.
  return `intent://${url.slice('https://'.length).replace('#', '%23')}#Intent;scheme=https;package=com.google.android.gm;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

export function openEmailInGmail(target: GmailTarget): void {
  const webUrl = gmailWebUrl(target);
  if (/Android/i.test(navigator.userAgent)) {
    // Must run synchronously from a tap; Chrome handles the web fallback.
    // Keep a visible ordinary web link in the UI for browsers blocking intents.
    window.location.assign(gmailAndroidIntent(target));
  } else {
    // iOS does not expose a supported exact-thread Gmail scheme. HTTPS gives
    // the OS any available app-link handling, otherwise opens Gmail web.
    window.location.assign(webUrl);
  }
}
