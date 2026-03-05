const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/smes — list active SMEs with optional filters
router.get('/', auth, async (req, res) => {
  const { skillset, clearance, search } = req.query;
  let sql = `
    SELECT id, name, nis_email, federal_email, teams_id, pm_name, pm_email,
           skillsets, certifications, contract_title, position, job_description,
           clearance_level, ok_to_contact_directly, preferred_contact,
           notify_routing, avg_rating, rating_count, is_active, created_at
    FROM smes
    WHERE is_active = TRUE
  `;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (name ILIKE $${params.length} OR contract_title ILIKE $${params.length} OR position ILIKE $${params.length})`;
  }
  if (skillset) {
    params.push(skillset);
    sql += ` AND $${params.length} = ANY(skillsets)`;
  }
  if (clearance) {
    params.push(clearance);
    sql += ` AND clearance_level = $${params.length}`;
  }

  sql += ' ORDER BY name ASC';

  const { rows } = await db.query(sql, params);
  res.json(rows);
});

// GET /api/smes/:id — single SME with ratings and past requests
router.get('/:id', auth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM smes WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'SME not found' });

  const { rows: ratings } = await db.query(
    `SELECT r.rating, r.notes, r.rated_at, u.first_name, u.last_name
     FROM sme_ratings r
     LEFT JOIN users u ON r.rated_by = u.id
     WHERE r.sme_id = $1
     ORDER BY r.rated_at DESC`,
    [req.params.id]
  );

  const { rows: requests } = await db.query(
    `SELECT id, opportunity_name, topic, due_date, status, created_at
     FROM sme_requests
     WHERE assigned_sme_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [req.params.id]
  );

  res.json({ ...rows[0], ratings, recent_requests: requests });
});

// POST /api/smes — create SME
router.post('/', auth, requireRole('proposal_manager', 'admin'), [
  body('name').notEmpty().trim(),
  body('skillsets').isArray({ min: 1 }),
  body('preferred_contact').optional().isIn(['email', 'teams']),
  body('notify_routing').optional().isIn(['sme_only', 'pm_only', 'both']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const {
    name, nis_email, federal_email, teams_id,
    pm_name, pm_email, pm_teams_id, notify_routing,
    skillsets, certifications, contract_title, position,
    job_description, clearance_level, ok_to_contact_directly,
    preferred_contact,
  } = req.body;

  const { rows } = await db.query(
    `INSERT INTO smes (
       name, nis_email, federal_email, teams_id,
       pm_name, pm_email, pm_teams_id, notify_routing,
       skillsets, certifications, contract_title, position,
       job_description, clearance_level, ok_to_contact_directly,
       preferred_contact, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      name, nis_email || null, federal_email || null, teams_id || null,
      pm_name || null, pm_email || null, pm_teams_id || null, notify_routing || 'both',
      skillsets, certifications || [], contract_title || null, position || null,
      job_description || null, clearance_level || null, ok_to_contact_directly || false,
      preferred_contact || 'email', req.user.id,
    ]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/smes/:id — update SME
router.put('/:id', auth, requireRole('proposal_manager', 'admin'), async (req, res) => {
  const { rows: existing } = await db.query('SELECT id FROM smes WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'SME not found' });

  const {
    name, nis_email, federal_email, teams_id,
    pm_name, pm_email, pm_teams_id, notify_routing,
    skillsets, certifications, contract_title, position,
    job_description, clearance_level, ok_to_contact_directly,
    preferred_contact, is_active,
  } = req.body;

  const { rows } = await db.query(
    `UPDATE smes SET
       name = COALESCE($1, name),
       nis_email = $2,
       federal_email = $3,
       teams_id = $4,
       pm_name = $5,
       pm_email = $6,
       pm_teams_id = $7,
       notify_routing = COALESCE($8, notify_routing),
       skillsets = COALESCE($9, skillsets),
       certifications = COALESCE($10, certifications),
       contract_title = $11,
       position = $12,
       job_description = $13,
       clearance_level = $14,
       ok_to_contact_directly = COALESCE($15, ok_to_contact_directly),
       preferred_contact = COALESCE($16, preferred_contact),
       is_active = COALESCE($17, is_active)
     WHERE id = $18
     RETURNING *`,
    [
      name, nis_email, federal_email, teams_id,
      pm_name, pm_email, pm_teams_id, notify_routing,
      skillsets, certifications, contract_title, position,
      job_description, clearance_level, ok_to_contact_directly,
      preferred_contact, is_active, req.params.id,
    ]
  );
  res.json(rows[0]);
});

// DELETE /api/smes/:id — soft delete
router.delete('/:id', auth, requireRole('proposal_manager', 'admin'), async (req, res) => {
  const { rows } = await db.query(
    'UPDATE smes SET is_active = FALSE WHERE id = $1 RETURNING id',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'SME not found' });
  res.json({ message: 'SME deactivated' });
});

module.exports = router;
