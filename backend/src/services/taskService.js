const db = require('../../config/database');

async function create(data) {
  const { rows } = await db.query(
    `INSERT INTO tasks (title, description, due_at, priority, tags)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.title, data.description, data.due_at, data.priority || 'medium', data.tags || []]
  );
  return rows[0];
}

async function listPending(limit = 20) {
  const { rows } = await db.query(
    `SELECT * FROM tasks WHERE status = 'pending'
     ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, due_at ASC NULLS LAST
     LIMIT $1`, [limit]
  );
  return rows;
}

async function listAll({ page = 1, limit = 20, status } = {}) {
  const offset = (page - 1) * limit;
  const where = status ? `WHERE status = $3` : '';
  const params = status ? [limit, offset, status] : [limit, offset];
  const { rows } = await db.query(
    `SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params
  );
  const { rows: count } = await db.query(
    `SELECT COUNT(*) FROM tasks ${status ? "WHERE status=$1" : ''}`,
    status ? [status] : []
  );
  return { items: rows, total: parseInt(count[0].count) };
}

async function complete(id) {
  const { rows } = await db.query(
    `UPDATE tasks SET status='done', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]
  );
  return rows[0];
}

async function update(id, data) {
  const fields = [], vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(data)) { fields.push(`${k}=$${i++}`); vals.push(v); }
  fields.push('updated_at=NOW()');
  vals.push(id);
  const { rows } = await db.query(
    `UPDATE tasks SET ${fields.join(',')} WHERE id=$${i} RETURNING *`, vals
  );
  return rows[0];
}

async function remove(id) {
  await db.query(`DELETE FROM tasks WHERE id=$1`, [id]);
}

module.exports = { create, listPending, listAll, complete, update, remove };
