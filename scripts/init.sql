-- ════════════════════════════════════════════
--  ARIA — Database Init Script
-- ════════════════════════════════════════════

CREATE DATABASE n8n_db OWNER aria_user;

\c aria_db;

-- ── Events ──────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(500) NOT NULL,
  description  TEXT,
  start_at     TIMESTAMPTZ NOT NULL,
  end_at       TIMESTAMPTZ,
  location     VARCHAR(300),
  google_id    VARCHAR(300),
  reminder_min INTEGER DEFAULT 30,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tasks ────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(500) NOT NULL,
  description  TEXT,
  status       VARCHAR(30) DEFAULT 'pending',  -- pending | done | cancelled
  priority     VARCHAR(20) DEFAULT 'medium',   -- low | medium | high
  due_at       TIMESTAMPTZ,
  google_id    VARCHAR(300),
  tags         TEXT[],
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notes ────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(500),
  content      TEXT NOT NULL,
  tags         TEXT[],
  starred      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Health Logs ──────────────────────────────
CREATE TABLE IF NOT EXISTS health_logs (
  id           SERIAL PRIMARY KEY,
  type         VARCHAR(50) NOT NULL,  -- water | exercise | sleep | medication
  value        NUMERIC,
  unit         VARCHAR(30),
  notes        TEXT,
  logged_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Medications ──────────────────────────────
CREATE TABLE IF NOT EXISTS medications (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  dosage       VARCHAR(100),
  schedule     TEXT[],  -- ['08:00','20:00']
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Transactions (Finance) ────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(500) NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  type         VARCHAR(20) NOT NULL,   -- income | expense
  category     VARCHAR(100),
  due_at       TIMESTAMPTZ,
  paid         BOOLEAN DEFAULT FALSE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Contacts ─────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(300) NOT NULL,
  role         VARCHAR(200),
  email        VARCHAR(200),
  phone        VARCHAR(50),
  tags         TEXT[],
  google_id    VARCHAR(300),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Chat History ──────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id           SERIAL PRIMARY KEY,
  role         VARCHAR(20) NOT NULL,  -- user | assistant
  content      TEXT NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────
CREATE INDEX idx_events_start ON events(start_at);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_at);
CREATE INDEX idx_notes_tags ON notes USING GIN(tags);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_chat_created ON chat_messages(created_at);
