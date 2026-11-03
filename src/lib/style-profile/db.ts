import { randomUUID } from "node:crypto";
import { getFeedbackDb } from "@/lib/feedback/db";
import type {
  StyleAnalysis,
  StyleProfile,
  StyleProfileSummary,
  StyleSample,
} from "@/types";

type StyleProfileRow = {
  id: string;
  owner_id: string;
  name: string;
  analysis_json: string;
  samples_json: string;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function rowToProfile(row: StyleProfileRow): StyleProfile | null {
  const analysis = parseJson<StyleAnalysis>(row.analysis_json);
  const samples = parseJson<StyleSample[]>(row.samples_json);
  if (!analysis || !Array.isArray(samples)) return null;

  const sampleChars = samples.reduce(
    (total, sample) => total + (sample.chars || 0),
    0
  );

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sampleCount: samples.length,
    sampleChars,
    confidence: analysis.confidence,
    summary: analysis.summary,
    analysis,
    samples,
  };
}

function toSummary(profile: StyleProfile): StyleProfileSummary {
  return {
    id: profile.id,
    name: profile.name,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    sampleCount: profile.sampleCount,
    sampleChars: profile.sampleChars,
    confidence: profile.confidence,
    summary: profile.summary,
  };
}

export function listStyleProfiles(ownerId: string): StyleProfileSummary[] {
  const rows = getFeedbackDb()
    .prepare(
      `SELECT * FROM style_profiles
       WHERE owner_id = ?
       ORDER BY updated_at DESC
       LIMIT 50`
    )
    .all(ownerId) as StyleProfileRow[];

  return rows
    .map((row) => rowToProfile(row))
    .filter((profile): profile is StyleProfile => profile !== null)
    .map(toSummary);
}

export function countStyleProfiles(ownerId: string): number {
  const row = getFeedbackDb()
    .prepare("SELECT COUNT(*) AS count FROM style_profiles WHERE owner_id = ?")
    .get(ownerId) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function getStyleProfile(
  ownerId: string,
  id: string
): StyleProfile | null {
  const row = getFeedbackDb()
    .prepare("SELECT * FROM style_profiles WHERE id = ? AND owner_id = ?")
    .get(id, ownerId) as StyleProfileRow | undefined;
  return row ? rowToProfile(row) : null;
}

export function createStyleProfile(input: {
  ownerId: string;
  name: string;
  analysis: StyleAnalysis;
  samples: StyleSample[];
}): StyleProfile {
  const db = getFeedbackDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO style_profiles
      (id, owner_id, name, analysis_json, samples_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.ownerId,
    input.name,
    JSON.stringify(input.analysis),
    JSON.stringify(input.samples),
    now,
    now
  );

  const created = getStyleProfile(input.ownerId, id);
  if (!created) throw new Error("style profile insert failed");
  return created;
}

export function updateStyleProfile(
  ownerId: string,
  id: string,
  patch: {
    name?: string;
    analysis?: StyleAnalysis;
    samples?: StyleSample[];
  }
): StyleProfile | null {
  const current = getStyleProfile(ownerId, id);
  if (!current) return null;

  const fields: string[] = [];
  const params: (string)[] = [];

  if (patch.name !== undefined) {
    fields.push("name = ?");
    params.push(patch.name);
  }
  if (patch.analysis !== undefined) {
    fields.push("analysis_json = ?");
    params.push(JSON.stringify(patch.analysis));
  }
  if (patch.samples !== undefined) {
    fields.push("samples_json = ?");
    params.push(JSON.stringify(patch.samples));
  }
  if (!fields.length) return current;

  fields.push("updated_at = ?");
  params.push(new Date().toISOString(), id, ownerId);

  getFeedbackDb()
    .prepare(
      `UPDATE style_profiles SET ${fields.join(", ")}
       WHERE id = ? AND owner_id = ?`
    )
    .run(...params);

  return getStyleProfile(ownerId, id);
}

export function deleteStyleProfile(ownerId: string, id: string): boolean {
  const result = getFeedbackDb()
    .prepare("DELETE FROM style_profiles WHERE id = ? AND owner_id = ?")
    .run(id, ownerId);
  return result.changes > 0;
}