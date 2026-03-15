require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const morgan  = require('morgan');
const db      = require('../config/database');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

// ── Rotas internas (API) ──────────────────────────────────────────────────────
app.use('/api/events',        require('./routes/events'));
app.use('/api/tasks',         require('./routes/tasks'));
app.use('/api/notes',         require('./routes/notes'));
app.use('/api/health',        require('./routes/health'));
app.use('/api/finance',       require('./routes/finance'));
app.use('/api/contacts',      require('./routes/contacts'));
app.use('/api/weather',       require('./routes/weather'));
app.use('/webhook/telegram',  require('./routes/telegramWebhook'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/ping', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('❌', err.message);
  res.status(err.status || 500).json({ error: err.message });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`\n🚀 ARIA Backend — porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);

  // Testa conexão com o banco
  try {
    await db.query('SELECT 1');
    console.log('✅ PostgreSQL conectado');
  } catch (e) {
    console.error('❌ PostgreSQL falhou:', e.message);
  }

  // Inicia o bot do Telegram
  try {
    const telegram = require('./services/telegramService');
    await telegram.init();
    console.log('🤖 Telegram Bot iniciado');
  } catch (e) {
    console.error('⚠️  Telegram Bot não iniciado:', e.message);
    console.error('   → Configure TELEGRAM_BOT_TOKEN no .env');
  }

  // Inicia cron jobs
  try {
    require('./services/cronService');
  } catch (e) {
    console.error('⚠️  Cron jobs não iniciados:', e.message);
  }

  console.log('\n💬 Fale com a ARIA no Telegram para testar!\n');
});

module.exports = app;
