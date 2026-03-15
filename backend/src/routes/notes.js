// notes.js
const router = require('express').Router();
const svc = require('../services/noteService');
const gemini = require('../services/geminiService');

router.get('/', async (req, res) => { try { res.json(await svc.listAll(req.query)); } catch(e){res.status(500).json({error:e.message})} });
router.post('/', async (req, res) => { try { res.status(201).json(await svc.create(req.body)); } catch(e){res.status(500).json({error:e.message})} });
router.put('/:id', async (req, res) => { try { res.json(await svc.update(req.params.id, req.body)); } catch(e){res.status(500).json({error:e.message})} });
router.delete('/:id', async (req, res) => { try { await svc.remove(req.params.id); res.json({ok:true}); } catch(e){res.status(500).json({error:e.message})} });

// Busca semântica
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q required' });
    const { items } = await svc.listAll({ limit: 100 });
    const ids = await gemini.semanticSearch(q, items);
    const results = items.filter(n => ids.includes(n.id));
    res.json(results);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
