/**
 * Public routes — no JWT required.
 * Used for one-click Accept / Decline links sent to SMEs / PMs.
 */
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');

// GET /api/respond/:token — fetch request info for the respond page
router.get('/:token', async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.id, r.opportunity_name, r.topic, r.due_date, r.status,
            s.name AS sme_name
     FROM sme_requests r
     LEFT JOIN smes s ON r.assigned_sme_id = s.id
     WHERE r.response_token = $1`,
    [req.params.token]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Invalid or expired link' });
  res.json(rows[0]);
});

// POST /api/respond/:token/accept
router.post('/:token/accept', async (req, res) => {
  const { rows } = await db.query(
    `UPDATE sme_requests
     SET status = 'accepted', updated_at = NOW()
     WHERE response_token = $1
       AND status IN ('pending', 'overdue')
     RETURNING id, opportunity_name, status`,
    [req.params.token]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Invalid link or request already responded to' });
  res.json({ message: 'Accepted. Thank you — the proposal team has been notified.', request: rows[0] });
});

// POST /api/respond/:token/decline
router.post('/:token/decline', [
  body('reason').optional().trim(),
], async (req, res) => {
  const { rows } = await db.query(
    `UPDATE sme_requests
     SET status = 'declined', decline_reason = $1, updated_at = NOW()
     WHERE response_token = $2
       AND status IN ('pending', 'accepted', 'overdue')
     RETURNING id, opportunity_name, status`,
    [req.body.reason || null, req.params.token]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Invalid link or request already finalized' });
  res.json({ message: 'Noted. The proposal team will follow up.', request: rows[0] });
});

module.exports = router;
