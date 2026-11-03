import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  createAdminSessionToken,
  verifyAdminPassword,
} from "@/lib/admin/auth";
import { readJsonObject } from "@/lib/ai/validate";
import { errorResponse, makeRequestId } from "@/lib/errors";
import { assertRateLimit, getClientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = makeRequestId();

  try {
    assertRateLimit(`admin-login:${getClientKey(request)}`, 5, 60_000);
    const body = await readJsonObject(request);
    verifyAdminPassword(body.password);

    const response = NextResponse.json(
      { ok: true, request_id: requestId },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "x-request-id": requestId,
        },
      }
    );
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: createAdminSessionToken(),
      ...adminCookieOptions(),
    });
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}