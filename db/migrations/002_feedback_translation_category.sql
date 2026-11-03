-- Add the translation-quality feedback category.
-- SQLite cannot alter a CHECK constraint in place, so rebuild the table while
-- preserving every row. This migration is applied once by schema_migrations.

PRAGMA foreign_keys = OFF;

CREATE TABLE feedback_v2 (
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

INSERT INTO feedback_v2
  (id, email, category, message, status, admin_note, consent, consented_at, created_at, updated_at)
SELECT
  id, email, category, message, status, admin_note, consent, consented_at, created_at, updated_at
FROM feedback;

DROP TABLE feedback;
ALTER TABLE feedback_v2 RENAME TO feedback;

CREATE INDEX IF NOT EXISTS feedback_created_at_idx
  ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_status_idx
  ON feedback (status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_category_idx
  ON feedback (category, created_at DESC);

PRAGMA foreign_keys = ON;