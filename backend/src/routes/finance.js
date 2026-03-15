const router = require('express').Router();
const svc = require('../services/financeService');

router.get('/',          async (req, res) => { try { res.json(await svc.listAll(req.query)); } catch(e){res.status(500).json({error:e.message})} });
router.get('/bills',     async (req, res) => { try { res.json(await svc.getUpcomingBills()); } catch(e){res.status(500).json({error:e.message})} });
router.post('/',         async (req, res) => { try { res.status(201).json(await svc.create(req.body)); } catch(e){res.status(500).json({error:e.message})} });
router.patch('/:id/pay', async (req, res) => { try { res.json(await svc.markPaid(req.params.id)); } catch(e){res.status(500).json({error:e.message})} });
router.delete('/:id',    async (req, res) => { try { await svc.remove(req.params.id); res.json({ok:true}); } catch(e){res.status(500).json({error:e.message})} });

module.exports = router;
