// PriorityMail Edge Function: gmail-labels
// Lists Gmail labels for a specific connected account.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser, getAdminClient } from '../_shared/supabaseClient.ts';
import { decrypt, encrypt } from '../_shared/crypto.ts';
import { refreshGoogleToken } from '../_shared/googleAuth.ts';
import { listLabels } from '../_shared/gmailApi.ts';

serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { user } = await requireUser(req);
    const url = new URL(req.url);
    const accountId = url.searchParams.get('accountId');

    if (!accountId) {
      return errorResponse('Missing accountId parameter', 400);
    }

    const adminClient = getAdminClient();

    // Verify account ownership
    const { data: account } = await adminClient
      .from('connected_google_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!account) {
      return errorResponse('Connected account not found or unauthorized', 404);
    }

    const { data: cred } = await adminClient
      .from('gmail_credentials')
      .select('encrypted_refresh_token, encrypted_access_token, expires_at')
      .eq('connected_account_id', accountId)
      .maybeSingle();

    if (!cred) {
      return errorResponse('Credentials not found', 404);
    }

    let accessToken = cred.encrypted_access_token ? await decrypt(cred.encrypted_access_token) : '';
    const refreshToken = await decrypt(cred.encrypted_refresh_token);
    const expiresAtMs = new Date(cred.expires_at).getTime();

    if (!accessToken || expiresAtMs - Date.now() < 5 * 60 * 1000) {
      const refreshed = await refreshGoogleToken(refreshToken);
      accessToken = refreshed.accessToken;
      const encAccess = await encrypt(accessToken);

      await adminClient
        .from('gmail_credentials')
        .update({
          encrypted_access_token: encAccess,
          expires_at: refreshed.expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('connected_account_id', accountId);
    }

    const labels = await listLabels(accessToken);
    return jsonResponse({ labels });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gmail-labels] error:', msg);
    return errorResponse(msg, 500);
  }
});
