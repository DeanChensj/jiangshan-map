CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL DEFAULT 'jiangshan',
  page_key TEXT NOT NULL DEFAULT 'guestbook',
  kind TEXT NOT NULL DEFAULT 'comment',
  lang TEXT NOT NULL DEFAULT 'zh',
  author TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  reply TEXT NOT NULL DEFAULT '',
  replied_at TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'XX',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_public
  ON messages (site, page_key, kind, status, id DESC);

CREATE INDEX IF NOT EXISTS idx_messages_status
  ON messages (status, id DESC);

CREATE INDEX IF NOT EXISTS idx_messages_rate
  ON messages (ip_hash, created_at DESC);
