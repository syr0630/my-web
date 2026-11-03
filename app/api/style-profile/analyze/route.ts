import { chatCompletion, parseJsonObject } from "@/lib/ai/client";
import {
  styleAnalysisSystemPrompt,
  styleAnalysisUserPayload,
} from "@/lib/ai/prompts-style";
import { readJsonObject } from "@/lib/ai/validate";
import { AppError, errorResponse, jsonHeaders, makeRequestId } from "@/lib/errors";
import { assertRateLimit, getClientKey } from "@/lib/rate-limit";
import {
  assertStyleSamples,
  normalizeStyleAnalysis,
} from "@/lib/style-profile/validate";
import type { StyleAnalysis } from "@/types";

export const runtime = "nodejs";

const STYLE_BODY_LIMIT = 320 * 1024;

export async function POST(request: Request) {
  const request_id = makeRequestId();

  try {
    assertRateLimit(getClientKey(request));
    const body = await readJsonObject(request, STYLE_BODY_LIMIT);
    const samples = assertStyleSamples(body.samples);

    let analysis: StyleAnalysis | null = null;
    let model = "";
    let lastError: unknown = null;
    const retryable = [
      "AI_EMPTY_RESPONSE",
      "AI_INVALID_STRUCTURE",
      "AI_INVALID_RESPONSE",
      "INVALID_STYLE_ANALYSIS",
    ];

    for (let attempt = 0; attempt < 2 && !analysis; attempt += 1) {
      try {
        const { text: raw, model: usedModel } = await chatCompletion(
          [
            { role: "system", content: styleAnalysisSystemPrompt() },
            { role: "user", content: styleAnalysisUserPayload(samples) },
          ],
          { temperature: attempt === 0 ? 0.2 : 0.1, maxTokens: 3200 }
        );
        model = usedModel;
        analysis = normalizeStyleAnalysis(parseJsonObject(raw));
      } catch (error) {
        lastError = error;
        if (
          attempt === 1 ||
          !(error instanceof AppError) ||
          !retryable.includes(error.error_code)
        ) {
          throw error;
        }
      }
    }

    if (!analysis) {
      throw lastError instanceof Error
        ? lastError
        : new AppError({
            message: "AI 未返回有效的风格分析，请重试。",
            error_code: "AI_EMPTY_RESPONSE",
            retryable: true,
            status: 502,
          });
    }

    return Response.json(
      { request_id, analysis, model },
      { headers: jsonHeaders(request_id) }
    );
  } catch (error) {
    return errorResponse(error, request_id);
  }
}