import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  FeedbackCategory,
  FeedbackRecord,
  FeedbackStatus,
} from "@/lib/feedback/types";

type DatabaseGlobal = typeof globalThis & {
  __draftlyFeedbackDb?: DatabaseSync;
};

const globalForDb = globalThis as DatabaseGlobal;

export const DEFAULT_FEEDBACK_DB_PATH = path.join(
  process.cwd(),
  ".data",
  "draftly.sqlite"
);

export function getFeedbackDbPath(): string {
  const configured = process.env.FEEDBACK_DB_PATH?.trim();
  return configured ? path.resolve(configured) : DEFAULT_FEEDBACK_DB_PATH;
}

function migrate(db: DatabaseSync): void {
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
      .map((row) => String((row as { name: string }).name))
  );

  const apply = (name: string, file: string) => {
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
  };

  const hasFeedback = Boolean(
    db
      .prepare(
        "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'feedback'"
      )
      .get()
  );

  if (!hasFeedback) {
    apply("001_feedback", "001_feedback.sql");
  } else if (!applied.has("001_feedback")) {
    // Older databases were created before schema_migrations existed. The table
    // proves 001 ran, so record it without replaying the CREATE TABLE.
    db.prepare(
      "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)"
    ).run("001_feedback", new Date().toISOString());
    applied.add("001_feedback");
  }
  apply("002_feedback_translation_category", "002_feedback_translation_category.sql");
  apply("003_style_profiles", "003_style_profiles.sql");
  apply("004_analytics", "004_analytics.sql");
}

export function getFeedbackDb(): DatabaseSync {
  if (globalForDb.__draftlyFeedbackDb) return globalForDb.__draftlyFeedbackDb;

  const file = getFeedbackDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  migrate(db);

  globalForDb.__draftlyFeedbackDb = db;
  return db;
}

type FeedbackRow = FeedbackRecord;

export function createFeedback(input: {
  email: string | null;
  category: FeedbackCategory;
  message: string;
}): string {
  const db = getFeedbackDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO feedback
      (id, email, category, message, status, admin_note, consent, consented_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'new', NULL, 1, ?, ?, ?)`
  ).run(id, input.email, input.category, input.message, now, now, now);

  return id;
}

export type FeedbackListOptions = {
  search?: string;
  category?: FeedbackCategory | null;
  status?: FeedbackStatus | null;
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
};

export type FeedbackStats = {
  all: number;
  new: number;
  in_progress: number;
  resolved: number;
  archived: number;
};

export type FeedbackListResult = {
  items: FeedbackRecord[];
  total: number;
  page: number;
  pageSize: number;
  stats: FeedbackStats;
};

export function listFeedback(options: FeedbackListOptions = {}): FeedbackListResult {
  const db = getFeedbackDb();
  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 50);
  const page = Math.max(options.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (options.category) {
    clauses.push("category = ?");
    params.push(options.category);
  }
  if (options.status) {
    clauses.push("status = ?");
    params.push(options.status);
  }
  if (options.search?.trim()) {
    const search = `%${options.search.trim().toLowerCase()}%`;
    clauses.push(
      "(lower(coalesce(email, '')) LIKE ? OR lower(message) LIKE ?)"
    );
    params.push(search, search);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const order = options.sort === "oldest" ? "ASC" : "DESC";

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS count FROM feedback ${where}`)
    .get(...params) as { count: number } | undefined;

  const items = db
    .prepare(
      `SELECT * FROM feedback ${where}
       ORDER BY created_at ${order}
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as FeedbackRow[];

  const statusRows = db
    .prepare("SELECT status, COUNT(*) AS count FROM feedback GROUP BY status")
    .all() as { status: FeedbackStatus; count: number }[];

  const stats: FeedbackStats = {
    all: 0,
    new: 0,
    in_progress: 0,
    resolved: 0,
    archived: 0,
  };

  for (const row of statusRows) {
    stats[row.status] = row.count;
    stats.all += row.count;
  }

  return {
    items,
    total: totalRow?.count ?? 0,
    page,
    pageSize,
    stats,
  };
}

export function getFeedback(id: string): FeedbackRecord | null {
  const db = getFeedbackDb();
  const row = db.prepare("SELECT * FROM feedback WHERE id = ?").get(id) as
    | FeedbackRow
    | undefined;
  return row ?? null;
}

export function updateFeedback(
  id: string,
  patch: { status?: FeedbackStatus; admin_note?: string | null }
): FeedbackRecord | null {
  const db = getFeedbackDb();
  const fields: string[] = [];
  const params: (string | null)[] = [];

  if (patch.status !== undefined) {
    fields.push("status = ?");
    params.push(patch.status);
  }
  if (patch.admin_note !== undefined) {
    fields.push("admin_note = ?");
    params.push(patch.admin_note);
  }
  if (!fields.length) return getFeedback(id);

  fields.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(id);

  const result = db
    .prepare(`UPDATE feedback SET ${fields.join(", ")} WHERE id = ?`)
    .run(...params);

  if (!result.changes) return null;
  return getFeedback(id);
}

export function deleteFeedback(id: string): boolean {
  const db = getFeedbackDb();
  const result = db.prepare("DELETE FROM feedback WHERE id = ?").run(id);
  return result.changes > 0;
}