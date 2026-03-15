const router = require('express').Router();

// Em produção, o Telegram envia updates via POST nesta rota
router.post('/', async (req, res) => {
  try {
    const { getBot } = require('../services/telegramService');
    const bot = getBot();
    if (bot) {
      // Processa o update manualmente quando em modo webhook
      bot.processUpdate(req.body);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(200); // Sempre 200 para o Telegram não reenviar
  }
});

module.exports = router;
