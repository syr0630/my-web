import { chatCompletion, parseJsonObject } from "@/lib/ai/client";
import {
  styleApplySystemPrompt,
  styleApplyUserPayload,
} from "@/lib/ai/prompts-style";
import {
  assertMaxTextLength,
  assertNonEmptyText,
  assertPolishStandard,
  assertSourceVersion,
  readJsonObject,
} from "@/lib/ai/validate";
import { AppError, errorResponse, jsonHeaders, makeRequestId } from "@/lib/errors";
import { assertRateLimit, getClientKey } from "@/lib/rate-limit";
import { normalizeStyleApply } from "@/lib/style-profile/consistency";
import { getStyleProfile } from "@/lib/style-profile/db";
import { getStyleOwner } from "@/lib/style-profile/owner";
import { assertStyleProfileId } from "@/lib/style-profile/validate";
import type {
  StyleApplyResponse,
  StyleConsistencyDimensionKey,
  StyleDifference,
} from "@/types";

export const runtime = "nodejs";

const DIFFERENCE_TYPES: StyleConsistencyDimensionKey[] = [
  "tone",
  "wording",
  "sentence",
  "expression",
  "rhetoric",
];

function readDifferences(value: unknown): StyleDifference[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object" && !Array.isArray(item))
    )
    .slice(0, 8)
    .map((item, index) => {
      const type = DIFFERENCE_TYPES.includes(
        item.type as StyleConsistencyDimensionKey
      )
        ? (item.type as StyleConsistencyDimensionKey)
        : "expression";
      return {
        id: `d-${index + 1}`,
        type,
        start: 0,
        end: 0,
        quote:
          typeof item.quote === "string" ? item.quote.trim().slice(0, 400) : "",
        reason:
          typeof item.reason === "string" ? item.reason.trim().slice(0, 500) : "",
        suggestion:
          typeof item.suggestion === "string"
            ? item.suggestion.trim().slice(0, 2000)
            : "",
      };
    })
    .filter((item) => item.quote && item.suggestion);
}

function readSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((item) => item.slice(0, 500));
}

export async function POST(request: Request) {
  const request_id = makeRequestId();

  try {
    assertRateLimit(getClientKey(request));
    const body = await readJsonObject(request);
    const currentText = assertNonEmptyText(body.currentText, "当前润色稿");
    assertMaxTextLength(currentText, 6000, "当前润色稿");
    const standard = assertPolishStandard(body.standard);
    const sourceVersion = assertSourceVersion(body.sourceVersion);
    const styleProfileId = assertStyleProfileId(body.styleProfileId);
    const differences = readDifferences(body.differences);
    const suggestions = readSuggestions(body.suggestions);

    const owner = getStyleOwner(request);
    const profile = getStyleProfile(owner.ownerId, styleProfileId);
    if (!profile) {
      throw new AppError({
        message: "所选风格画像不存在，或已被删除。请重新选择。",
        error_code: "STYLE_PROFILE_NOT_FOUND",
        status: 404,
      });
    }

    let applied: Pick<StyleApplyResponse, "text" | "appliedChanges"> | null = null;
    let model = "";
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2 && !applied; attempt += 1) {
      try {
        const { text: raw, model: usedModel } = await chatCompletion(
          [
            {
              role: "system",
              content: styleApplySystemPrompt(standard, profile.analysis),
            },
            {
              role: "user",
              content: styleApplyUserPayload({
                currentText,
                differences,
                suggestions,
              }),
            },
          ],
          { temperature: 0.2, maxTokens: 3200 }
        );
        model = usedModel;
        applied = normalizeStyleApply(parseJsonObject(raw), currentText);
        if (applied.text.length > 6000) {
          throw new AppError({
            message: "二次调整结果超过长度限制，请缩短文本后重试。",
            error_code: "TEXT_TOO_LONG",
            status: 502,
          });
        }
      } catch (error) {
        lastError = error;
        if (
          !(error instanceof AppError) ||
          !["AI_EMPTY_RESPONSE", "AI_INVALID_STRUCTURE", "AI_INVALID_RESPONSE"].includes(
            error.error_code
          )
        ) {
          throw error;
        }
      }
    }

    if (!applied) {
      throw lastError instanceof Error
        ? lastError
        : new AppError({
            message: "AI 未返回有效的二次调整结果，请重试。",
            error_code: "AI_EMPTY_RESPONSE",
            retryable: true,
            status: 502,
          });
    }

    return Response.json(
      { request_id, ...applied, sourceVersion, model },
      { headers: jsonHeaders(request_id) }
    );
  } catch (error) {
    return errorResponse(error, request_id);
  }
}