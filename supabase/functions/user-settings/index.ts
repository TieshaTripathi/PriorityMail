// PriorityMail Edge Function: user-settings
// Fetches or updates user notification and sensitivity preferences.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser, getAdminClient } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { user } = await requireUser(req);
    const adminClient = getAdminClient();

    if (req.method === 'GET') {
      const { data: row } = await adminClient
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!row) {
        return jsonResponse({
          notifications: true,
          vipAlerts: true,
          deadlineAlerts: true,
          actionAlerts: true,
          sensitivity: 'Balanced',
          quietHours: false,
          quietStart: '22:00',
          quietEnd: '08:00',
        });
      }

      return jsonResponse({
        notifications: Boolean(row.notifications_enabled),
        vipAlerts: Boolean(row.vip_alerts),
        deadlineAlerts: Boolean(row.deadline_alerts),
        actionAlerts: Boolean(row.action_alerts),
        sensitivity: row.sensitivity,
        quietHours: Boolean(row.quiet_hours_enabled),
        quietStart: row.quiet_start,
        quietEnd: row.quiet_end,
      });
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      const updates = {
        user_id: user.id,
        notifications_enabled: body.notifications ?? true,
        vip_alerts: body.vipAlerts ?? true,
        deadline_alerts: body.deadlineAlerts ?? true,
        action_alerts: body.actionAlerts ?? true,
        sensitivity: ['Low', 'Balanced', 'High'].includes(body.sensitivity)
          ? body.sensitivity
          : 'Balanced',
        quiet_hours_enabled: body.quietHours ?? false,
        quiet_start: body.quietStart || '22:00',
        quiet_end: body.quietEnd || '08:00',
        updated_at: new Date().toISOString(),
      };

      const { error } = await adminClient
        .from('user_settings')
        .upsert(updates, { onConflict: 'user_id' });

      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    return errorResponse(`Method ${req.method} not allowed`, 405);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[user-settings] error:', msg);
    return errorResponse(msg, 401);
  }
});
