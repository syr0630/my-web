import { chatCompletion } from "@/lib/ai/client";
import { explainSystemPrompt } from "@/lib/ai/prompts";
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
    const revisedSentence = assertNonEmptyText(
      body.revisedSentence,
      "改写句"
    );
    assertTextLength(originalSentence, "原句");
    assertTextLength(revisedSentence, "改写句");

    const contentLanguage = assertContentLanguage(body.contentLanguage);
    const lang = resolveContentLanguage(
      `${originalSentence}\n${revisedSentence}`,
      contentLanguage
    );

    const { text, model } = await chatCompletion(
      [
        { role: "system", content: explainSystemPrompt() },
        {
          role: "user",
          content: `原句：\n${originalSentence}\n\n改写句：\n${revisedSentence}`,
        },
      ],
      { temperature: 0.2, maxTokens: 350 }
    );

    return Response.json(
      {
        request_id,
        explanation: text,
        detectedLanguage: lang,
        model,
      },
      { headers: jsonHeaders(request_id) }
    );
  } catch (error) {
    return errorResponse(error, request_id);
  }
}