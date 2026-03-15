#!/usr/bin/env bash
# ════════════════════════════════════════════════
#  ARIA — Setup Script
#  Execute: chmod +x scripts/setup.sh && ./scripts/setup.sh
# ════════════════════════════════════════════════
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[ARIA]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC}  $1"; }

log "Iniciando setup do projeto ARIA..."

# 1. Verifica dependências
for cmd in node npm docker git; do
  if ! command -v $cmd &>/dev/null; then
    err "$cmd não encontrado. Instale antes de continuar."
    exit 1
  fi
done
log "Dependências verificadas ✓"

# 2. Copia .env
if [ ! -f .env ]; then
  cp .env.example .env
  warn "Arquivo .env criado. EDITE com suas credenciais antes de continuar!"
  warn "Principais: TELEGRAM_BOT_TOKEN, GEMINI_API_KEY, GOOGLE_CLIENT_ID"
fi

# 3. Instala dependências do backend
log "Instalando dependências do backend..."
cd backend && npm install && cd ..

# 4. Instala dependências do frontend
log "Instalando dependências do frontend..."
cd frontend && npm install && cd ..

# 5. Cria diretórios necessários
mkdir -p logs

log ""
log "════════════════════════════════════════"
log "  ✅ Setup concluído!"
log ""
log "  Próximos passos:"
log "  1. Edite o .env com suas credenciais"
log "  2. Execute: docker compose up -d"
log "  3. Aguarde os serviços iniciarem"
log "  4. Frontend: http://localhost:3000"
log "  5. Backend:  http://localhost:3001"
log "  6. n8n:      http://localhost:5678"
log ""
log "  Para dev local (sem Docker):"
log "  Backend:  cd backend && npm run dev"
log "  Frontend: cd frontend && npm run dev"
log "════════════════════════════════════════"
