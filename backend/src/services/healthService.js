const db = require('../../config/database');

// ── Health ────────────────────────────────────────────────────────────────────
async function log(data) {
  const { rows } = await db.query(
    `INSERT INTO health_logs (type, value, unit, notes) VALUES ($1,$2,$3,$4) RETURNING *`,
    [data.type, data.value, data.unit, data.notes]
  );
  return rows[0];
}

async function getTodaySummary() {
  const { rows } = await db.query(
    `SELECT type, SUM(value) as total, unit
     FROM health_logs
     WHERE DATE(logged_at) = CURRENT_DATE
     GROUP BY type, unit`
  );
  return rows;
}

async function listLogs({ limit = 20 } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM health_logs ORDER BY logged_at DESC LIMIT $1`, [limit]
  );
  return rows;
}

module.exports = { log, getTodaySummary, listLogs };
