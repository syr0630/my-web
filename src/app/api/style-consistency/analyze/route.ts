import { chatCompletion, parseJsonObject } from "@/lib/ai/client";
import {
  styleConsistencySystemPrompt,
  styleConsistencyUserPayload,
} from "@/lib/ai/prompts-style";
import {
  assertMaxTextLength,
  assertNonEmptyText,
  assertPolishStandard,
  readJsonObject,
} from "@/lib/ai/validate";
import { AppError, errorResponse, jsonHeaders, makeRequestId } from "@/lib/errors";
import { MAX_VISIBLE_CHARS } from "@/lib/constants";
import { assertRateLimit, getClientKey } from "@/lib/rate-limit";
import { normalizeStyleConsistency } from "@/lib/style-profile/consistency";
import { getStyleProfile } from "@/lib/style-profile/db";
import { getStyleOwner } from "@/lib/style-profile/owner";
import { assertStyleProfileId } from "@/lib/style-profile/validate";
import type { StyleConsistencyResponse } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const request_id = makeRequestId();

  try {
    assertRateLimit(getClientKey(request));
    const body = await readJsonObject(request);
    const originalText = assertNonEmptyText(body.originalText, "原始文本");
    assertMaxTextLength(originalText, MAX_VISIBLE_CHARS, "原始文本");
    const currentText = assertNonEmptyText(body.currentText, "当前润色稿");
    assertMaxTextLength(currentText, 6000, "当前润色稿");
    const standard = assertPolishStandard(body.standard);
    const styleProfileId = assertStyleProfileId(body.styleProfileId);

    const owner = getStyleOwner(request);
    const profile = getStyleProfile(owner.ownerId, styleProfileId);
    if (!profile) {
      throw new AppError({
        message: "所选风格画像不存在，或已被删除。请重新选择。",
        error_code: "STYLE_PROFILE_NOT_FOUND",
        status: 404,
      });
    }

    let result:
      | Pick<
          StyleConsistencyResponse,
          "overall" | "summary" | "dimensions" | "differences" | "limitations"
        >
      | null = null;
    let model = "";
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3 && !result; attempt += 1) {
      try {
        const { text: raw, model: usedModel } = await chatCompletion(
          [
            {
              role: "system",
              content: styleConsistencySystemPrompt(standard),
            },
            {
              role: "user",
              content: styleConsistencyUserPayload({
                originalText,
                currentText,
                profile: profile.analysis,
              }),
            },
          ],
          {
            temperature: attempt === 0 ? 0.15 : 0.1,
            maxTokens: 4500,
          }
        );
        model = usedModel;
        result = normalizeStyleConsistency(
          parseJsonObject(raw),
          currentText
        );
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

    if (!result) {
      throw lastError instanceof Error
        ? lastError
        : new AppError({
            message: "AI 未返回有效的风格匹配结果，请重试。",
            error_code: "AI_EMPTY_RESPONSE",
            retryable: true,
            status: 502,
          });
    }

    return Response.json(
      { request_id, ...result, model },
      { headers: jsonHeaders(request_id) }
    );
  } catch (error) {
    return errorResponse(error, request_id);
  }
}