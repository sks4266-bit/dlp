-- Track McCheyne reading completion per user/day
BEGIN;

CREATE TABLE IF NOT EXISTS mcheyne_progress (
  user_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  done1 INTEGER NOT NULL DEFAULT 0,
  done2 INTEGER NOT NULL DEFAULT 0,
  done3 INTEGER NOT NULL DEFAULT 0,
  done4 INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, month, day)
);

CREATE INDEX IF NOT EXISTS idx_mcheyne_progress_user ON mcheyne_progress(user_id);

COMMIT;
