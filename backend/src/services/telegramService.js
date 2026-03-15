
require('dns').setDefaultResultOrder('ipv4first'); // <--- ADICIONE ESTA LINHA NO TOPO
const TelegramBot = require('node-telegram-bot-api');
const gemini    = require('./geminiService');
const TelegramBot = require('node-telegram-bot-api');
const gemini    = require('./geminiService');
const eventSvc  = require('./eventService');
const taskSvc   = require('./taskService');
const noteSvc   = require('./noteService');
const healthSvc = require('./healthService');
const financeSvc = require('./financeService');
const db        = require('../../config/database');
const dayjs     = require('dayjs');
require('dayjs/locale/pt-br');
dayjs.locale('pt-br');

let bot = null;

// ─── Contexto pendente por chat (aguardando input do usuário) ─────────────────
// Ex: usuário pediu para anotar mas não deu o conteúdo ainda
const pendingContext = new Map();

// ─── Inicializa o bot ─────────────────────────────────────────────────────────
async function init() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN não configurado no .env');

  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && process.env.WEBHOOK_URL) {
    // Modo webhook para produção
    bot = new TelegramBot(token);
    const webhookUrl = `${process.env.WEBHOOK_URL}/webhook/telegram`;
    await bot.setWebHook(webhookUrl);
    console.log(`🔗 Webhook configurado: ${webhookUrl}`);
  } else {
    // Modo polling para desenvolvimento
    bot = new TelegramBot(token, {
      polling: true,
      request: {
        agentOptions: {
          family: 4 // Força estritamente o uso de IPv4 na conexão
        }
      }
    });
    console.log('📡 Bot rodando em modo polling (dev) - IPv4 Forçado');
  }

  bot.on('message',       handleMessage);
  bot.on('callback_query', handleCallback);
  bot.on('polling_error', err => console.error('Telegram polling error:', err.message));

  return bot;
}

// ─── Handler principal ────────────────────────────────────────────────────────
async function handleMessage(msg) {
  const chatId = String(msg.chat.id);
  const text   = msg.text?.trim();

  if (!text) return;

  // Segurança: bloqueia chats não autorizados
  const allowedId = process.env.TELEGRAM_CHAT_ID;
  if (allowedId && chatId !== String(allowedId)) {
    return bot.sendMessage(chatId, '⛔ Acesso não autorizado.');
  }

  // Ignora comandos do tipo /start tratados abaixo
  if (text.startsWith('/')) return handleCommand(chatId, text);

  try {
    await bot.sendChatAction(chatId, 'typing');

    // Verifica se há contexto pendente esperando input do usuário
    const pending = pendingContext.get(chatId);
    if (pending) {
      pendingContext.delete(chatId);
      return handlePendingInput(chatId, text, pending);
    }

    // Envia para o Gemini
    const result = await gemini.chat(text, chatId);
    await dispatch(chatId, result, text);

  } catch (err) {
    console.error('❌ handleMessage error:', err);
    await send(chatId, '❌ Algo deu errado. Tente novamente!');
  }
}

// ─── Despacha a ação de acordo com a intent ───────────────────────────────────
async function dispatch(chatId, result, originalText) {
  const { intent, data, reply } = result;

  // Salva no histórico do banco
  await saveMsg('user', originalText, chatId);

  switch (intent) {

    case 'create_event': {
      const startAt = gemini.parseDate(data.date, data.time);
      const endAt   = data.end_time ? gemini.parseDate(data.date, data.end_time) : null;

      if (!startAt) {
        await send(chatId, '⚠️ Não consegui identificar a data. Pode repetir? Ex: _"dia 10 de março às 18h"_');
        return;
      }

      const event = await eventSvc.create({
        title:        data.title,
        description:  data.description || '',
        start_at:     startAt,
        end_at:       endAt,
        location:     data.location || null,
        reminder_min: data.reminder_min || 30,
      });

      const msg =
        `${reply}\n\n` +
        `📅 *${event.title}*\n` +
        `🕐 ${dayjs(event.start_at).format('DD/MM/YYYY [às] HH:mm')}\n` +
        (event.location ? `📍 ${event.location}\n` : '') +
        `🔔 Lembrete ${event.reminder_min} min antes`;

      await send(chatId, msg, inlineKeyboard([
        [{ text: '🗑️ Cancelar evento', callback_data: `del_event_${event.id}` }],
      ]));
      break;
    }

    case 'create_task': {
      const dueAt = data.due_date ? gemini.parseDate(data.due_date, data.due_time) : null;

      const task = await taskSvc.create({
        title:       data.title,
        description: data.description || '',
        due_at:      dueAt,
        priority:    data.priority || 'medium',
        tags:        data.tags || [],
      });

      const msg =
        `${reply}\n\n` +
        `✅ *${task.title}*\n` +
        (task.due_at ? `📅 Prazo: ${dayjs(task.due_at).format('DD/MM/YYYY [às] HH:mm')}\n` : '') +
        `🏷️ ${priorityLabel(task.priority)}`;

      await send(chatId, msg, inlineKeyboard([
        [
          { text: '✅ Marcar como feita', callback_data: `done_task_${task.id}` },
          { text: '🗑️ Excluir',           callback_data: `del_task_${task.id}` },
        ],
      ]));
      break;
    }

    case 'create_note': {
      // Conteúdo veio junto com o comando
      const note = await noteSvc.create({
        title:   data.title || null,
        content: data.content,
        tags:    data.tags || [],
      });

      const msg =
        `${reply}\n\n` +
        `📝 *${note.title || 'Nota salva'}*\n` +
        (note.tags?.length ? `🏷️ Tags: ${note.tags.map(t => '#' + t).join(' ')}` : '');

      await send(chatId, msg);
      break;
    }

    case 'pending_content': {
      // Usuário quer criar algo mas falta o conteúdo → guarda contexto
      pendingContext.set(chatId, { type: data.context, meta: data });
      await send(chatId, reply);
      break;
    }

    case 'health_log': {
      await healthSvc.log({
        type:  data.type,
        value: data.value,
        unit:  data.unit,
        notes: data.notes,
      });
      await send(chatId, reply);
      break;
    }

    case 'finance_log': {
      await financeSvc.create({
        title:    data.title,
        amount:   parseFloat(data.amount),
        type:     data.type,
        category: data.category || 'Geral',
        due_at:   data.due_at ? new Date(data.due_at) : null,
      });
      await send(chatId, reply);
      break;
    }

    case 'query': {
      const response = await handleQuery(data.entity, data.filter);
      await send(chatId, response);
      break;
    }

    default:
      await send(chatId, reply || '🤔 Não entendi. Pode reformular?');
  }

  await saveMsg('assistant', reply, chatId);
}

// ─── Recebe conteúdo que estava pendente ──────────────────────────────────────
async function handlePendingInput(chatId, text, pending) {
  await bot.sendChatAction(chatId, 'typing');

  if (pending.type === 'note') {
    const meta = pending.meta || {};
    const note = await noteSvc.create({
      title:   meta.title || null,
      content: text,
      tags:    meta.tags || [],
    });
    const msg =
      `📝 *Anotação salva!*\n\n` +
      `*${note.title || 'Nota'}*\n` +
      `${text.slice(0, 120)}${text.length > 120 ? '...' : ''}\n` +
      (note.tags?.length ? `🏷️ ${note.tags.map(t => '#' + t).join(' ')}` : '');
    await send(chatId, msg);
    return;
  }

  // Fallback: passa para o fluxo normal
  const result = await gemini.chat(text, chatId);
  await dispatch(chatId, result, text);
}

// ─── Callback de botões inline ────────────────────────────────────────────────
async function handleCallback(query) {
  const chatId = String(query.message.chat.id);
  const data   = query.data;

  await bot.answerCallbackQuery(query.id);

  if (data.startsWith('done_task_')) {
    const id = parseInt(data.replace('done_task_', ''));
    await taskSvc.complete(id);
    await bot.editMessageText('✅ Tarefa marcada como concluída!', {
      chat_id: chatId, message_id: query.message.message_id,
    });
  }

  if (data.startsWith('del_task_')) {
    const id = parseInt(data.replace('del_task_', ''));
    await taskSvc.remove(id);
    await bot.editMessageText('🗑️ Tarefa removida.', {
      chat_id: chatId, message_id: query.message.message_id,
    });
  }

  if (data.startsWith('del_event_')) {
    const id = parseInt(data.replace('del_event_', ''));
    await eventSvc.remove(id);
    await bot.editMessageText('🗑️ Evento removido.', {
      chat_id: chatId, message_id: query.message.message_id,
    });
  }
}

// ─── Comandos /start /help /resumo etc. ──────────────────────────────────────
async function handleCommand(chatId, text) {
  const [cmd] = text.toLowerCase().split(' ');

  switch (cmd) {
    case '/start':
      await send(chatId,
        `👋 Olá! Sou a *ARIA*, sua assistente pessoal inteligente.\n\n` +
        `Fale comigo naturalmente em português! Exemplos:\n\n` +
        `📅 _"Agende prova de arquitetura dia 10 às 18h"_\n` +
        `✅ _"Me lembra de pagar conta de luz na sexta"_\n` +
        `📝 _"Anote a aula de notação hexadecimal"_\n` +
        `💊 _"Tomei o omeprazol agora"_\n` +
        `💰 _"Gastei R$50 no almoço"_\n` +
        `📊 _"Quais meus eventos de hoje?"_\n\n` +
        `Use /help para ver todos os comandos.`
      );
      break;

    case '/help':
      await send(chatId,
        `📖 *Comandos disponíveis*\n\n` +
        `/start — Apresentação\n` +
        `/resumo — Resumo do seu dia\n` +
        `/eventos — Próximos eventos\n` +
        `/tarefas — Tarefas pendentes\n` +
        `/notas — Últimas anotações\n` +
        `/financeiro — Resumo financeiro do mês\n` +
        `/saude — Log de saúde de hoje\n\n` +
        `Ou simplesmente *fale comigo* em linguagem natural! 🤖`
      );
      break;

    case '/resumo': {
      await bot.sendChatAction(chatId, 'typing');
      const [events, tasks, bills] = await Promise.all([
        eventSvc.listToday(),
        taskSvc.listPending(5),
        financeSvc.getUpcomingBills(),
      ]);
      let weather = null;
      try { const w = require('./weatherService'); weather = await w.getCurrent(); } catch {}
      const { generateDailySummary } = require('./geminiService');
      const summary = await generateDailySummary({ events, tasks, weather, bills });
      await send(chatId, summary);
      break;
    }

    case '/eventos': {
      const events = await eventSvc.listUpcoming(7);
      if (!events.length) { await send(chatId, '📅 Nenhum evento próximo.'); break; }
      const list = events.map(e =>
        `• *${e.title}*\n  🕐 ${dayjs(e.start_at).format('DD/MM [às] HH:mm')}${e.location ? '\n  📍 ' + e.location : ''}`
      ).join('\n\n');
      await send(chatId, `📅 *Próximos eventos:*\n\n${list}`);
      break;
    }

    case '/tarefas': {
      const tasks = await taskSvc.listPending(10);
      if (!tasks.length) { await send(chatId, '✅ Nenhuma tarefa pendente! 🎉'); break; }
      const list = tasks.map(t =>
        `${priorityLabel(t.priority)} *${t.title}*${t.due_at ? '\n  📅 ' + dayjs(t.due_at).format('DD/MM [às] HH:mm') : ''}`
      ).join('\n\n');
      await send(chatId, `✅ *Tarefas pendentes:*\n\n${list}`);
      break;
    }

    case '/notas': {
      const { items } = await noteSvc.listAll({ limit: 5 });
      if (!items.length) { await send(chatId, '📝 Nenhuma nota salva ainda.'); break; }
      const list = items.map(n =>
        `📝 *${n.title || 'Sem título'}*\n${n.content.slice(0, 80)}${n.content.length > 80 ? '...' : ''}`
      ).join('\n\n');
      await send(chatId, `📝 *Últimas notas:*\n\n${list}`);
      break;
    }

    case '/financeiro': {
      const { summary } = await financeSvc.listAll({ limit: 1 });
      const income  = parseFloat(summary?.income || 0).toFixed(2);
      const expense = parseFloat(summary?.expense || 0).toFixed(2);
      const balance = (parseFloat(income) - parseFloat(expense)).toFixed(2);
      await send(chatId,
        `💰 *Financeiro — ${dayjs().format('MMMM/YYYY')}*\n\n` +
        `💚 Receitas: R$ ${income}\n` +
        `💸 Despesas: R$ ${expense}\n` +
        `📊 Saldo: R$ ${balance}`
      );
      break;
    }

    case '/saude': {
      const logs = await healthSvc.getTodaySummary();
      if (!logs.length) { await send(chatId, '💚 Nenhum registro de saúde hoje ainda.'); break; }
      const list = logs.map(l => {
        const icons = { water: '💧', exercise: '🏃', sleep: '😴', medication: '💊' };
        return `${icons[l.type] || '❤️'} ${l.type}: ${l.total}${l.unit || ''}`;
      }).join('\n');
      await send(chatId, `💚 *Saúde hoje:*\n\n${list}`);
      break;
    }

    default:
      await send(chatId, '❓ Comando não reconhecido. Use /help.');
  }
}

// ─── Query de dados ───────────────────────────────────────────────────────────
async function handleQuery(entity = '', filter = '') {
  const e = entity.toLowerCase();

  if (e.includes('event') || e.includes('agenda') || e.includes('compromisso')) {
    const events = await eventSvc.listUpcoming(5);
    if (!events.length) return '📅 Nenhum evento próximo.';
    return '📅 *Próximos eventos:*\n\n' + events.map(ev =>
      `• *${ev.title}* — ${dayjs(ev.start_at).format('DD/MM [às] HH:mm')}`
    ).join('\n');
  }

  if (e.includes('task') || e.includes('tarefa')) {
    const tasks = await taskSvc.listPending(5);
    if (!tasks.length) return '✅ Nenhuma tarefa pendente!';
    return '✅ *Tarefas pendentes:*\n\n' + tasks.map(t =>
      `${priorityLabel(t.priority)} ${t.title}${t.due_at ? ' — ' + dayjs(t.due_at).format('DD/MM') : ''}`
    ).join('\n');
  }

  if (e.includes('nota') || e.includes('note')) {
    const { items } = await noteSvc.listAll({ limit: 5 });
    if (!items.length) return '📝 Nenhuma nota salva.';
    return '📝 *Últimas notas:*\n\n' + items.map(n =>
      `• *${n.title || 'Sem título'}* — ${n.content.slice(0, 50)}...`
    ).join('\n');
  }

  if (e.includes('financ') || e.includes('gasto') || e.includes('dinheiro')) {
    const { summary } = await financeSvc.listAll({ limit: 1 });
    const balance = (parseFloat(summary?.income || 0) - parseFloat(summary?.expense || 0)).toFixed(2);
    return `💰 Saldo do mês: R$ ${balance}`;
  }

  return '🔍 Pode ser mais específico? Ex: "eventos de hoje", "tarefas pendentes"';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function send(chatId, text, options = {}) {
  try {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...options });
  } catch {
    // Fallback sem Markdown (ex: caracteres especiais)
    const plain = text.replace(/[*_`\[\]]/g, '');
    await bot.sendMessage(chatId, plain, options).catch(console.error);
  }
}

function inlineKeyboard(buttons) {
  return { reply_markup: { inline_keyboard: buttons } };
}

function priorityLabel(p) {
  return { high: '🔴', medium: '🟡', low: '🟢' }[p] || '⚪';
}

async function saveMsg(role, content, chatId) {
  try {
    await db.query(
      `INSERT INTO chat_messages (role, content, metadata) VALUES ($1,$2,$3)`,
      [role, content, JSON.stringify({ chat_id: chatId })]
    );
  } catch {} // Não quebra o fluxo se o banco falhar
}

// ─── Envio proativo (chamado pelos cron jobs) ─────────────────────────────────
async function sendNotification(text) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId || !bot) {
    console.warn('sendNotification: bot ou TELEGRAM_CHAT_ID não configurado');
    return;
  }
  await send(chatId, text);
}

function getBot() { return bot; }

module.exports = { init, sendNotification, getBot, send };
