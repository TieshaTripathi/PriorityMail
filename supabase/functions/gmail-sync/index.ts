// PriorityMail Edge Function: gmail-sync
// Manually triggers a message sync for a specific account or across all accounts.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser, getAdminClient } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { user, token } = await requireUser(req);
    const url = new URL(req.url);
    let accountId = url.searchParams.get('accountId');

    if (!accountId && req.method === 'POST') {
      try {
        const body = await req.json();
        accountId = body.accountId;
      } catch {
        // no body
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const messagesUrl = new URL(`${supabaseUrl}/functions/v1/gmail-messages`);
    if (accountId) messagesUrl.searchParams.set('accountId', accountId);

    const res = await fetch(messagesUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      return errorResponse(`Sync failed: ${errText}`, res.status);
    }

    const data = await res.json();
    const count = Array.isArray(data.emails) ? data.emails.length : 0;

    return jsonResponse({
      success: true,
      count,
      syncedAt: new Date().toISOString(),
      accountEmail: data.accountEmail,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gmail-sync] error:', msg);
    return errorResponse(msg, 500);
  }
});
