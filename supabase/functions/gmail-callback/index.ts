// PriorityMail Edge Function: gmail-callback
// Handles the Google OAuth callback after user grants Gmail read-only permissions.
// Exchanges code, encrypts refresh token, registers connected account, and starts Gmail watch.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import {
  verifyOAuthState,
  exchangeGoogleCode,
  getGoogleUserProfile,
  getFrontendUrl,
} from '../_shared/googleAuth.ts';
import { encrypt } from '../_shared/crypto.ts';
import { getProfile, registerWatch } from '../_shared/gmailApi.ts';

serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const frontendUrl = getFrontendUrl();

  if (oauthError || !code || !state) {
    console.error('[gmail-callback] OAuth error or missing code/state:', oauthError);
    return Response.redirect(`${frontendUrl}/#settings?connect_error=access_denied`, 302);
  }

  try {
    // 1. Verify signed state to ensure this callback belongs to an authenticated user
    const { userId } = await verifyOAuthState(state);
    if (!userId) {
      throw new Error('State verification yielded invalid userId');
    }

    // 2. Exchange authorization code for tokens
    const tokens = await exchangeGoogleCode(code);
    if (!tokens.refreshToken) {
      console.warn('[gmail-callback] Warning: no refresh_token received from Google.');
    }

    // 3. Retrieve user profile and Gmail address
    const googleUser = await getGoogleUserProfile(tokens.accessToken);
    let gmailEmail = googleUser.email;
    try {
      const profile = await getProfile(tokens.accessToken);
      if (profile.emailAddress) gmailEmail = profile.emailAddress;
    } catch (e) {
      console.warn('[gmail-callback] Fallback to OIDC email:', e);
    }

    const adminClient = getAdminClient();

    // 4. Check existing account for this user + google_account_id
    const { data: existingAccount } = await adminClient
      .from('connected_google_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('google_account_id', googleUser.sub)
      .maybeSingle();

    // Check if user has any existing connected accounts to determine primary status
    const { count: accountCount } = await adminClient
      .from('connected_google_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const isPrimary = (accountCount ?? 0) === 0;
    let connectedAccountId: string;

    if (existingAccount) {
      connectedAccountId = existingAccount.id;
      await adminClient
        .from('connected_google_accounts')
        .update({
          email: gmailEmail,
          display_name: googleUser.name,
          avatar_url: googleUser.picture ?? null,
        })
        .eq('id', connectedAccountId);
    } else {
      const { data: newAccount, error: accErr } = await adminClient
        .from('connected_google_accounts')
        .insert({
          user_id: userId,
          google_account_id: googleUser.sub,
          email: gmailEmail,
          display_name: googleUser.name,
          avatar_url: googleUser.picture ?? null,
          is_primary: isPrimary,
        })
        .select('id')
        .single();

      if (accErr || !newAccount) {
        throw new Error('Failed to create connected account: ' + accErr?.message);
      }
      connectedAccountId = newAccount.id;
    }

    // 5. Encrypt refresh token and access token with TOKEN_ENCRYPTION_KEY
    const encryptedRefreshToken = await encrypt(tokens.refreshToken);
    const encryptedAccessToken = tokens.accessToken ? await encrypt(tokens.accessToken) : null;

    // Upsert into gmail_credentials (accessible ONLY by service role)
    const { error: credErr } = await adminClient
      .from('gmail_credentials')
      .upsert(
        {
          connected_account_id: connectedAccountId,
          user_id: userId,
          encrypted_refresh_token: encryptedRefreshToken,
          encrypted_access_token: encryptedAccessToken,
          expires_at: tokens.expiresAt,
          scope: tokens.scope,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'connected_account_id' }
      );

    if (credErr) {
      throw new Error('Failed to store encrypted credentials: ' + credErr.message);
    }

    console.log(`[gmail-callback] Successfully connected ${gmailEmail} for user ${userId}`);

    // 6. Register Gmail users.watch if PUBSUB_TOPIC_NAME is configured
    const topicName = Deno.env.get('PUBSUB_TOPIC_NAME');
    if (topicName && tokens.accessToken) {
      try {
        const watch = await registerWatch(tokens.accessToken, topicName);
        await adminClient.from('gmail_watch_state').upsert(
          {
            connected_account_id: connectedAccountId,
            user_id: userId,
            history_id: watch.historyId,
            expiration: watch.expiration,
            status: 'active',
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'connected_account_id' }
        );
        console.log(`[gmail-callback] Registered Gmail watch for ${gmailEmail}`);
      } catch (watchErr) {
        console.warn('[gmail-callback] users.watch setup warning:', watchErr);
      }
    }

    return Response.redirect(`${frontendUrl}/#settings?connect_success=1`, 302);
  } catch (err) {
    console.error('[gmail-callback] Error processing callback:', err);
    return Response.redirect(`${frontendUrl}/#settings?connect_error=server_error`, 302);
  }
});
