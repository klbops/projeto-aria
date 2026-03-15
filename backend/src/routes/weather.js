const router = require('express').Router();
const svc = require('../services/weatherService');

router.get('/current',  async (req, res) => { try { res.json(await svc.getCurrent()); } catch(e){res.status(500).json({error:e.message})} });
router.get('/forecast', async (req, res) => { try { res.json(await svc.getForecast()); } catch(e){res.status(500).json({error:e.message})} });

module.exports = router;
