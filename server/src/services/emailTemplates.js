/**
 * Builds HTML email bodies for each notification type.
 */
function buildEmailHtml({ request, sme, type, respondUrl, routing, pmName, isEscalation }) {
  const dueDateFormatted = new Date(request.due_date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const ccNote = routing === 'both' && pmName
    ? `<p style="color:#666;font-size:13px;">📋 ${pmName} has been CC'd on this message.</p>`
    : '';

  const responseButtons = respondUrl
    ? `
      <div style="margin:24px 0;">
        <a href="${respondUrl}" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-right:8px;">✅ Accept</a>
        <a href="${respondUrl}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">❌ Decline</a>
      </div>
      <p style="font-size:12px;color:#888;">Or open: <a href="${respondUrl}">${respondUrl}</a></p>
    `
    : '';

  const bodies = {
    initial_request: `
      <p>Hi ${sme.name},</p>
      <p>The proposal team has a new request for your expertise:</p>
      ${infoTable(request, dueDateFormatted)}
      <p>Please respond by clicking one of the buttons below:</p>
      ${responseButtons}
      ${ccNote}
    `,
    reminder_2day: `
      <p>Hi ${sme.name},</p>
      <p>This is a friendly reminder that the following request is due in <strong>2 days</strong>:</p>
      ${infoTable(request, dueDateFormatted)}
      ${responseButtons}
      ${ccNote}
    `,
    reminder_1day: `
      <p>Hi ${sme.name},</p>
      <p>⚠️ The following request is due <strong>tomorrow</strong>:</p>
      ${infoTable(request, dueDateFormatted)}
      ${responseButtons}
      ${ccNote}
    `,
    overdue_alert: `
      <p>Hi ${sme.name},</p>
      <p>🚨 The following request is now <strong>overdue</strong>. Please respond as soon as possible:</p>
      ${infoTable(request, dueDateFormatted)}
      ${responseButtons}
      ${ccNote}
    `,
    escalation: isEscalation
      ? `
        <p>This is an automated escalation notice.</p>
        <p>The SME assigned to the request below has not responded and the due date has passed:</p>
        ${infoTable(request, dueDateFormatted)}
        <p><strong>SME assigned:</strong> ${sme.name}</p>
        <p>Please follow up directly or reassign.</p>
      `
      : `
        <p>Hi ${sme.name},</p>
        <p>🔺 This request is seriously overdue. Your proposal team has been notified and may need to reassign.</p>
        ${infoTable(request, dueDateFormatted)}
        ${responseButtons}
      `,
    rating_request: `
      <p>Hi,</p>
      <p>The following SME request has been completed. Please take a moment to rate the experience:</p>
      ${infoTable(request, dueDateFormatted)}
      <p><strong>SME:</strong> ${sme.name}</p>
      <p>You can submit your rating in the <a href="${process.env.APP_PUBLIC_URL || '#'}">SME Finder dashboard</a>.</p>
    `,
  };

  const body = bodies[type] || `<p>SME Finder notification for ${request.opportunity_name}.</p>`;

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;color:#333;">
      <div style="border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:20px;">
        <h2 style="margin:0;color:#2563eb;">SME Finder</h2>
      </div>
      ${body}
      <hr style="margin-top:32px;border:none;border-top:1px solid #eee;">
      <p style="font-size:11px;color:#aaa;">This is an automated message from SME Finder. Do not reply directly to this email.</p>
    </body>
    </html>
  `;
}

function infoTable(request, dueDateFormatted) {
  return `
    <table style="border-collapse:collapse;width:100%;margin:16px 0;">
      <tr style="background:#f3f4f6;">
        <td style="padding:8px 12px;font-weight:bold;width:140px;">Opportunity</td>
        <td style="padding:8px 12px;">${request.opportunity_name}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:bold;">Topic</td>
        <td style="padding:8px 12px;">${request.topic}</td>
      </tr>
      <tr style="background:#f3f4f6;">
        <td style="padding:8px 12px;font-weight:bold;">Due Date</td>
        <td style="padding:8px 12px;">${dueDateFormatted}</td>
      </tr>
    </table>
  `;
}

module.exports = { buildEmailHtml };
