import { chatCompletion } from "@/lib/ai/client";
import { polishSystemPrompt, userTextPayload } from "@/lib/ai/prompts";
import {
  assertContentLanguage,
  assertIntensity,
  assertNonEmptyText,
  assertOptionalScene,
  assertPolishStandard,
  assertSourceVersion,
  assertTextLength,
  readJsonObject,
} from "@/lib/ai/validate";
import { errorResponse, jsonHeaders, makeRequestId, AppError } from "@/lib/errors";
import { polishMaxTokens, polishTemperature } from "@/lib/constants";
import { resolveContentLanguage } from "@/lib/language/detect";
import { assertRateLimit, getClientKey } from "@/lib/rate-limit";
import { getStyleProfile } from "@/lib/style-profile/db";
import { getStyleOwner } from "@/lib/style-profile/owner";
import { assertStyleProfileId } from "@/lib/style-profile/validate";
import type { AiTransformResponse, StyleProfile } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const request_id = makeRequestId();

  try {
    assertRateLimit(getClientKey(request));

    const body = await readJsonObject(request);
    const text = assertNonEmptyText(body.text);
    assertTextLength(text);

    const standard = assertPolishStandard(body.standard);
    const intensity = assertIntensity(body.intensity);
    const contentLanguage = assertContentLanguage(body.contentLanguage);
    const sourceVersion = assertSourceVersion(body.sourceVersion);
    const scene = assertOptionalScene(body.scene);

    let styleProfile: StyleProfile | null = null;
    if (body.styleProfileId !== undefined && body.styleProfileId !== null) {
      const styleProfileId = assertStyleProfileId(body.styleProfileId);
      const owner = getStyleOwner(request);
      styleProfile = getStyleProfile(owner.ownerId, styleProfileId);
      if (!styleProfile) {
        throw new AppError({
          message: "所选风格画像不存在，或已被删除。请重新选择。",
          error_code: "STYLE_PROFILE_NOT_FOUND",
          retryable: false,
          status: 404,
        });
      }
    }

    const lang = resolveContentLanguage(text, contentLanguage);
    const { text: result, model } = await chatCompletion(
      [
        {
          role: "system",
          content: polishSystemPrompt(
            lang,
            standard,
            intensity,
            scene,
            styleProfile?.analysis
          ),
        },
        { role: "user", content: userTextPayload(text, lang) },
      ],
      {
        temperature: polishTemperature(standard),
        maxTokens: polishMaxTokens(standard),
        reasoningEffort: "none",
      }
    );

    const payload: AiTransformResponse = {
      request_id,
      text: result,
      detectedLanguage: lang,
      sourceVersion,
      model,
      ...(styleProfile
        ? { styleProfile: { id: styleProfile.id, name: styleProfile.name } }
        : {}),
    };

    return Response.json(payload, { headers: jsonHeaders(request_id) });
  } catch (error) {
    return errorResponse(error, request_id);
  }
}