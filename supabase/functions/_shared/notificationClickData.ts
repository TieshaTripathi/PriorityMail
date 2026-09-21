export function notificationClickData(payload: {
  emailId?: string;
  internalEmailId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  connectedAccountId?: string;
  accountEmail: string;
}) {
  const emailId = payload.emailId || payload.internalEmailId;
  const url = new URL('https://priority-mail-zeta.vercel.app/');
  if (emailId) url.searchParams.set('email', emailId);
  return {
    emailId,
    url: url.href,
    gmailMessageId: payload.gmailMessageId,
    gmailThreadId: payload.gmailThreadId,
    connectedAccountId: payload.connectedAccountId,
    accountEmail: payload.accountEmail,
  };
}
