import type { ContentLanguage, ResolvedLanguage } from "@/types";

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const LATIN_RE = /[A-Za-z]/;

export type DetectionResult = {
  language: ResolvedLanguage;
  /** Share of the dominant script among letters, 0–1. */
  confidence: number;
  reliable: boolean;
};

/**
 * Script-ratio detection. It deliberately stays simple and explainable:
 * Chinese characters vs Latin letters, measured on the first 2000 chars.
 */
export function detectLanguageInfo(text: string): DetectionResult {
  const sample = text.slice(0, 2000);
  let cjk = 0;
  let latin = 0;
  let otherLetters = 0;

  for (const ch of Array.from(sample)) {
    if (CJK_RE.test(ch)) cjk += 1;
    else if (LATIN_RE.test(ch)) latin += 1;
    else if (/[\u3040-\u30ff\uac00-\ud7af]/.test(ch)) otherLetters += 1;
  }

  const total = cjk + latin + otherLetters;
  if (total === 0) {
    return { language: "zh-CN", confidence: 0, reliable: false };
  }

  const cjkRatio = cjk / total;
  const latinRatio = latin / total;
  const dominant = Math.max(cjkRatio, latinRatio);
  const reliable = total >= 8 && dominant >= 0.75;

  if (cjkRatio >= 0.72) {
    return { language: "zh-CN", confidence: cjkRatio, reliable };
  }
  if (latinRatio >= 0.72) {
    return { language: "en", confidence: latinRatio, reliable };
  }
  if (cjk > 0 && latin > 0) {
    return { language: "mixed", confidence: dominant, reliable: false };
  }
  return {
    language: cjk >= latin ? "zh-CN" : "en",
    confidence: dominant,
    reliable: false,
  };
}

export function detectLanguage(text: string): ResolvedLanguage {
  return detectLanguageInfo(text).language;
}

export function resolveContentLanguage(
  text: string,
  contentLanguage: ContentLanguage
): ResolvedLanguage {
  if (contentLanguage === "auto") return detectLanguage(text);
  return contentLanguage;
}

/** True when auto-detection is confident enough to run without a hint. */
export function isLanguageReliable(text: string): boolean {
  return detectLanguageInfo(text).reliable;
}

export const LANGUAGE_LABEL: Record<ResolvedLanguage, string> = {
  "zh-CN": "简体中文",
  en: "English",
  mixed: "中英混合",
};