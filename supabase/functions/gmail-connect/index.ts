// PriorityMail Edge Function: gmail-connect
// Authenticated user calls this to initiate Gmail mailbox connection.
// Returns Google OAuth URL containing HMAC-signed state tied to the authenticated user.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabaseClient.ts';
import { signOAuthState, buildGmailAuthUrl } from '../_shared/googleAuth.ts';

serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { user } = await requireUser(req);
    const state = await signOAuthState(user.id);
    const url = buildGmailAuthUrl(state);

    return jsonResponse({ url, state });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gmail-connect] error:', msg);
    return errorResponse(msg, 401);
  }
});
