import { requireAdminSession } from "@/lib/admin/auth";
import { getAnalyticsSummary } from "@/lib/analytics/db";
import { errorResponse, jsonHeaders, makeRequestId } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = makeRequestId();
  try {
    await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days") ?? "14");
    const summary = getAnalyticsSummary(Number.isFinite(days) ? days : 14);
    return Response.json(summary, { headers: jsonHeaders(requestId) });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}