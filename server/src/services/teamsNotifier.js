const axios = require('axios');

/**
 * Post an Adaptive Card to a Teams incoming webhook.
 * @param {{ request: object, sme: object, type: string, respondUrl: string }} opts
 */
async function sendTeamsCard({ request, sme, type, respondUrl }) {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[teams] TEAMS_WEBHOOK_URL not configured — skipping Teams notification');
    return { skipped: true };
  }

  const typeLabels = {
    initial_request:  '📋 New SME Request',
    reminder_2day:    '⏰ Reminder: 2 Days Until Due',
    reminder_1day:    '⚠️ Reminder: Due Tomorrow',
    overdue_alert:    '🚨 Request Overdue',
    escalation:       '🔺 Escalation: Overdue Request',
    rating_request:   '⭐ Please Rate This SME',
  };

  const title = typeLabels[type] || 'SME Finder Notification';

  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: title,
              weight: 'Bolder',
              size: 'Medium',
            },
            {
              type: 'FactSet',
              facts: [
                { title: 'Opportunity', value: request.opportunity_name },
                { title: 'Topic', value: request.topic },
                { title: 'Due Date', value: request.due_date },
                { title: 'SME', value: sme.name },
              ],
            },
            ...(respondUrl
              ? [
                  {
                    type: 'TextBlock',
                    text: 'Please respond using the link below:',
                    wrap: true,
                  },
                ]
              : []),
          ],
          actions: respondUrl
            ? [
                {
                  type: 'Action.OpenUrl',
                  title: '✅ Accept / ❌ Decline',
                  url: respondUrl,
                },
              ]
            : [],
        },
      },
    ],
  };

  const resp = await axios.post(webhookUrl, card);
  return resp.data;
}

module.exports = { sendTeamsCard };
