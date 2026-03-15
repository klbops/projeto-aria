const router = require('express').Router();
const geminiService = require('../services/geminiService');
const eventService = require('../services/eventService');
const taskService = require('../services/taskService');
const noteService = require('../services/noteService');
const healthService = require('../services/healthService');
const financeService = require('../services/financeService');
const db = require('../../config/database');

// POST /api/chat — mensagem do frontend
router.post('/', async (req, res) => {
  try {
    const { message, sessionId = 'frontend' } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });

    // Salva mensagem do usuário
    await db.query(
      `INSERT INTO chat_messages (role, content) VALUES ('user', $1)`, [message]
    );

    // Processa com Gemini
    const result = await geminiService.chat(message, sessionId);
    const { intent, data, reply } = result;

    let actionResult = null;

    // Executa a ação no banco
    switch (intent) {
      case 'create_event':
        actionResult = await eventService.create({
          title: data.title,
          description: data.description || '',
          start_at: buildDateTime(data.date, data.time),
          end_at: data.end_time ? buildDateTime(data.date, data.end_time) : null,
          location: data.location || null,
          reminder_min: data.reminder_min || 30,
        });
        break;

      case 'create_task':
        actionResult = await taskService.create({
          title: data.title,
          description: data.description || '',
          due_at: data.due_date ? buildDateTime(data.due_date, data.due_time || '09:00') : null,
          priority: data.priority || 'medium',
          tags: data.tags || [],
        });
        break;

      case 'create_note':
        if (!data.content?.includes('[conteúdo pendente')) {
          actionResult = await noteService.create({
            title: data.title || null,
            content: data.content || message,
            tags: data.tags || [],
          });
        }
        break;

      case 'health_log':
        actionResult = await healthService.log(data);
        break;

      case 'finance_log':
        actionResult = await financeService.create({
          title: data.title,
          amount: parseFloat(data.amount || 0),
          type: data.type || 'expense',
          category: data.category || 'Geral',
          due_at: data.due_at || null,
        });
        break;

      case 'query':
        actionResult = await handleQuery(data);
        break;
    }

    // Salva resposta da IA
    await db.query(
      `INSERT INTO chat_messages (role, content, metadata) VALUES ('assistant', $1, $2)`,
      [reply, JSON.stringify({ intent, data })]
    );

    res.json({ reply, intent, data, actionResult });

  } catch (err) {
    console.error('❌ Chat route error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/history — histórico de mensagens
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const { rows } = await db.query(
      `SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT $1`, [limit]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/chat/history — limpar histórico
router.delete('/history', async (req, res) => {
  await db.query(`DELETE FROM chat_messages`);
  res.json({ ok: true });
});

async function handleQuery(data) {
  const e = data.entity || '';
  if (e.includes('event')) return eventService.listUpcoming(5);
  if (e.includes('task')) return taskService.listPending(5);
  return null;
}

function buildDateTime(dateStr, timeStr) {
  if (!dateStr) return new Date();
  const [h, m] = (timeStr || '09:00').split(':');
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(parseInt(h), parseInt(m), 0, 0);
  return d;
}

module.exports = router;
