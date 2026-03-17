// Runs schema.sql + seed.sql once at server startup (idempotent — uses IF NOT EXISTS / ON CONFLICT)
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const seed   = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  try {
    await pool.query(schema);
    await pool.query(seed);
    console.log('Database migration complete');
  } finally {
    await pool.end();
  }
}

module.exports = migrate;
