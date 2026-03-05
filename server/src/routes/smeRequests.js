const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { notify } = require('../services/notifier');

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

  res.json({ ...rows[0], notifications, rating: rating[0] || null });
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
  const { rows: smeRows } = await db.query('SELECT id FROM smes WHERE id = $1 AND is_active = TRUE', [assigned_sme_id]);
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

  res.status(201).json(request);
});

// PATCH /api/sme-requests/:id/status — update status
router.patch('/:id/status', auth, requireRole('proposal_manager', 'admin'), [
  body('status').isIn(['pending', 'accepted', 'in_progress', 'completed', 'declined', 'overdue']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { rows } = await db.query(
    'UPDATE sme_requests SET status = $1 WHERE id = $2 RETURNING *',
    [req.body.status, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Request not found' });

  // If completed, send rating request notification
  if (req.body.status === 'completed') {
    notify(rows[0], 'rating_request').catch(console.error);
  }

  res.json(rows[0]);
});

// PATCH /api/sme-requests/:id/reassign — change SME and re-notify
router.patch('/:id/reassign', auth, requireRole('proposal_manager', 'admin'), [
  body('assigned_sme_id').isUUID(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { assigned_sme_id, notes } = req.body;
  const { rows: smeRows } = await db.query('SELECT id FROM smes WHERE id = $1 AND is_active = TRUE', [assigned_sme_id]);
  if (!smeRows[0]) return res.status(404).json({ error: 'SME not found or inactive' });

  const { rows } = await db.query(
    `UPDATE sme_requests
     SET assigned_sme_id = $1, status = 'pending', notes = COALESCE($2, notes)
     WHERE id = $3
     RETURNING *`,
    [assigned_sme_id, notes || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Request not found' });

  notify(rows[0], 'initial_request').catch(console.error);

  res.json(rows[0]);
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

  res.status(201).json(rows[0] || { message: 'Already rated' });
});

module.exports = router;
