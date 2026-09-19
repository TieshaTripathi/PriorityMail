// PriorityMail Edge Function: notifications-subscribe
// Registers or removes a Web Push subscription for the authenticated user.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser, getAdminClient } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { user } = await requireUser(req);
    const adminClient = getAdminClient();

    if (req.method === 'POST') {
      const body = await req.json();
      const { endpoint, keys, userAgent } = body as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
        userAgent?: string;
      };

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return errorResponse('Invalid subscription payload', 400);
      }

      const { error } = await adminClient.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: userAgent || null,
        },
        { onConflict: 'endpoint' }
      );

      if (error) throw error;
      return jsonResponse({ ok: true, subscribed: true });
    }

    if (req.method === 'DELETE') {
      const body = await req.json();
      const endpoint = body.endpoint;
      if (!endpoint) return errorResponse('Missing endpoint', 400);

      const { error } = await adminClient
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('user_id', user.id);

      if (error) throw error;
      return jsonResponse({ ok: true, unsubscribed: true });
    }

    return errorResponse(`Method ${req.method} not allowed`, 405);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[notifications-subscribe] error:', msg);
    return errorResponse(msg, 401);
  }
});
