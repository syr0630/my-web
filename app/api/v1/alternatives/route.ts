import { chatCompletion, parseJsonStringArray } from "@/lib/ai/client";
import { alternativesSystemPrompt } from "@/lib/ai/prompts";
import {
  assertContentLanguage,
  assertNonEmptyText,
  assertTextLength,
  readJsonObject,
} from "@/lib/ai/validate";
import { errorResponse, jsonHeaders, makeRequestId } from "@/lib/errors";
import { resolveContentLanguage } from "@/lib/language/detect";
import { assertRateLimit, getClientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const request_id = makeRequestId();

  try {
    assertRateLimit(getClientKey(request));

    const body = await readJsonObject(request);
    const originalSentence = assertNonEmptyText(
      body.originalSentence,
      "原句"
    );
    const currentSentence = assertNonEmptyText(body.currentSentence, "当前句");
    assertTextLength(originalSentence, "原句");
    assertTextLength(currentSentence, "当前句");

    const contentLanguage = assertContentLanguage(body.contentLanguage);
    const context =
      typeof body.context === "string" ? body.context.slice(0, 300) : "";

    const lang = resolveContentLanguage(
      `${originalSentence}\n${currentSentence}`,
      contentLanguage
    );

    const { text, model } = await chatCompletion(
      [
        { role: "system", content: alternativesSystemPrompt(lang) },
        {
          role: "user",
          content: [
            "Original:",
            originalSentence,
            "",
            "Current:",
            currentSentence,
            context ? `\nContext:\n${context}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      { temperature: 0.85, maxTokens: 700 }
    );

    const alternatives = parseJsonStringArray(text);

    return Response.json(
      {
        request_id,
        alternatives,
        detectedLanguage: lang,
        model,
      },
      { headers: jsonHeaders(request_id) }
    );
  } catch (error) {
    return errorResponse(error, request_id);
  }
}