// PriorityMail Edge Function: notifications-vapid-key
// Returns the public VAPID key for browser/PWA PushManager.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getVapidKeys } from '../_shared/pushSender.ts';

serve((req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { publicKey } = getVapidKeys();
  return jsonResponse({ publicKey });
});
