import {
  INTENSITIES,
  MAX_BODY_BYTES,
  MAX_VISIBLE_CHARS,
  POLISH_STANDARDS,
  TRANSLATION_STYLES,
  WRITING_SCENES,
} from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { countVisibleChars } from "@/lib/text/char-count";
import type {
  ContentLanguage,
  Intensity,
  PolishStandard,
  TranslationSource,
  TranslationStyle,
  TranslationTarget,
} from "@/types";

const CONTENT_LANGUAGES: ContentLanguage[] = [
  "auto",
  "zh-CN",
  "en",
  "mixed",
];

export async function readJsonObject(
  request: Request,
  maxBytes = MAX_BODY_BYTES
): Promise<Record<string, unknown>> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxBytes) {
    throw new AppError({
      message: "请求体过大。",
      error_code: "PAYLOAD_TOO_LARGE",
      status: 413,
    });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    throw new AppError({
      message: "无法读取请求内容，请重试。",
      error_code: "INVALID_BODY",
      retryable: true,
      status: 400,
    });
  }

  if (raw.length > maxBytes) {
    throw new AppError({
      message: "请求体过大。",
      error_code: "PAYLOAD_TOO_LARGE",
      status: 413,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError({
      message: "请求格式无效：需要 JSON 对象。",
      error_code: "INVALID_JSON",
      status: 400,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError({
      message: "请求格式无效：需要 JSON 对象。",
      error_code: "INVALID_BODY",
      status: 400,
    });
  }

  return parsed as Record<string, unknown>;
}

export function assertNonEmptyText(text: unknown, field = "文本"): string {
  if (typeof text !== "string") {
    throw new AppError({
      message: `${field}必须是字符串。`,
      error_code: "INVALID_TEXT",
      status: 400,
    });
  }
  if (!text.trim()) {
    throw new AppError({
      message: "请先输入文本。",
      error_code: "EMPTY_TEXT",
      status: 400,
    });
  }
  return text;
}

export function assertTextLength(text: string, field = "文本"): void {
  const count = countVisibleChars(text);
  if (count > MAX_VISIBLE_CHARS) {
    throw new AppError({
      message: `${field}超过 ${MAX_VISIBLE_CHARS} 个可见字符限制（当前 ${count}）。`,
      error_code: "TEXT_TOO_LONG",
      status: 400,
    });
  }
}

export function assertMaxTextLength(
  text: string,
  max: number,
  field = "文本"
): void {
  const count = countVisibleChars(text);
  if (count > max) {
    throw new AppError({
      message: `${field}超过 ${max} 个可见字符限制（当前 ${count}）。`,
      error_code: "TEXT_TOO_LONG",
      status: 400,
    });
  }
}

export function assertPolishStandard(value: unknown): PolishStandard {
  if (
    typeof value !== "string" ||
    !POLISH_STANDARDS.includes(value as PolishStandard)
  ) {
    throw new AppError({
      message: "无效的润色标准。",
      error_code: "INVALID_STANDARD",
      status: 400,
    });
  }
  return value as PolishStandard;
}

export function assertIntensity(value: unknown): Intensity {
  if (
    typeof value !== "string" ||
    !INTENSITIES.includes(value as Intensity)
  ) {
    throw new AppError({
      message: "无效的修改强度。",
      error_code: "INVALID_INTENSITY",
      status: 400,
    });
  }
  return value as Intensity;
}

export function assertContentLanguage(value: unknown): ContentLanguage {
  if (
    typeof value !== "string" ||
    !CONTENT_LANGUAGES.includes(value as ContentLanguage)
  ) {
    throw new AppError({
      message: "无效的文本语言设置。",
      error_code: "INVALID_LANGUAGE",
      status: 400,
    });
  }
  return value as ContentLanguage;
}

export function assertSourceVersion(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError({
      message: "缺少 sourceVersion，请刷新页面后重试。",
      error_code: "INVALID_SOURCE_VERSION",
      status: 400,
    });
  }
  if (value.length > 128) {
    throw new AppError({
      message: "sourceVersion 过长。",
      error_code: "INVALID_SOURCE_VERSION",
      status: 400,
    });
  }
  return value;
}

export function assertOptionalScene(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (
    typeof value !== "string" ||
    !(WRITING_SCENES as readonly string[]).includes(value)
  ) {
    throw new AppError({
      message: "无效的写作场景。",
      error_code: "INVALID_SCENE",
      status: 400,
    });
  }
  return value;
}

export function assertTranslationStyle(value: unknown): TranslationStyle {
  if (
    typeof value !== "string" ||
    !TRANSLATION_STYLES.includes(value as TranslationStyle)
  ) {
    throw new AppError({
      message: "无效的翻译风格。",
      error_code: "INVALID_TRANSLATION_STYLE",
      status: 400,
    });
  }
  return value as TranslationStyle;
}

export function assertTranslationSource(value: unknown): TranslationSource {
  if (value !== "auto" && value !== "zh-CN" && value !== "en") {
    throw new AppError({
      message: "无效的源语言。",
      error_code: "INVALID_LANGUAGE",
      status: 400,
    });
  }
  return value;
}

export function assertTranslationTarget(value: unknown): TranslationTarget {
  if (value !== "zh-CN" && value !== "en") {
    throw new AppError({
      message: "无效的目标语言。",
      error_code: "INVALID_LANGUAGE",
      status: 400,
    });
  }
  return value;
}

/** Short text used by interactive suggestions; rejects oversized payloads. */
export function assertShortText(
  value: unknown,
  field: string,
  max: number
): string {
  if (typeof value !== "string") {
    throw new AppError({
      message: `${field}格式无效。`,
      error_code: "INVALID_TEXT",
      status: 400,
    });
  }
  if (countVisibleChars(value) > max) {
    throw new AppError({
      message: `${field}过长。`,
      error_code: "TEXT_TOO_LONG",
      status: 400,
    });
  }
  return value;
}