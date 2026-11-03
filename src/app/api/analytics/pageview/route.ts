import { recordAnalyticsEvent } from "@/lib/analytics/db";
import { readJsonObject } from "@/lib/ai/validate";
import { errorResponse, makeRequestId } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function visitorId(value: unknown): string {
  return typeof value === "string" && value.length >= 8 && value.length <= 96
    ? value
    : "anonymous";
}

export async function POST(request: Request) {
  const requestId = makeRequestId();
  try {
    const body = await readJsonObject(request, 4096);
    const path =
      typeof body.path === "string" ? body.path.trim().slice(0, 240) : "";
    if (!path.startsWith("/") || path.startsWith("/admin")) {
      return new Response(null, { status: 204 });
    }
    recordAnalyticsEvent({
      eventType: "page_view",
      path,
      visitorId: visitorId(body.visitorId),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}