// PriorityMail Edge Function: gmail-watch-renew
// Scheduled job: Renews Gmail users.watch registrations for accounts nearing expiration.
// Can be invoked via pg_cron or scheduled runner with Service Role authorization.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { decrypt, encrypt } from '../_shared/crypto.ts';
import { refreshGoogleToken } from '../_shared/googleAuth.ts';
import { registerWatch } from '../_shared/gmailApi.ts';

serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const topicName = Deno.env.get('PUBSUB_TOPIC_NAME');
  if (!topicName) {
    return jsonResponse({
      success: false,
      message: 'PUBSUB_TOPIC_NAME not configured. Skipping watch renewal.',
    });
  }

  const adminClient = getAdminClient();

  try {
    // Find all accounts where watch is either missing or expiring within 48 hours
    const twoDaysFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: accounts, error: accErr } = await adminClient
      .from('connected_google_accounts')
      .select('id, user_id, email');

    if (accErr) throw accErr;

    let renewed = 0;
    let failed = 0;

    for (const acc of accounts ?? []) {
      try {
        const { data: cred } = await adminClient
          .from('gmail_credentials')
          .select('encrypted_refresh_token, encrypted_access_token, expires_at')
          .eq('connected_account_id', acc.id)
          .maybeSingle();

        if (!cred) continue;

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
            .eq('connected_account_id', acc.id);
        }

        const watch = await registerWatch(accessToken, topicName);

        await adminClient.from('gmail_watch_state').upsert(
          {
            connected_account_id: acc.id,
            user_id: acc.user_id,
            history_id: watch.historyId,
            expiration: watch.expiration,
            status: 'active',
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'connected_account_id' }
        );

        renewed++;
        console.log(`[gmail-watch-renew] Renewed watch for ${acc.email} until ${watch.expiration}`);
      } catch (e) {
        failed++;
        console.warn(`[gmail-watch-renew] Failed renewal for account ${acc.id}:`, e);
      }
    }

    return jsonResponse({
      success: true,
      renewed,
      failed,
      totalChecked: (accounts ?? []).length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gmail-watch-renew] error:', msg);
    return errorResponse(msg, 500);
  }
});
