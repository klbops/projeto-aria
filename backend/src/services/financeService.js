const db = require('../../config/database');

async function create(data) {
  const { rows } = await db.query(
    `INSERT INTO transactions (title, amount, type, category, due_at, paid)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [data.title, data.amount, data.type, data.category || 'Geral', data.due_at, data.paid || false]
  );
  return rows[0];
}

async function listAll({ page = 1, limit = 30 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await db.query(
    `SELECT * FROM transactions ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]
  );
  const { rows: summary } = await db.query(
    `SELECT
       SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
       SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
     FROM transactions
     WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`
  );
  return { items: rows, summary: summary[0] };
}

async function getUpcomingBills() {
  const { rows } = await db.query(
    `SELECT * FROM transactions
     WHERE type='expense' AND paid=false AND due_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
     ORDER BY due_at ASC`
  );
  return rows;
}

async function markPaid(id) {
  const { rows } = await db.query(
    `UPDATE transactions SET paid=true WHERE id=$1 RETURNING *`, [id]
  );
  return rows[0];
}

async function remove(id) {
  await db.query(`DELETE FROM transactions WHERE id=$1`, [id]);
}

module.exports = { create, listAll, getUpcomingBills, markPaid, remove };
