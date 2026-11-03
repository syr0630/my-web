import { AppError } from "@/lib/errors";
import type {
  StyleApplyResponse,
  StyleConsistencyDimension,
  StyleConsistencyDimensionKey,
  StyleConsistencyResponse,
  StyleDifference,
  StyleRating,
} from "@/types";

const DIMENSION_KEYS: StyleConsistencyDimensionKey[] = [
  "tone",
  "wording",
  "sentence",
  "expression",
  "rhetoric",
];
const RATINGS: StyleRating[] = ["high", "medium", "low"];
const DIFFERENCE_TYPES = DIMENSION_KEYS;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function invalid(message: string): never {
  throw new AppError({
    message,
    error_code: "AI_INVALID_STRUCTURE",
    retryable: true,
    status: 502,
  });
}

export function normalizeStyleConsistency(
  value: unknown,
  currentText: string
): Pick<
  StyleConsistencyResponse,
  "overall" | "summary" | "dimensions" | "differences" | "limitations"
> {
  const record = objectValue(value);
  if (!record) invalid("AI 返回的风格匹配结果格式无效，请重试。");

  const overall = RATINGS.includes(record.overall as StyleRating)
    ? (record.overall as StyleRating)
    : "low";
  const summary = textValue(record.summary);
  if (!summary) invalid("AI 返回的风格匹配结果缺少总体评价，请重试。");

  const dimensionsRaw = Array.isArray(record.dimensions)
    ? record.dimensions
    : [];
  const dimensions: StyleConsistencyDimension[] = [];
  for (const key of DIMENSION_KEYS) {
    const item = dimensionsRaw
      .map((entry) => objectValue(entry))
      .find((entry) => entry?.key === key);
    if (!item) invalid("AI 返回的风格匹配结果缺少维度，请重试。");
    const rating = RATINGS.includes(item.rating as StyleRating)
      ? (item.rating as StyleRating)
      : "medium";
    const explanation = textValue(item.explanation);
    if (!explanation) invalid("AI 返回的风格匹配维度缺少解释，请重试。");
    dimensions.push({
      key,
      rating,
      explanation: explanation.slice(0, 500),
    });
  }

  const rawDifferences = Array.isArray(record.differences)
    ? record.differences
    : [];
  const differences: StyleDifference[] = [];
  const occupied: { start: number; end: number }[] = [];

  for (const raw of rawDifferences) {
    if (differences.length >= 8) break;
    const item = objectValue(raw);
    if (!item) continue;
    const quote = textValue(item.quote).slice(0, 400);
    if (!quote) continue;

    let start =
      typeof item.start === "number" && Number.isFinite(item.start)
        ? Math.max(0, Math.floor(item.start))
        : -1;
    let end =
      typeof item.end === "number" && Number.isFinite(item.end)
        ? Math.max(0, Math.floor(item.end))
        : -1;

    if (
      start < 0 ||
      end <= start ||
      end > currentText.length ||
      currentText.slice(start, end) !== quote
    ) {
      start = currentText.indexOf(quote);
      if (start === -1) continue;
      end = start + quote.length;
    }

    if (occupied.some((range) => start < range.end && end > range.start)) {
      continue;
    }
    occupied.push({ start, end });

    const type = DIFFERENCE_TYPES.includes(
      item.type as StyleConsistencyDimensionKey
    )
      ? (item.type as StyleConsistencyDimensionKey)
      : "expression";
    const reason = textValue(item.reason).slice(0, 500);
    const suggestion = textValue(item.suggestion).slice(0, 2000);
    if (!reason || !suggestion || suggestion === quote) continue;

    differences.push({
      id: `d-${differences.length + 1}`,
      type,
      start,
      end,
      quote,
      reason,
      suggestion,
    });
  }

  return {
    overall,
    summary: summary.slice(0, 800),
    dimensions,
    differences,
    limitations: textValue(record.limitations).slice(0, 800),
  };
}

function numericTokens(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).sort();
}

/**
 * A style-only rewrite must not alter figures. This is a narrow safety check,
 * not a claim that every fact is preserved.
 */
export function numbersPreserved(before: string, after: string): boolean {
  const left = numericTokens(before);
  const right = numericTokens(after);
  if (left.length !== right.length) return false;
  return left.every((token, index) => token === right[index]);
}

export function normalizeStyleApply(
  value: unknown,
  currentText: string
): Pick<StyleApplyResponse, "text" | "appliedChanges"> {
  const record = objectValue(value);
  if (!record) invalid("AI 返回的二次调整结果格式无效，请重试。");

  const text = textValue(record.text);
  if (!text) invalid("AI 没有返回二次调整后的文本，请重试。");
  if (!numbersPreserved(currentText, text)) {
    throw new AppError({
      message:
        "二次调整可能改动了原文数字，Draftly 已拒绝应用。请重试或手动处理。",
      error_code: "STYLE_APPLY_UNSAFE",
      retryable: true,
      status: 502,
    });
  }

  const appliedChanges = Array.isArray(record.appliedChanges)
    ? record.appliedChanges
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8)
        .map((item) => item.slice(0, 300))
    : [];

  return { text, appliedChanges };
}