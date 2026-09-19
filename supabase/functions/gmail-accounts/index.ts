// PriorityMail Edge Function: gmail-accounts
// List or disconnect connected Gmail accounts for the authenticated user.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser, getAdminClient } from '../_shared/supabaseClient.ts';
import { decrypt } from '../_shared/crypto.ts';
import { revokeGoogleToken } from '../_shared/googleAuth.ts';

serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { user } = await requireUser(req);
    const adminClient = getAdminClient();

    // 1. GET: List accounts
    if (req.method === 'GET') {
      const { data: accounts, error } = await adminClient
        .from('connected_google_accounts')
        .select('id, user_id, google_account_id, email, display_name, avatar_url, is_primary, created_at')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formatted = (accounts ?? []).map((a) => ({
        id: a.id,
        userId: a.user_id,
        googleUserId: a.google_account_id,
        email: a.email,
        displayName: a.display_name,
        avatarUrl: a.avatar_url || undefined,
        isPrimary: a.is_primary,
        createdAt: a.created_at,
      }));

      return jsonResponse(formatted);
    }

    // 2. DELETE: Disconnect account
    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      let accountId = url.searchParams.get('accountId');

      if (!accountId) {
        try {
          const body = await req.json();
          accountId = body.accountId;
        } catch {
          // ignore json parse error
        }
      }

      if (!accountId) {
        return errorResponse('Missing accountId parameter', 400);
      }

      // Verify the account belongs to this user
      const { data: account } = await adminClient
        .from('connected_google_accounts')
        .select('id')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!account) {
        return errorResponse('Connected account not found or unauthorized', 404);
      }

      // Try to revoke token at Google
      const { data: cred } = await adminClient
        .from('gmail_credentials')
        .select('encrypted_refresh_token, encrypted_access_token')
        .eq('connected_account_id', accountId)
        .maybeSingle();

      if (cred?.encrypted_refresh_token) {
        try {
          const refreshToken = await decrypt(cred.encrypted_refresh_token);
          await revokeGoogleToken(refreshToken);
        } catch (e) {
          console.warn('[gmail-accounts] Revoke token failed:', e);
        }
      }

      // Delete the account (cascades to credentials, watch state, metadata)
      const { error: delErr } = await adminClient
        .from('connected_google_accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', user.id);

      if (delErr) throw delErr;

      console.log(`[gmail-accounts] Disconnected account ${accountId} for user ${user.id}`);
      return jsonResponse({ ok: true });
    }

    return errorResponse(`Method ${req.method} not allowed`, 405);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gmail-accounts] error:', msg);
    return errorResponse(msg, 401);
  }
});
