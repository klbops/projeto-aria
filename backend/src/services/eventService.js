const db = require('../../config/database');

async function create(data) {
  const { rows } = await db.query(
    `INSERT INTO events (title, description, start_at, end_at, location, reminder_min)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [data.title, data.description, data.start_at, data.end_at, data.location, data.reminder_min || 30]
  );
  return rows[0];
}

async function listUpcoming(limit = 10) {
  const { rows } = await db.query(
    `SELECT * FROM events WHERE start_at >= NOW() ORDER BY start_at ASC LIMIT $1`, [limit]
  );
  return rows;
}

async function listToday() {
  const { rows } = await db.query(
    `SELECT * FROM events
     WHERE DATE(start_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
     ORDER BY start_at ASC`
  );
  return rows;
}

async function listAll({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await db.query(
    `SELECT * FROM events ORDER BY start_at DESC LIMIT $1 OFFSET $2`, [limit, offset]
  );
  const { rows: count } = await db.query(`SELECT COUNT(*) FROM events`);
  return { items: rows, total: parseInt(count[0].count) };
}

async function update(id, data) {
  const fields = [];
  const vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(data)) {
    fields.push(`${k} = $${i++}`);
    vals.push(v);
  }
  fields.push(`updated_at = NOW()`);
  vals.push(id);
  const { rows } = await db.query(
    `UPDATE events SET ${fields.join(',')} WHERE id = $${i} RETURNING *`, vals
  );
  return rows[0];
}

async function remove(id) {
  await db.query(`DELETE FROM events WHERE id = $1`, [id]);
}

async function getDue(minutesAhead = 30) {
  const { rows } = await db.query(
    `SELECT * FROM events
     WHERE start_at BETWEEN NOW() AND NOW() + ($1 || ' minutes')::INTERVAL
     AND reminder_min IS NOT NULL`,
    [minutesAhead]
  );
  return rows;
}

module.exports = { create, listUpcoming, listToday, listAll, update, remove, getDue };
