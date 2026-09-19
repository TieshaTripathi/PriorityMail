// PriorityMail Edge Function: notifications-register-device
// Registers an Expo / Android native mobile push token for the authenticated user.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser, getAdminClient } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { user } = await requireUser(req);
    const body = await req.json();
    const { token, platform, deviceName } = body as {
      token?: string;
      platform?: string;
      deviceName?: string;
    };

    if (!token) {
      return errorResponse('Missing token in request body', 400);
    }

    const adminClient = getAdminClient();
    const { error } = await adminClient.from('mobile_device_tokens').upsert(
      {
        user_id: user.id,
        token,
        platform: platform || 'android',
        device_name: deviceName || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );

    if (error) throw error;
    return jsonResponse({ ok: true, registered: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[notifications-register-device] error:', msg);
    return errorResponse(msg, 401);
  }
});
