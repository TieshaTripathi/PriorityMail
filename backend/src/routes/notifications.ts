/// <reference path="../types/session.d.ts" />
import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import {
  getVapidPublicKey,
  sendTestNotification,
} from '../services/pushService.js';

export const notificationsRouter = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  next();
}

/**
 * GET /api/notifications/vapid-public-key
 * Returns the VAPID public key for the browser/PWA PushManager.
 */
notificationsRouter.get('/vapid-public-key', (_req: Request, res: Response) => {
  const key = getVapidPublicKey();
  res.json({ publicKey: key });
});

/**
 * POST /api/notifications/subscribe
 * Register a Web Push subscription for the current authenticated user.
 */
notificationsRouter.post('/subscribe', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId as string;
  const { endpoint, keys, userAgent } = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription payload. Required: endpoint, keys.p256dh, keys.auth' });
  }

  const db = getDb();
  try {
    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM push_subscriptions WHERE endpoint = ?',
      [endpoint],
    );

    if (existing) {
      await db.execute(
        'UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = ? WHERE id = ?',
        [userId, keys.p256dh, keys.auth, userAgent || null, existing.id],
      );
    } else {
      await db.execute(
        'INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, endpoint, keys.p256dh, keys.auth, userAgent || null],
      );
    }

    console.log(`[notifications] Subscribed Web Push endpoint for user ${userId}`);
    res.json({ ok: true, subscribed: true });
  } catch (err) {
    console.error('[notifications] Subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription.' });
  }
});

/**
 * DELETE /api/notifications/unsubscribe
 * Remove a Web Push subscription.
 */
notificationsRouter.delete('/unsubscribe', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId as string;
  const { endpoint } = req.body as { endpoint?: string };

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint in body.' });
  }

  const db = getDb();
  try {
    await db.execute(
      'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?',
      [endpoint, userId],
    );
    console.log(`[notifications] Unsubscribed endpoint for user ${userId}`);
    res.json({ ok: true, unsubscribed: true });
  } catch (err) {
    console.error('[notifications] Unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to delete subscription.' });
  }
});

/**
 * POST /api/notifications/test
 * Send an immediate test notification to all user's connected devices.
 */
notificationsRouter.post('/test', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId as string;
  try {
    const result = await sendTestNotification(userId);
    res.json({
      success: true,
      pwaSent: result.pwaSent,
      mobileSent: result.mobileSent,
      totalDevices: result.totalDevices,
      message:
        result.totalDevices === 0
          ? 'No registered push subscriptions or devices found. Click "Enable Notifications" first.'
          : `Sent test push to ${result.pwaSent + result.mobileSent} of ${result.totalDevices} device(s).`,
    });
  } catch (err) {
    console.error('[notifications] Test push error:', err);
    res.status(500).json({ error: 'Failed to send test notification.' });
  }
});

/**
 * POST /api/notifications/register-device
 * Register an Expo / Android native mobile device token.
 */
notificationsRouter.post('/register-device', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId as string;
  const { token, platform, deviceName } = req.body as {
    token?: string;
    platform?: string;
    deviceName?: string;
  };

  if (!token) {
    return res.status(400).json({ error: 'Missing token in body.' });
  }

  const db = getDb();
  try {
    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM mobile_device_tokens WHERE token = ?',
      [token],
    );

    if (existing) {
      await db.execute(
        'UPDATE mobile_device_tokens SET user_id = ?, platform = ?, device_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [userId, platform || 'android', deviceName || null, existing.id],
      );
    } else {
      await db.execute(
        'INSERT INTO mobile_device_tokens (id, user_id, token, platform, device_name) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), userId, token, platform || 'android', deviceName || null],
      );
    }

    console.log(`[notifications] Registered mobile device token for user ${userId}`);
    res.json({ ok: true, registered: true });
  } catch (err) {
    console.error('[notifications] Register device error:', err);
    res.status(500).json({ error: 'Failed to register mobile device.' });
  }
});
