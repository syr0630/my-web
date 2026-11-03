import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors";
import { countVisibleChars } from "@/lib/text/char-count";
import type {
  StyleAnalysis,
  StyleDimensionKey,
  StyleRating,
  StyleSample,
  StyleSampleSource,
} from "@/types";

export const STYLE_DIMENSION_KEYS: StyleDimensionKey[] = [
  "tone",
  "wording",
  "sentence",
  "expression",
  "paragraph",
  "rhetoric",
];

export const MAX_STYLE_SAMPLES = 8;
export const MAX_STYLE_SAMPLE_CHARS = 12_000;
export const MAX_STYLE_TOTAL_CHARS = 40_000;
export const MAX_STYLE_PROFILES = 20;
const STYLE_SOURCES: StyleSampleSource[] = ["paste", "txt", "docx", "pdf"];
const RATINGS: StyleRating[] = ["high", "medium", "low"];

function bad(message: string, error_code: string, status = 400): never {
  throw new AppError({ message, error_code, status });
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown, max: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((item) => item.slice(0, maxLength));
}

export function assertStyleProfileName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) {
    bad("请为风格画像填写名称。", "STYLE_PROFILE_NAME_REQUIRED");
  }
  if (name.length > 60) {
    bad("风格画像名称不能超过 60 个字符。", "STYLE_PROFILE_NAME_TOO_LONG");
  }
  return name;
}

export function assertStyleProfileId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    bad("风格画像 ID 无效。", "STYLE_PROFILE_NOT_FOUND", 404);
  }
  return value;
}

export function assertStyleSamples(value: unknown): StyleSample[] {
  if (!Array.isArray(value) || value.length === 0) {
    bad("请至少导入一份风格样本。", "STYLE_SAMPLES_REQUIRED");
  }
  if (value.length > MAX_STYLE_SAMPLES) {
    bad(
      `最多导入 ${MAX_STYLE_SAMPLES} 份样本，请先删除部分样本。`,
      "STYLE_SAMPLE_LIMIT"
    );
  }

  let total = 0;
  const samples: StyleSample[] = [];
  value.forEach((raw, index) => {
    const record = objectValue(raw);
    if (!record) {
      bad(`第 ${index + 1} 份样本格式无效。`, "STYLE_SAMPLE_INVALID");
    }
    const text = textValue(record.text);
    const chars = countVisibleChars(text);
    if (chars === 0) {
      bad(`第 ${index + 1} 份样本没有可用文本。`, "STYLE_SAMPLE_INVALID");
    }
    if (chars > MAX_STYLE_SAMPLE_CHARS) {
      bad(
        `第 ${index + 1} 份样本有 ${chars} 个可见字符，超过单份 ${MAX_STYLE_SAMPLE_CHARS} 字上限。`,
        "STYLE_SAMPLE_TOO_LONG"
      );
    }
    total += chars;
    if (total > MAX_STYLE_TOTAL_CHARS) {
      bad(
        `样本合计超过 ${MAX_STYLE_TOTAL_CHARS} 个可见字符，请删除或缩短部分样本。`,
        "STYLE_SAMPLE_TOO_LONG"
      );
    }

    const sourceType = STYLE_SOURCES.includes(
      record.sourceType as StyleSampleSource
    )
      ? (record.sourceType as StyleSampleSource)
      : "paste";
    const name = textValue(record.name) || `样本 ${index + 1}`;
    samples.push({
      id:
        typeof record.id === "string" && record.id.length > 0
          ? record.id.slice(0, 64)
          : randomUUID(),
      name: name.slice(0, 120),
      text,
      chars,
      sourceType,
    });
  });

  return samples;
}

/**
 * The analysis is user-editable, so it is re-validated on every save. Missing
 * dimensions are rejected instead of being silently replaced with invented
 * descriptions.
 */
export function normalizeStyleAnalysis(value: unknown): StyleAnalysis {
  const record = objectValue(value);
  if (!record) {
    bad("风格分析结果格式无效。", "INVALID_STYLE_ANALYSIS");
  }

  const summary = textValue(record.summary);
  if (!summary) {
    bad("风格分析缺少总体概述。", "INVALID_STYLE_ANALYSIS");
  }

  const dimensionsRaw = objectValue(record.dimensions);
  if (!dimensionsRaw) {
    bad("风格分析缺少维度结果。", "INVALID_STYLE_ANALYSIS");
  }

  const dimensions = {} as StyleAnalysis["dimensions"];
  for (const key of STYLE_DIMENSION_KEYS) {
    const dimension = objectValue(dimensionsRaw[key]);
    const description = textValue(dimension?.description);
    if (!description) {
      bad(`风格分析缺少“${key}”维度。`, "INVALID_STYLE_ANALYSIS");
    }
    dimensions[key] = { description: description.slice(0, 900) };
  }

  const confidence = RATINGS.includes(record.confidence as StyleRating)
    ? (record.confidence as StyleRating)
    : "low";

  return {
    summary: summary.slice(0, 900),
    dimensions,
    recommendedInstructions: stringList(
      record.recommendedInstructions,
      8,
      300
    ),
    avoid: stringList(record.avoid, 8, 300),
    confidence,
    sampleAssessment: textValue(record.sampleAssessment).slice(0, 900),
    limitations: textValue(record.limitations).slice(0, 900),
  };
}

export function assertStyleStandard(value: unknown): void {
  if (value === undefined || value === null || value === "") return;
  if (typeof value !== "string") {
    bad("润色标准无效。", "INVALID_STANDARD");
  }
}