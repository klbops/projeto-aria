const { GoogleGenerativeAI } = require('@google/generative-ai');
const { z } = require('zod');
const chrono = require('chrono-node');
const dayjs  = require('dayjs');
require('dayjs/locale/pt-br');
dayjs.locale('pt-br');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const ResponseSchema = z.object({
  intent: z.enum([
    'create_event', 'create_task', 'create_note',
    'health_log', 'finance_log', 'query',
    'pending_content', 'chitchat',
  ]),
  data:  z.record(z.any()).default({}),
  reply: z.string().min(1),
});

function buildSystemPrompt() {
  const now      = dayjs();
  const today    = now.format('dddd, D [de] MMMM [de] YYYY');
  const time     = now.format('HH:mm');
  const tomorrow = now.add(1, 'day').format('YYYY-MM-DD');
  const dow      = now.day();
  const friday   = now.add((5 - dow + 7) % 7 || 7, 'day').format('YYYY-MM-DD');
  const monday   = now.add((8 - dow) % 7 || 7, 'day').format('YYYY-MM-DD');
  const exFriday   = dayjs(friday).format('DD/MM');
  const exTomorrow = dayjs(tomorrow).format('DD/MM');

  return `Você é ARIA, uma assistente pessoal inteligente. Responda SEMPRE em português brasileiro.

DATA ATUAL: ${today}
HORA ATUAL: ${time}
AMANHÃ: ${tomorrow}
PRÓXIMA SEXTA: ${friday}
PRÓXIMA SEGUNDA: ${monday}

REGRA PRINCIPAL: Responda SOMENTE com JSON puro e válido. Sem markdown, sem texto fora do JSON, sem blocos de código.

FORMATO OBRIGATÓRIO:
{"intent":"NOME_DA_INTENT","data":{...},"reply":"mensagem amigável em português com emojis"}

INTENTS DISPONÍVEIS:

create_event — agendar evento, reunião, prova, consulta, compromisso
create_task — criar tarefa, lembrete, afazer
create_note — anotar, registrar, salvar texto
health_log — registrar água, exercício, remédio, sono
finance_log — registrar gasto, despesa, receita
query — consultar, listar, mostrar dados
pending_content — usuário quer criar algo mas NÃO forneceu o conteúdo
chitchat — saudação, conversa, perguntas gerais

EXEMPLOS:

Input: boa tarde
Output: {"intent":"chitchat","data":{},"reply":"Boa tarde! 😊 Como posso te ajudar?"}

Input: oi
Output: {"intent":"chitchat","data":{},"reply":"Oi! 👋 Tudo bem? O que posso fazer por você?"}

Input: agendar reunião amanha as 15h
Output: {"intent":"create_event","data":{"title":"Reunião","date":"${tomorrow}","time":"15:00","reminder_min":30},"reply":"📅 Reunião agendada para amanhã (${exTomorrow}) às 15h! 🔔 Lembrete 30 min antes."}

Input: me lembra de pagar conta de luz na sexta
Output: {"intent":"create_task","data":{"title":"Pagar conta de luz","due_date":"${friday}","due_time":"09:00","priority":"high","tags":["contas"]},"reply":"✅ Lembrete criado! Pagar conta de luz na sexta (${exFriday}). 💡"}

Input: tomei omeprazol agora
Output: {"intent":"health_log","data":{"type":"medication","value":1,"unit":"dose","notes":"Omeprazol"},"reply":"💊 Omeprazol registrado! ✅"}

Input: gastei 45 reais no almoço
Output: {"intent":"finance_log","data":{"title":"Almoço","amount":45,"type":"expense","category":"Alimentação"},"reply":"💸 R$ 45,00 no almoço registrado!"}

Input: faça uma anotação
Output: {"intent":"pending_content","data":{"context":"note","title":""},"reply":"📝 Pode mandar o conteúdo! Vou salvar tudo."}

Input: quais meus eventos hoje
Output: {"intent":"query","data":{"entity":"events","filter":"today"},"reply":"🔍 Consultando seus eventos..."}`;
}

const sessions = new Map();

function getHistory(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  return sessions.get(sessionId);
}

function addToHistory(sessionId, role, text) {
  const hist = getHistory(sessionId);
  hist.push({ role, parts: [{ text }] });
  if (hist.length > 12) hist.splice(0, 2);
}

function parseGeminiResponse(raw) {
  let clean = raw.trim();
  clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}');
  if (start >= 0 && end >= 0) clean = clean.slice(start, end + 1);
  const parsed = JSON.parse(clean);
  return ResponseSchema.parse(parsed);
}

async function chat(userMessage, sessionId = 'default') {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    generationConfig: { temperature: 0.2, topP: 0.8, maxOutputTokens: 400 },
  });

  const systemPrompt = buildSystemPrompt();
  const history      = getHistory(sessionId);

  const contents = [
    { role: 'user',  parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: '{"intent":"chitchat","data":{},"reply":"Entendido! Pronta para ajudar."}' }] },
    ...history,
    { role: 'user',  parts: [{ text: userMessage }] },
  ];

  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent({ contents });
      const raw    = result.response.text();
      console.log('[Gemini raw]:', raw.substring(0, 300));
      const parsed = parseGeminiResponse(raw);
      addToHistory(sessionId, 'user',  userMessage);
      addToHistory(sessionId, 'model', JSON.stringify(parsed));
      return parsed;
    } catch (err) {
      lastError = err;
      console.error('[Gemini attempt ' + (attempt + 1) + ' failed]:', err.message);
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
    }
  }

  console.error('[Gemini] Todas as tentativas falharam:', lastError?.message);
  return {
    intent: 'chitchat',
    data:   {},
    reply:  '😅 Não entendi bem. Pode repetir? Ex: "agende reunião amanhã às 15h"',
  };
}

function parseDate(dateStr, timeStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [h, m] = (timeStr || '09:00').split(':').map(Number);
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    d.setHours(h ?? 9, m ?? 0, 0, 0);
    return d;
  }
  const text   = (dateStr + ' ' + (timeStr || '')).trim();
  const parsed = chrono.pt.parseDate(text, new Date(), { forwardDate: true });
  return parsed || null;
}

async function generateDailySummary({ events, tasks, weather, bills }) {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
  });
  const today = dayjs().format('dddd, D [de] MMMM');
  const prompt =
    'Crie um resumo matinal curto (máx 5 linhas) em português brasileiro, estilo Telegram com emojis.\n' +
    'Hoje é ' + today + '.\n' +
    'Eventos: ' + (events.length ? events.map(e => dayjs(e.start_at).format('HH:mm') + ' ' + e.title).join(', ') : 'nenhum') + '\n' +
    'Tarefas: ' + (tasks.length ? tasks.map(t => t.title).join(', ') : 'nenhuma') + '\n' +
    'Clima: ' + (weather ? weather.temp + 'C, ' + weather.description : 'não disponível') + '\n' +
    'Contas: ' + (bills.length ? bills.map(b => b.title + ' R$' + b.amount).join(', ') : 'nenhuma') + '\n' +
    'Termine com uma frase motivacional curta.';
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch {
    return '☀️ Bom dia! Hoje é ' + today + '.\n📅 ' + events.length + ' evento(s) | ✅ ' + tasks.length + ' tarefa(s)\nTenha um ótimo dia! 🚀';
  }
}

module.exports = { chat, parseDate, generateDailySummary };
