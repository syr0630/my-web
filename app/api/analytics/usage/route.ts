import {
  isAnalyticsFeature,
  recordAnalyticsEvent,
  type AnalyticsStatus,
} from "@/lib/analytics/db";
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
    if (!isAnalyticsFeature(body.feature)) {
      return new Response(null, { status: 204 });
    }
    const status: AnalyticsStatus =
      body.status === "error" ? "error" : "success";
    recordAnalyticsEvent({
      eventType: "feature_run",
      feature: body.feature,
      status,
      visitorId: visitorId(body.visitorId),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}