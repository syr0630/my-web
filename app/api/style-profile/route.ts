import { errorResponse, AppError, makeRequestId } from "@/lib/errors";
import { readJsonObject } from "@/lib/ai/validate";
import {
  createStyleProfile,
  countStyleProfiles,
  listStyleProfiles,
} from "@/lib/style-profile/db";
import { getStyleOwner, styleJson } from "@/lib/style-profile/owner";
import {
  assertStyleProfileName,
  assertStyleSamples,
  MAX_STYLE_PROFILES,
  normalizeStyleAnalysis,
} from "@/lib/style-profile/validate";

export const runtime = "nodejs";

const STYLE_BODY_LIMIT = 320 * 1024;

export async function GET(request: Request) {
  const request_id = makeRequestId();
  try {
    const owner = getStyleOwner(request);
    return styleJson(
      { request_id, profiles: listStyleProfiles(owner.ownerId) },
      owner,
      200,
      request_id
    );
  } catch (error) {
    return errorResponse(error, request_id);
  }
}

export async function POST(request: Request) {
  const request_id = makeRequestId();
  try {
    const owner = getStyleOwner(request);
    if (countStyleProfiles(owner.ownerId) >= MAX_STYLE_PROFILES) {
      throw new AppError({
        message: `最多保存 ${MAX_STYLE_PROFILES} 个风格画像，请先删除不再使用的画像。`,
        error_code: "STYLE_PROFILE_LIMIT",
        status: 409,
      });
    }

    const body = await readJsonObject(request, STYLE_BODY_LIMIT);
    const name = assertStyleProfileName(body.name);
    const samples = assertStyleSamples(body.samples);
    const analysis = normalizeStyleAnalysis(body.analysis);

    const profile = createStyleProfile({
      ownerId: owner.ownerId,
      name,
      analysis,
      samples,
    });

    return styleJson({ request_id, profile }, owner, 201, request_id);
  } catch (error) {
    return errorResponse(error, request_id);
  }
}