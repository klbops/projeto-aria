const router = require('express').Router();
const svc = require('../services/taskService');

router.get('/',           async (req, res) => { try { res.json(await svc.listAll(req.query)); } catch(e){res.status(500).json({error:e.message})} });
router.get('/pending',    async (req, res) => { try { res.json(await svc.listPending(req.query.limit)); } catch(e){res.status(500).json({error:e.message})} });
router.post('/',          async (req, res) => { try { res.status(201).json(await svc.create(req.body)); } catch(e){res.status(500).json({error:e.message})} });
router.put('/:id',        async (req, res) => { try { res.json(await svc.update(req.params.id, req.body)); } catch(e){res.status(500).json({error:e.message})} });
router.patch('/:id/done', async (req, res) => { try { res.json(await svc.complete(req.params.id)); } catch(e){res.status(500).json({error:e.message})} });
router.delete('/:id',     async (req, res) => { try { await svc.remove(req.params.id); res.json({ok:true}); } catch(e){res.status(500).json({error:e.message})} });

module.exports = router;
