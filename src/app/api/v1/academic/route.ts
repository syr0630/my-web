import { chatCompletion } from "@/lib/ai/client";
import {
  academicMaxTokens,
  academicSystemPrompt,
  academicUserPrompt,
} from "@/lib/ai/prompts-academic";
import {
  assertMaxTextLength,
  assertNonEmptyText,
  readJsonObject,
} from "@/lib/ai/validate";
import { ACADEMIC_MAX_CHARS, ACADEMIC_MODES } from "@/lib/constants";
import { AppError, errorResponse, jsonHeaders, makeRequestId } from "@/lib/errors";
import { assertRateLimit, getClientKey } from "@/lib/rate-limit";
import { countVisibleChars } from "@/lib/text/char-count";
import type { AcademicMode, AcademicResponse } from "@/types";

export const runtime = "nodejs";

function assertAcademicMode(value: unknown): AcademicMode {
  if (
    typeof value !== "string" ||
    !ACADEMIC_MODES.includes(value as AcademicMode)
  ) {
    throw new AppError({
      message: "无效的学术处理方式。",
      error_code: "INVALID_ACADEMIC_MODE",
      status: 400,
    });
  }
  return value as AcademicMode;
}

export async function POST(request: Request) {
  const request_id = makeRequestId();

  try {
    assertRateLimit(getClientKey(request));

    const body = await readJsonObject(request);
    const text = assertNonEmptyText(body.text, "论文文本");
    assertMaxTextLength(text, ACADEMIC_MAX_CHARS, "论文文本");
    const mode = assertAcademicMode(body.mode);

    const { text: result, model } = await chatCompletion(
      [
        { role: "system", content: academicSystemPrompt() },
        { role: "user", content: academicUserPrompt(mode, text) },
      ],
      {
        temperature: mode === "review" ? 0.2 : 0.28,
        maxTokens: academicMaxTokens(mode),
        // Keep the completion budget for the rewritten manuscript. On reasoning
        // models, hidden reasoning can otherwise exhaust max_tokens and produce
        // "AI 未返回有效文本内容" even though the request succeeded.
        reasoningEffort: "none",
      }
    );

    const payload: AcademicResponse = {
      request_id,
      text: result,
      mode,
      model,
      inputChars: countVisibleChars(text),
    };

    return Response.json(payload, { headers: jsonHeaders(request_id) });
  } catch (error) {
    return errorResponse(error, request_id);
  }
}