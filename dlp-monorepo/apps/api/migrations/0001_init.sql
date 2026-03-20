PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  phone TEXT,
  home_church TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_global_roles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS urgent_prayers (
  id TEXT PRIMARY KEY,
  author_user_id TEXT NOT NULL,
  author_name_cache TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  deleted_at INTEGER,
  deleted_by_admin_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_urgent_prayers_active
ON urgent_prayers (expires_at, deleted_at, created_at);

CREATE TABLE IF NOT EXISTS mcheyne_plan (
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  reading1 TEXT NOT NULL,
  reading2 TEXT NOT NULL,
  reading3 TEXT NOT NULL,
  reading4 TEXT NOT NULL,
  PRIMARY KEY (month, day)
);

CREATE TABLE IF NOT EXISTS mcheyne_reads (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  done_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS dlp_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  bible_chapters INTEGER NOT NULL DEFAULT 0,
  prayer_minutes INTEGER NOT NULL DEFAULT 0,
  evangelism_count INTEGER NOT NULL DEFAULT 0,
  qt_apply TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS gratitude_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  board_type TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  author_id TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER
);

PRAGMA foreign_keys=ON;
