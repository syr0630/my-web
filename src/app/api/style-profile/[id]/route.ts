import { readJsonObject } from "@/lib/ai/validate";
import { AppError, errorResponse, makeRequestId } from "@/lib/errors";
import {
  deleteStyleProfile,
  getStyleProfile,
  updateStyleProfile,
} from "@/lib/style-profile/db";
import { getStyleOwner, styleJson } from "@/lib/style-profile/owner";
import {
  assertStyleProfileId,
  assertStyleProfileName,
  assertStyleSamples,
  normalizeStyleAnalysis,
} from "@/lib/style-profile/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const STYLE_BODY_LIMIT = 320 * 1024;

function notFound(): never {
  throw new AppError({
    message: "风格画像不存在，或已被删除。",
    error_code: "STYLE_PROFILE_NOT_FOUND",
    status: 404,
  });
}

export async function GET(request: Request, context: RouteContext) {
  const request_id = makeRequestId();
  try {
    const owner = getStyleOwner(request);
    const { id } = await context.params;
    const profile = getStyleProfile(owner.ownerId, assertStyleProfileId(id));
    if (!profile) notFound();
    return styleJson({ request_id, profile }, owner, 200, request_id);
  } catch (error) {
    return errorResponse(error, request_id);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const request_id = makeRequestId();
  try {
    const owner = getStyleOwner(request);
    const { id } = await context.params;
    const profileId = assertStyleProfileId(id);
    if (!getStyleProfile(owner.ownerId, profileId)) notFound();

    const body = await readJsonObject(request, STYLE_BODY_LIMIT);
    if (
      body.name === undefined &&
      body.analysis === undefined &&
      body.samples === undefined
    ) {
      throw new AppError({
        message: "没有需要更新的字段。",
        error_code: "INVALID_PATCH",
        status: 400,
      });
    }

    const profile = updateStyleProfile(owner.ownerId, profileId, {
      ...(body.name !== undefined
        ? { name: assertStyleProfileName(body.name) }
        : {}),
      ...(body.analysis !== undefined
        ? { analysis: normalizeStyleAnalysis(body.analysis) }
        : {}),
      ...(body.samples !== undefined
        ? { samples: assertStyleSamples(body.samples) }
        : {}),
    });
    if (!profile) notFound();

    return styleJson({ request_id, profile }, owner, 200, request_id);
  } catch (error) {
    return errorResponse(error, request_id);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const request_id = makeRequestId();
  try {
    const owner = getStyleOwner(request);
    const { id } = await context.params;
    const profileId = assertStyleProfileId(id);
    if (!deleteStyleProfile(owner.ownerId, profileId)) notFound();
    return styleJson({ request_id, ok: true, id: profileId }, owner, 200, request_id);
  } catch (error) {
    return errorResponse(error, request_id);
  }
}