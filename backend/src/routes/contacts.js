const router = require('express').Router();
const db = require('../../config/database');

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM contacts ORDER BY name ASC`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, role, email, phone, tags, notes } = req.body;
    const { rows } = await db.query(
      `INSERT INTO contacts (name, role, email, phone, tags, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, role, email, phone, tags || [], notes]
    );
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, role, email, phone, tags, notes } = req.body;
    const { rows } = await db.query(
      `UPDATE contacts SET name=$1,role=$2,email=$3,phone=$4,tags=$5,notes=$6 WHERE id=$7 RETURNING *`,
      [name, role, email, phone, tags || [], notes, req.params.id]
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM contacts WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
