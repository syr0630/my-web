import { chatCompletion } from "@/lib/ai/client";
import { humanizeSystemPrompt, userTextPayload } from "@/lib/ai/prompts";
import {
  assertContentLanguage,
  assertIntensity,
  assertNonEmptyText,
  assertSourceVersion,
  assertTextLength,
  readJsonObject,
} from "@/lib/ai/validate";
import { errorResponse, jsonHeaders, makeRequestId } from "@/lib/errors";
import { humanizeTemperature } from "@/lib/constants";
import { resolveContentLanguage } from "@/lib/language/detect";
import { assertRateLimit, getClientKey } from "@/lib/rate-limit";
import type { AiTransformResponse } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const request_id = makeRequestId();

  try {
    assertRateLimit(getClientKey(request));

    const body = await readJsonObject(request);
    const text = assertNonEmptyText(body.text);
    assertTextLength(text);

    const intensity = assertIntensity(body.intensity);
    const contentLanguage = assertContentLanguage(body.contentLanguage);
    const sourceVersion = assertSourceVersion(body.sourceVersion);

    const lang = resolveContentLanguage(text, contentLanguage);
    const { text: result, model } = await chatCompletion(
      [
        {
          role: "system",
          content: humanizeSystemPrompt(lang, intensity),
        },
        { role: "user", content: userTextPayload(text, lang) },
      ],
      {
        temperature: humanizeTemperature(intensity),
        maxTokens: 3200,
        reasoningEffort: "none",
      }
    );

    const payload: AiTransformResponse = {
      request_id,
      text: result,
      detectedLanguage: lang,
      sourceVersion,
      model,
    };

    return Response.json(payload, { headers: jsonHeaders(request_id) });
  } catch (error) {
    return errorResponse(error, request_id);
  }
}