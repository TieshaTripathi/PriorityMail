// PriorityMail backend — Background Scheduler
// Runs periodic maintenance jobs on free-tier compatible timers (in-process).
// - Daily Gmail users.watch renewal
// - Expired push subscriptions cleanup

import { renewAllWatches } from './watchService.js';
import { getDb } from '../db/database.js';

let schedulerInterval: NodeJS.Timeout | null = null;

export function startBackgroundJobs(): void {
  console.log('[scheduler] Starting PriorityMail background scheduler...');

  const RENEWAL_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  async function runDailyTasks() {
    console.log('[scheduler] Running scheduled daily tasks...');

    // 1. Renew Gmail watches
    try {
      await renewAllWatches();
    } catch (err) {
      console.error('[scheduler] Watch renewal failed:', err);
    }

    // 2. Clean up dead notification history older than 30 days
    try {
      const db = getDb();
      if (db.isPostgres) {
        await db.execute(
          "DELETE FROM notification_history WHERE created_at < NOW() - INTERVAL '30 days'",
        );
      } else {
        await db.execute(
          "DELETE FROM notification_history WHERE created_at < datetime('now', '-30 days')",
        );
      }
      console.log('[scheduler] Cleaned up old notification history.');
    } catch (err) {
      console.warn('[scheduler] Cleanup error:', err);
    }
  }

  // Initial delay run: 30 seconds after server boot to allow full startup
  setTimeout(() => {
    runDailyTasks().catch((e) => console.error('[scheduler] Initial task run error:', e));
  }, 30 * 1000);

  // Recurring daily interval
  schedulerInterval = setInterval(runDailyTasks, RENEWAL_INTERVAL_MS);
}

export function stopBackgroundJobs(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
