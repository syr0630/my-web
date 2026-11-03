import type { Intensity, PolishStandard, TranslationStyle } from "@/types";

/** Visible character limit for non-academic writing tools. */
export const MAX_VISIBLE_CHARS = 2000;

/** Academic manuscripts are section-sized; keep the model output within budget. */
export const ACADEMIC_MAX_CHARS = 8000;
export const ACADEMIC_MAX_FILE_BYTES = 6 * 1024 * 1024;
export const ACADEMIC_MODES = ["polish", "review", "abstract"] as const;

/** Hard cap for JSON request bodies (bytes). */
export const MAX_BODY_BYTES = 64 * 1024;

export const POLISH_STANDARDS: PolishStandard[] = [
  "standard",
  "fluent",
  "humanize",
  "formal",
  "academic",
  "simple",
  "creative",
  "expand",
  "shorten",
];

export const INTENSITIES: Intensity[] = ["light", "moderate", "strong"];

export const WRITING_SCENES = [
  "general",
  "email",
  "essay",
  "report",
  "social",
  "speech",
] as const;

export type WritingScene = (typeof WRITING_SCENES)[number];

export const TRANSLATION_STYLES: TranslationStyle[] = [
  "natural",
  "formal",
  "academic",
];

/** Rate limit: requests per window, per client key. */
export const RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Token budget per polish standard. */
export function polishMaxTokens(standard: PolishStandard): number {
  if (standard === "expand") return 4800;
  if (standard === "shorten" || standard === "simple") return 2000;
  return 3200;
}

export function polishTemperature(standard: PolishStandard): number {
  switch (standard) {
    case "creative":
      return 0.8;
    case "humanize":
      return 0.7;
    case "academic":
      return 0.2;
    case "formal":
      return 0.3;
    case "expand":
      return 0.5;
    default:
      return 0.35;
  }
}

export function humanizeTemperature(intensity: Intensity): number {
  if (intensity === "strong") return 0.7;
  if (intensity === "light") return 0.45;
  return 0.6;
}