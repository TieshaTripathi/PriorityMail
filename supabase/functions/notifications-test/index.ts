// PriorityMail Edge Function: notifications-test
// Sends an immediate test notification to the authenticated user's registered devices only.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser, getAdminClient } from '../_shared/supabaseClient.ts';
import { sendPushToUser, type NotificationPayload } from '../_shared/pushSender.ts';

serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const { user } = await requireUser(req);
    const adminClient = getAdminClient();

    const [subsRes, tokensRes] = await Promise.all([
      adminClient
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      adminClient
        .from('mobile_device_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    const totalDevices = (subsRes.count || 0) + (tokensRes.count || 0);

    const testPayload: NotificationPayload = {
      internalEmailId: 'test-notification-sample',
      gmailMessageId: 'sample-gmail-id',
      gmailThreadId: 'sample-thread-id',
      accountEmail: user.email || 'user@example.com',
      senderName: 'PriorityMail Verification',
      subject: 'Push Notification Connected Successfully',
      priority: 'high',
      reason: 'Verified PriorityMail instant push delivery',
      category: 'personal',
      title: 'PriorityMail',
      body: 'PriorityMail Verification\nPush Notification Connected Successfully\nReason: Verified PriorityMail instant push delivery',
    };

    const result = await sendPushToUser(user.id, testPayload);

    return jsonResponse({
      success: true,
      pwaSent: result.pwaSent,
      mobileSent: result.mobileSent,
      totalDevices,
      message:
        totalDevices === 0
          ? 'No registered push subscriptions or devices found. Click "Enable Notifications" first.'
          : `Sent test push to ${result.pwaSent + result.mobileSent} of ${totalDevices} device(s).`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[notifications-test] error:', msg);
    return errorResponse(msg, 401);
  }
});
