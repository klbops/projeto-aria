const cron    = require('node-cron');
const dayjs   = require('dayjs');
require('dayjs/locale/pt-br');
dayjs.locale('pt-br');

// Lazy-load para evitar circular deps na inicialização
const telegram  = () => require('./telegramService');
const eventSvc  = () => require('./eventService');
const taskSvc   = () => require('./taskService');
const financeSvc = () => require('./financeService');
const gemini    = () => require('./geminiService');

function safeNotify(text) {
  try { telegram().sendNotification(text); } catch (e) { console.error('cron notify error:', e.message); }
}

// ── Resumo diário — 07:30 ────────────────────────────────────────────────────
cron.schedule('30 7 * * *', async () => {
  try {
    const [events, tasks, bills] = await Promise.all([
      eventSvc().listToday(),
      taskSvc().listPending(5),
      financeSvc().getUpcomingBills(),
    ]);

    let weather = null;
    try {
      const w = require('./weatherService');
      weather = await w.getCurrent();
    } catch {}

    const summary = await gemini().generateDailySummary({ events, tasks, weather, bills });
    await safeNotify(summary);
  } catch (err) {
    console.error('❌ cron resumo:', err.message);
  }
}, { timezone: 'America/Sao_Paulo' });

// ── Lembretes de eventos — a cada 5 min ──────────────────────────────────────
cron.schedule('*/5 * * * *', async () => {
  try {
    const upcoming = await eventSvc().getDue(35); // eventos nas próximas 35 min
    for (const event of upcoming) {
      const minLeft = Math.round((new Date(event.start_at) - new Date()) / 60000);
      if (minLeft < 0) continue;
      await safeNotify(
        `🔔 *Lembrete!*\n` +
        `📅 *${event.title}*\n` +
        `⏰ Em ${minLeft} min (${dayjs(event.start_at).format('HH:mm')})\n` +
        (event.location ? `📍 ${event.location}` : '')
      );
    }
  } catch (err) {
    console.error('❌ cron lembretes:', err.message);
  }
});

// ── Água — a cada 2h entre 8h e 20h ──────────────────────────────────────────
cron.schedule('0 8,10,12,14,16,18,20 * * *', async () => {
  await safeNotify('💧 *Hora de beber água!* Mantenha-se hidratado. 🌊');
}, { timezone: 'America/Sao_Paulo' });

// ── Contas a vencer — 09:00 ───────────────────────────────────────────────────
cron.schedule('0 9 * * *', async () => {
  try {
    const bills = await financeSvc().getUpcomingBills();
    if (!bills.length) return;
    const list = bills.map(b =>
      `• *${b.title}* — R$ ${parseFloat(b.amount).toFixed(2)} (${dayjs(b.due_at).format('DD/MM')})`
    ).join('\n');
    await safeNotify(`💰 *Contas a pagar esta semana:*\n\n${list}`);
  } catch (err) {
    console.error('❌ cron contas:', err.message);
  }
}, { timezone: 'America/Sao_Paulo' });

// ── Relatório semanal — domingo 20h ──────────────────────────────────────────
cron.schedule('0 20 * * 0', async () => {
  try {
    const [{ summary }, doneTasks] = await Promise.all([
      financeSvc().listAll({ limit: 1 }),
      taskSvc().listAll({ status: 'done' }),
    ]);
    const income  = parseFloat(summary?.income || 0).toFixed(2);
    const expense = parseFloat(summary?.expense || 0).toFixed(2);
    await safeNotify(
      `📊 *Resumo Semanal ARIA*\n\n` +
      `✅ Tarefas concluídas: ${doneTasks.total}\n` +
      `💚 Receitas: R$ ${income}\n` +
      `💸 Despesas: R$ ${expense}\n\n` +
      `Boa semana! 🚀`
    );
  } catch (err) {
    console.error('❌ cron semanal:', err.message);
  }
}, { timezone: 'America/Sao_Paulo' });

console.log('⏰ Cron jobs registrados: resumo 07:30 | lembretes 5min | água 2h | contas 09:00 | semanal dom 20h');
