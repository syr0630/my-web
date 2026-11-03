-- Draftly feedback inbox
-- SQLite reference schema. The same fields map 1:1 to Postgres.

CREATE TABLE IF NOT EXISTS feedback (
  id            TEXT PRIMARY KEY,
  email         TEXT,
  category      TEXT NOT NULL CHECK (
    category IN ('feature_request', 'bug_report', 'translation_quality', 'writing_experience', 'other')
  ),
  message       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'in_progress', 'resolved', 'archived')
  ),
  admin_note    TEXT,
  consent       INTEGER NOT NULL DEFAULT 1 CHECK (consent IN (0, 1)),
  consented_at  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx
  ON feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS feedback_status_idx
  ON feedback (status, created_at DESC);

CREATE INDEX IF NOT EXISTS feedback_category_idx
  ON feedback (category, created_at DESC);