/**
 * Unified notification service.
 * Resolves recipients based on notify_routing, sends via preferred channel,
 * and logs every attempt to sme_notifications.
 */
const db = require('../db');
const { sendMail } = require('./mailer');
const { sendTeamsCard } = require('./teamsNotifier');
const { buildEmailHtml } = require('./emailTemplates');

/**
 * @param {object} request  - full sme_requests row
 * @param {string} type     - notification type key
 * @param {object} [extra]  - extra context (e.g. escalate_to for escalation emails)
 */
async function notify(request, type, extra = {}) {
  // Load full SME record
  const smeRes = await db.query('SELECT * FROM smes WHERE id = $1', [request.assigned_sme_id]);
  const sme = smeRes.rows[0];
  if (!sme) return { success: false, error: 'SME not found' };

  const publicUrl = process.env.APP_PUBLIC_URL || 'http://localhost:3100';
  const respondUrl = `${publicUrl}/respond/${request.response_token}`;

  // Resolve recipients
  const routing = sme.notify_routing || 'both';
  const smeEmail  = sme.federal_email || sme.nis_email;
  const pmEmail   = sme.pm_email;

  const results = [];

  // ── Email ────────────────────────────────────────────────────────────────
  if (sme.preferred_contact === 'email') {
    let to, cc;
    if (routing === 'sme_only')   { to = smeEmail; }
    else if (routing === 'pm_only') { to = pmEmail; }
    else { to = smeEmail; cc = pmEmail; }

    if (to) {
      const html = buildEmailHtml({ request, sme, type, respondUrl, routing, pmName: sme.pm_name });
      const subject = buildSubject(type, request);
      let status = 'sent', errorDetail;
      try {
        const result = await sendMail({ to, cc, subject, html });
        if (result?.skipped) status = 'skipped';
      } catch (err) {
        status = 'failed';
        errorDetail = err.message;
      }
      const recipients = [to, cc].filter(Boolean).join(', ');
      await logNotification({ request, sme, type, channel: 'email', status, errorDetail, recipients });
      results.push({ channel: 'email', status, recipients });
    }
  }

  // ── Teams ────────────────────────────────────────────────────────────────
  if (sme.preferred_contact === 'teams') {
    let status = 'sent', errorDetail;
    const recipients = routing === 'pm_only' ? sme.pm_teams_id : sme.teams_id;
    try {
      const result = await sendTeamsCard({ request, sme, type, respondUrl });
      if (result?.skipped) status = 'skipped';
    } catch (err) {
      status = 'failed';
      errorDetail = err.message;
    }
    await logNotification({ request, sme, type, channel: 'teams', status, errorDetail, recipients });
    results.push({ channel: 'teams', status, recipients });
  }

  // ── Escalation: also notify request creator ─────────────────────────────
  if (type === 'escalation' && extra.creatorEmail) {
    const html = buildEmailHtml({ request, sme, type: 'escalation', respondUrl, isEscalation: true });
    let status = 'sent', errorDetail;
    try {
      await sendMail({ to: extra.creatorEmail, subject: `[ESCALATION] ${request.opportunity_name} — SME response overdue`, html });
    } catch (err) {
      status = 'failed';
      errorDetail = err.message;
    }
    await logNotification({ request, sme, type, channel: 'email', status, errorDetail, recipients: extra.creatorEmail });
  }

  return { success: true, results };
}

async function logNotification({ request, sme, type, channel, status, errorDetail, recipients }) {
  await db.query(
    `INSERT INTO sme_notifications (request_id, sme_id, type, channel, recipients, status, error_detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [request.id, sme.id, type, channel, recipients || null, status, errorDetail || null]
  );
}

/**
 * Check if a notification of this type was already sent for this request
 * (prevents duplicate reminders from the scheduler).
 */
async function alreadySent(requestId, type) {
  const res = await db.query(
    `SELECT 1 FROM sme_notifications
     WHERE request_id = $1 AND type = $2 AND status = 'sent'
     LIMIT 1`,
    [requestId, type]
  );
  return res.rows.length > 0;
}

function buildSubject(type, request) {
  const labels = {
    initial_request:  `SME Request: ${request.opportunity_name}`,
    reminder_2day:    `[Reminder] 2 days left — ${request.opportunity_name}`,
    reminder_1day:    `[Reminder] Due tomorrow — ${request.opportunity_name}`,
    overdue_alert:    `[OVERDUE] ${request.opportunity_name}`,
    escalation:       `[ESCALATION] ${request.opportunity_name} — SME has not responded`,
    rating_request:   `Please rate your experience — ${request.opportunity_name}`,
  };
  return labels[type] || `SME Finder: ${request.opportunity_name}`;
}

module.exports = { notify, alreadySent };
