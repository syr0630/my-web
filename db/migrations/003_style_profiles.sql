-- Reusable writing-style profiles owned by one anonymous browser visitor.
-- Analysis and samples are JSON text validated by the server before insert.

CREATE TABLE IF NOT EXISTS style_profiles (
  id             TEXT PRIMARY KEY,
  owner_id       TEXT NOT NULL,
  name           TEXT NOT NULL,
  analysis_json  TEXT NOT NULL,
  samples_json   TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS style_profiles_owner_updated_idx
  ON style_profiles (owner_id, updated_at DESC);