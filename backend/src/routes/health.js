const router = require('express').Router();
const svc = require('../services/healthService');

router.get('/today',  async (req, res) => { try { res.json(await svc.getTodaySummary()); } catch(e){res.status(500).json({error:e.message})} });
router.get('/logs',   async (req, res) => { try { res.json(await svc.listLogs(req.query)); } catch(e){res.status(500).json({error:e.message})} });
router.post('/log',   async (req, res) => { try { res.status(201).json(await svc.log(req.body)); } catch(e){res.status(500).json({error:e.message})} });

module.exports = router;
