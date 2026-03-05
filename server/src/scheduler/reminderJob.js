const cron = require('node-cron');
const db = require('../db');
const { notify, alreadySent } = require('../services/notifier');

async function runReminderJob() {
  console.log('[scheduler] Running reminder job at', new Date().toISOString());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch all open requests with an assigned SME
  const { rows: requests } = await db.query(
    `SELECT r.*, u.email AS creator_email
     FROM sme_requests r
     LEFT JOIN users u ON r.created_by = u.id
     WHERE r.status IN ('pending', 'accepted', 'in_progress')
       AND r.assigned_sme_id IS NOT NULL`
  );

  for (const request of requests) {
    const due = new Date(request.due_date);
    due.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (daysUntilDue === 2 && !(await alreadySent(request.id, 'reminder_2day'))) {
      await notify(request, 'reminder_2day').catch(console.error);
    } else if (daysUntilDue === 1 && !(await alreadySent(request.id, 'reminder_1day'))) {
      await notify(request, 'reminder_1day').catch(console.error);
    } else if (daysUntilDue < 0) {
      // Mark overdue and send alerts (idempotent: check before sending)
      await db.query(
        `UPDATE sme_requests SET status = 'overdue', updated_at = NOW() WHERE id = $1`,
        [request.id]
      );

      if (!(await alreadySent(request.id, 'overdue_alert'))) {
        await notify(request, 'overdue_alert').catch(console.error);
      }
      if (!(await alreadySent(request.id, 'escalation'))) {
        await notify(request, 'escalation', { creatorEmail: request.creator_email }).catch(console.error);
      }
    }
  }

  console.log(`[scheduler] Processed ${requests.length} open request(s)`);
}

function startScheduler() {
  // Run daily at 8:00 AM server time
  cron.schedule('0 8 * * *', runReminderJob);
  console.log('[scheduler] Reminder job scheduled (daily at 08:00)');
}

module.exports = { startScheduler, runReminderJob };
