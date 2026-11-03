import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const configured = process.env.FEEDBACK_DB_PATH?.trim();
const dbPath = configured
  ? path.resolve(configured)
  : path.join(process.cwd(), ".data", "draftly.sqlite");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec(
  `CREATE TABLE IF NOT EXISTS schema_migrations (
     name TEXT PRIMARY KEY,
     applied_at TEXT NOT NULL
   );`
);

const applied = new Set(
  db
    .prepare("SELECT name FROM schema_migrations")
    .all()
    .map((row) => String(row.name))
);

function apply(name, file) {
  if (applied.has(name)) return;
  const sql = fs.readFileSync(
    path.join(process.cwd(), "db", "migrations", file),
    "utf8"
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(sql);
    db.prepare(
      "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)"
    ).run(name, new Date().toISOString());
    db.exec("COMMIT");
    applied.add(name);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

const hasFeedback = Boolean(
  db
    .prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'feedback'"
    )
    .get()
);

if (!hasFeedback) apply("001_feedback", "001_feedback.sql");
else if (!applied.has("001_feedback")) {
  db.prepare(
    "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)"
  ).run("001_feedback", new Date().toISOString());
  applied.add("001_feedback");
}
apply(
  "002_feedback_translation_category",
  "002_feedback_translation_category.sql"
);
apply("003_style_profiles", "003_style_profiles.sql");
db.close();

console.log(`Feedback schema ready at ${dbPath}`);