-- Anonymous, first-party usage analytics.
-- No IP addresses, raw text, emails or cookies are stored here.

CREATE TABLE IF NOT EXISTS analytics_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type  TEXT NOT NULL CHECK (event_type IN ('page_view', 'feature_run')),
  path        TEXT,
  feature     TEXT,
  status      TEXT CHECK (status IS NULL OR status IN ('success', 'error')),
  visitor_id  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS analytics_events_created_idx
  ON analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_type_created_idx
  ON analytics_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_feature_created_idx
  ON analytics_events (feature, created_at DESC);