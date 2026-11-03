import { isAiConfigured, getConfiguredModel } from "@/lib/ai/client";
import { jsonHeaders, makeRequestId } from "@/lib/errors";
import type { HealthResponse } from "@/types";

export const runtime = "nodejs";

/**
 * Read-only service status for the settings page. Exposes only whether the
 * server has an AI key and which model is configured — never the key or URL.
 */
export async function GET() {
  const request_id = makeRequestId();
  const payload: HealthResponse = {
    ok: true,
    aiConfigured: isAiConfigured(),
    model: getConfiguredModel(),
  };

  return Response.json(payload, { headers: jsonHeaders(request_id) });
}