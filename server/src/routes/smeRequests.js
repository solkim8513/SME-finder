const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { notify } = require('../services/notifier');

const SUGGEST_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'in', 'of', 'with', 'that', 'this',
  'is', 'are', 'be', 'have', 'need', 'needs', 'needed', 'looking', 'expert',
  'experience', 'experienced', 'knowledge', 'support', 'provide', 'provides',
  'required', 'requirement', 'requirements', 'role', 'resource', 'resources',
  'person', 'people', 'personnel', 'help', 'work', 'working', 'team',
]);

function normalizeToken(token = '') {
  let value = String(token).toLowerCase().trim();
  if (value.length > 4 && value.endsWith('s') && !value.endsWith('ss') && !value.endsWith('is')) {
    value = value.slice(0, -1);
  }
  return value;
}

function tokenize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(normalizeToken)
    .filter(t => t.length > 2 && !SUGGEST_STOP_WORDS.has(t));
}

function getMatches(queryTokens, values = []) {
  const matchedTokens = new Set();
  const matchedLabels = [];

  for (const rawValue of values) {
    const value = String(rawValue || '').trim();
    if (!value) continue;

    const tokens = new Set(tokenize(value));
    const overlaps = queryTokens.filter(token => tokens.has(token));

    if (overlaps.length > 0) {
      overlaps.forEach(token => matchedTokens.add(token));
      if (!matchedLabels.includes(value)) matchedLabels.push(value);
    }
  }

  return { matchedTokens: [...matchedTokens], matchedLabels };
}

function formatStatus(status) {
  return String(status || '').replace(/_/g, ' ');
}

async function addRequestLog({ requestId, userId = null, entryType = 'comment', message }) {
  const text = String(message || '').trim();
  if (!text) return null;

  const { rows } = await db.query(
    `INSERT INTO sme_request_logs (request_id, user_id, entry_type, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, request_id, user_id, entry_type, message, created_at`,
    [requestId, userId, entryType, text]
  );

  return rows[0];
}

// GET /api/sme-requests
router.get('/', auth, async (req, res) => {
  const { status, sme_id, limit = 50, offset = 0 } = req.query;
  let sql = `
    SELECT r.*, s.name AS sme_name, s.avg_rating AS sme_rating,
           u.first_name AS creator_first, u.last_name AS creator_last
    FROM sme_requests r
    LEFT JOIN smes s ON r.assigned_sme_id = s.id
    LEFT JOIN users u ON r.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    params.push(status);
    sql += ` AND r.status = $${params.length}`;
  }
  if (sme_id) {
    params.push(sme_id);
    sql += ` AND r.assigned_sme_id = $${params.length}`;
  }

  params.push(limit, offset);
  sql += ` ORDER BY r.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await db.query(sql, params);

  // Count for pagination
  const countSql = sql.replace(/SELECT r\.\*.*?FROM/, 'SELECT COUNT(*) FROM').split('ORDER BY')[0];
  const { rows: countRows } = await db.query(countSql, params.slice(0, -2));

  res.json({ requests: rows, total: parseInt(countRows[0]?.count || 0) });
});

// POST /api/sme-requests/suggest — top-3 SME candidates by keyword scoring
router.post('/suggest', auth, async (req, res) => {
  const { topic = '', opportunity_name = '' } = req.body;
  if (!topic.trim()) return res.json({ suggestions: [] });

  const { rows: smes } = await db.query(
    `SELECT id, name, skillsets, certifications, job_description, contract_title, avg_rating
     FROM smes WHERE is_active = TRUE`
  );

  const tokens = tokenize(`${topic} ${opportunity_name}`);

  if (tokens.length === 0) return res.json({ suggestions: [] });

  const scored = smes.map(sme => {
    const skillMatches = getMatches(tokens, sme.skillsets || []);
    const certMatches = getMatches(tokens, sme.certifications || []);
    const titleMatches = getMatches(tokens, [sme.contract_title || '']);
    const descriptionMatches = getMatches(tokens, [sme.job_description || '']);

    const uniqueMatchCount = new Set([
      ...skillMatches.matchedTokens,
      ...certMatches.matchedTokens,
      ...titleMatches.matchedTokens,
      ...descriptionMatches.matchedTokens,
    ]).size;

    if (uniqueMatchCount === 0) return null;

    const ratingBoost = sme.avg_rating ? parseFloat(sme.avg_rating) * 0.1 : 0;
    const score =
      (skillMatches.matchedTokens.length * 5) +
      (certMatches.matchedTokens.length * 4) +
      (titleMatches.matchedTokens.length * 3) +
      (descriptionMatches.matchedTokens.length * 1) +
      ratingBoost;

    const match_reason = [
      ...skillMatches.matchedLabels,
      ...certMatches.matchedLabels,
      ...titleMatches.matchedLabels,
    ].slice(0, 4);

    return {
      id: sme.id,
      name: sme.name,
      skillsets: sme.skillsets,
      avg_rating: sme.avg_rating,
      score,
      match_reason,
    };
  });

  const top3 = scored
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (parseFloat(b.avg_rating || 0) - parseFloat(a.avg_rating || 0));
    })
    .slice(0, 3);

  res.json({ suggestions: top3 });
});

// GET /api/sme-requests/:id — detail with notification log
router.get('/:id', auth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*, s.name AS sme_name, s.preferred_contact, s.notify_routing,
            s.federal_email, s.nis_email, s.pm_name, s.pm_email,
            u.first_name AS creator_first, u.last_name AS creator_last, u.email AS creator_email
     FROM sme_requests r
     LEFT JOIN smes s ON r.assigned_sme_id = s.id
     LEFT JOIN users u ON r.created_by = u.id
     WHERE r.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Request not found' });

  const { rows: notifications } = await db.query(
    `SELECT type, channel, recipients, status, error_detail, sent_at
     FROM sme_notifications
     WHERE request_id = $1
     ORDER BY sent_at ASC`,
    [req.params.id]
  );

  const { rows: rating } = await db.query(
    'SELECT * FROM sme_ratings WHERE request_id = $1 LIMIT 1',
    [req.params.id]
  );

  const { rows: logs } = await db.query(
    `SELECT l.id, l.entry_type, l.message, l.created_at,
            u.first_name, u.last_name
     FROM sme_request_logs l
     LEFT JOIN users u ON l.user_id = u.id
     WHERE l.request_id = $1
     ORDER BY l.created_at DESC`,
    [req.params.id]
  );

  res.json({ ...rows[0], notifications, logs, rating: rating[0] || null });
});

// POST /api/sme-requests — create and send initial notification
router.post('/', auth, requireRole('proposal_manager', 'admin'), [
  body('opportunity_name').notEmpty().trim(),
  body('topic').notEmpty().trim(),
  body('due_date').isDate(),
  body('assigned_sme_id').isUUID(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { opportunity_name, topic, due_date, assigned_sme_id, notes } = req.body;

  // Verify SME exists
  const { rows: smeRows } = await db.query(
    'SELECT id, name FROM smes WHERE id = $1 AND is_active = TRUE',
    [assigned_sme_id]
  );
  if (!smeRows[0]) return res.status(404).json({ error: 'SME not found or inactive' });

  const { rows } = await db.query(
    `INSERT INTO sme_requests (opportunity_name, topic, due_date, assigned_sme_id, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [opportunity_name, topic, due_date, assigned_sme_id, notes || null, req.user.id]
  );
  const request = rows[0];

  // Fire initial notification (async, don't block response)
  notify(request, 'initial_request').catch(err =>
    console.error('[notify] initial_request failed:', err.message)
  );

  await addRequestLog({
    requestId: request.id,
    userId: req.user.id,
    entryType: 'system',
    message: `Created request and assigned it to ${smeRows[0].name}.`,
  });

  res.status(201).json(request);
});

// PATCH /api/sme-requests/:id/status — update status
router.patch('/:id/status', auth, requireRole('proposal_manager', 'admin'), [
  body('status').isIn(['pending', 'accepted', 'in_progress', 'completed', 'declined', 'overdue']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { rows: existing } = await db.query(
    'SELECT id, status FROM sme_requests WHERE id = $1',
    [req.params.id]
  );
  if (!existing[0]) return res.status(404).json({ error: 'Request not found' });

  const { rows } = await db.query(
    'UPDATE sme_requests SET status = $1 WHERE id = $2 RETURNING *',
    [req.body.status, req.params.id]
  );

  // If completed, send rating request notification
  if (req.body.status === 'completed') {
    notify(rows[0], 'rating_request').catch(console.error);
  }

  await addRequestLog({
    requestId: req.params.id,
    userId: req.user.id,
    entryType: 'system',
    message: `Changed status from ${formatStatus(existing[0].status)} to ${formatStatus(req.body.status)}.`,
  });

  res.json(rows[0]);
});

// PATCH /api/sme-requests/:id/reassign — change SME and re-notify
router.patch('/:id/reassign', auth, requireRole('proposal_manager', 'admin'), [
  body('assigned_sme_id').isUUID(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { assigned_sme_id, notes } = req.body;
  const { rows: smeRows } = await db.query(
    'SELECT id, name FROM smes WHERE id = $1 AND is_active = TRUE',
    [assigned_sme_id]
  );
  if (!smeRows[0]) return res.status(404).json({ error: 'SME not found or inactive' });

  const { rows: existing } = await db.query(
    `SELECT r.id, r.assigned_sme_id, s.name AS sme_name
     FROM sme_requests r
     LEFT JOIN smes s ON r.assigned_sme_id = s.id
     WHERE r.id = $1`,
    [req.params.id]
  );
  if (!existing[0]) return res.status(404).json({ error: 'Request not found' });

  const { rows } = await db.query(
    `UPDATE sme_requests
     SET assigned_sme_id = $1, status = 'pending', notes = COALESCE($2, notes)
     WHERE id = $3
     RETURNING *`,
    [assigned_sme_id, notes || null, req.params.id]
  );

  notify(rows[0], 'initial_request').catch(console.error);

  const previousSme = existing[0].sme_name || 'Unassigned';
  await addRequestLog({
    requestId: req.params.id,
    userId: req.user.id,
    entryType: 'system',
    message: `Reassigned request from ${previousSme} to ${smeRows[0].name} and reset status to pending.`,
  });

  res.json(rows[0]);
});

// POST /api/sme-requests/:id/logs — add a shared team log entry
router.post('/:id/logs', auth, [
  body('message').trim().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { rows: requestRows } = await db.query(
    'SELECT id FROM sme_requests WHERE id = $1',
    [req.params.id]
  );
  if (!requestRows[0]) return res.status(404).json({ error: 'Request not found' });

  const created = await addRequestLog({
    requestId: req.params.id,
    userId: req.user.id,
    entryType: 'comment',
    message: req.body.message,
  });

  const { rows } = await db.query(
    `SELECT l.id, l.entry_type, l.message, l.created_at,
            u.first_name, u.last_name
     FROM sme_request_logs l
     LEFT JOIN users u ON l.user_id = u.id
     WHERE l.id = $1`,
    [created.id]
  );

  res.status(201).json(rows[0]);
});

// POST /api/sme-requests/:id/rate — submit post-completion rating
router.post('/:id/rate', auth, requireRole('proposal_manager', 'admin'), [
  body('rating').isInt({ min: 1, max: 5 }),
  body('notes').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { rows: reqRows } = await db.query(
    'SELECT assigned_sme_id, status FROM sme_requests WHERE id = $1',
    [req.params.id]
  );
  if (!reqRows[0]) return res.status(404).json({ error: 'Request not found' });
  if (reqRows[0].status !== 'completed') {
    return res.status(400).json({ error: 'Can only rate completed requests' });
  }

  const { rows } = await db.query(
    `INSERT INTO sme_ratings (request_id, sme_id, rating, notes, rated_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [req.params.id, reqRows[0].assigned_sme_id, req.body.rating, req.body.notes || null, req.user.id]
  );

  if (rows[0]) {
    await addRequestLog({
      requestId: req.params.id,
      userId: req.user.id,
      entryType: 'system',
      message: `Submitted SME rating: ${req.body.rating}/5${req.body.notes ? ` — ${req.body.notes}` : ''}`,
    });
  }

  res.status(201).json(rows[0] || { message: 'Already rated' });
});

module.exports = router;
