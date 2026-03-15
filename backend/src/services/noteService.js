const db = require('../../config/database');

async function create(data) {
  const { rows } = await db.query(
    `INSERT INTO notes (title, content, tags, starred) VALUES ($1,$2,$3,$4) RETURNING *`,
    [data.title, data.content, data.tags || [], data.starred || false]
  );
  return rows[0];
}

async function listAll({ page = 1, limit = 20, tag } = {}) {
  const offset = (page - 1) * limit;
  let query, params;
  if (tag) {
    query = `SELECT * FROM notes WHERE $3 = ANY(tags) ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
    params = [limit, offset, tag];
  } else {
    query = `SELECT * FROM notes ORDER BY starred DESC, created_at DESC LIMIT $1 OFFSET $2`;
    params = [limit, offset];
  }
  const { rows } = await db.query(query, params);
  const { rows: count } = await db.query(`SELECT COUNT(*) FROM notes`);
  return { items: rows, total: parseInt(count[0].count) };
}

async function update(id, data) {
  const fields = [], vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(data)) { fields.push(`${k}=$${i++}`); vals.push(v); }
  fields.push('updated_at=NOW()');
  vals.push(id);
  const { rows } = await db.query(
    `UPDATE notes SET ${fields.join(',')} WHERE id=$${i} RETURNING *`, vals
  );
  return rows[0];
}

async function remove(id) {
  await db.query(`DELETE FROM notes WHERE id=$1`, [id]);
}

module.exports = { create, listAll, update, remove };
