# ARIA — Assistente Pessoal via Telegram

Bot inteligente com linguagem natural, Gemini AI e PostgreSQL.

## Stack

```
Telegram ←→ Node.js + Express ←→ Gemini 2.0 Flash ←→ PostgreSQL
                    ↕
              Cron Jobs (lembretes automáticos)
```

## Subindo em 5 minutos

### 1. Configure o .env

```bash
cp env.example .env
nano .env
```

Campos obrigatórios:

| Campo | Como obter |
|-------|-----------|
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` |
| `TELEGRAM_CHAT_ID` | Mande msg pro bot → `api.telegram.org/bot<TOKEN>/getUpdates` → campo `chat.id` |
| `GEMINI_API_KEY` | aistudio.google.com — gratuito |

### 2. Sobe

```bash
docker compose up -d
docker compose logs -f backend
```

### 3. Testa

Mande `/start` pro seu bot no Telegram.

---

## Exemplos de uso

```
"Aria, agende prova de arquitetura dia 10 às 18h"
"Aria, anote a aula de notação hexadecimal"
"Me lembra de pagar conta de luz na sexta"
"Tomei omeprazol agora"
"Gastei R$45 no almoço"
"Quais meus eventos de hoje?"
```

## Comandos

| Comando | Ação |
|---------|------|
| `/start` | Apresentação |
| `/resumo` | Resumo do dia |
| `/eventos` | Próximos eventos |
| `/tarefas` | Tarefas pendentes |
| `/notas` | Últimas notas |
| `/financeiro` | Resumo financeiro |
| `/saude` | Log de hoje |

## Docker

```bash
docker compose logs -f backend        # logs
docker compose restart backend        # reiniciar
docker compose up -d --build backend  # rebuild
docker compose down                   # parar
```
