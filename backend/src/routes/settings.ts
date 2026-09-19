/// <reference path="../types/session.d.ts" />
import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/database.js';

export const settingsRouter = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  next();
}

/**
 * GET /api/settings
 * Fetch user notification and sensitivity preferences.
 */
settingsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId as string;
  const db = getDb();

  try {
    const row = await db.queryOne<{
      notifications_enabled: number;
      vip_alerts: number;
      deadline_alerts: number;
      action_alerts: number;
      sensitivity: string;
      quiet_hours_enabled: number;
      quiet_start: string;
      quiet_end: string;
    }>('SELECT * FROM user_settings WHERE user_id = ?', [userId]);

    if (!row) {
      return res.json({
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

    res.json({
      notifications: Boolean(row.notifications_enabled),
      vipAlerts: Boolean(row.vip_alerts),
      deadlineAlerts: Boolean(row.deadline_alerts),
      actionAlerts: Boolean(row.action_alerts),
      sensitivity: row.sensitivity,
      quietHours: Boolean(row.quiet_hours_enabled),
      quietStart: row.quiet_start,
      quietEnd: row.quiet_end,
    });
  } catch (err) {
    console.error('[settings] Get settings error:', err);
    res.status(500).json({ error: 'Failed to load settings.' });
  }
});

/**
 * PUT /api/settings
 * Update user notification and sensitivity preferences.
 */
settingsRouter.put('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId as string;
  const db = getDb();
  const body = req.body as {
    notifications?: boolean;
    vipAlerts?: boolean;
    deadlineAlerts?: boolean;
    actionAlerts?: boolean;
    sensitivity?: 'Low' | 'Balanced' | 'High';
    quietHours?: boolean;
    quietStart?: string;
    quietEnd?: string;
  };

  const notifications = body.notifications !== undefined ? (body.notifications ? 1 : 0) : 1;
  const vipAlerts = body.vipAlerts !== undefined ? (body.vipAlerts ? 1 : 0) : 1;
  const deadlineAlerts = body.deadlineAlerts !== undefined ? (body.deadlineAlerts ? 1 : 0) : 1;
  const actionAlerts = body.actionAlerts !== undefined ? (body.actionAlerts ? 1 : 0) : 1;
  const sensitivity = ['Low', 'Balanced', 'High'].includes(body.sensitivity ?? '')
    ? (body.sensitivity as string)
    : 'Balanced';
  const quietHours = body.quietHours ? 1 : 0;
  const quietStart = body.quietStart || '22:00';
  const quietEnd = body.quietEnd || '08:00';

  try {
    const existing = await db.queryOne<{ user_id: string }>(
      'SELECT user_id FROM user_settings WHERE user_id = ?',
      [userId],
    );

    if (existing) {
      await db.execute(
        `UPDATE user_settings
         SET notifications_enabled = ?, vip_alerts = ?, deadline_alerts = ?, action_alerts = ?,
             sensitivity = ?, quiet_hours_enabled = ?, quiet_start = ?, quiet_end = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [notifications, vipAlerts, deadlineAlerts, actionAlerts, sensitivity, quietHours, quietStart, quietEnd, userId],
      );
    } else {
      await db.execute(
        `INSERT INTO user_settings
         (user_id, notifications_enabled, vip_alerts, deadline_alerts, action_alerts, sensitivity, quiet_hours_enabled, quiet_start, quiet_end)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, notifications, vipAlerts, deadlineAlerts, actionAlerts, sensitivity, quietHours, quietStart, quietEnd],
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[settings] Save settings error:', err);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});
