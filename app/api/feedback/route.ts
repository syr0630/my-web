import { createFeedback } from "@/lib/feedback/db";
import { parseFeedbackInput } from "@/lib/feedback/validation";
import { readJsonObject } from "@/lib/ai/validate";
import {
  errorResponse,
  jsonHeaders,
  makeRequestId,
} from "@/lib/errors";
import { assertRateLimit, getClientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = makeRequestId();

  try {
    // Public feedback is intentionally stricter than the AI endpoints.
    assertRateLimit(`feedback:${getClientKey(request)}`, 5, 60_000);

    const body = await readJsonObject(request);
    const input = parseFeedbackInput(body);

    createFeedback(input);

    return Response.json(
      { ok: true, request_id: requestId },
      { status: 201, headers: jsonHeaders(requestId) }
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}