-- QT memo stored separately (optional)
-- NOTE: In MVP we reuse dlp_entries.qt_apply as the single source of truth.
-- This table is reserved for future expansion (e.g., multi-field QT form).
CREATE TABLE IF NOT EXISTS qt_memos (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  memo TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, date)
);
