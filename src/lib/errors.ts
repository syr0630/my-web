import { randomUUID } from "crypto";
import type { ApiErrorBody } from "@/types";

export class AppError extends Error {
  readonly error_code: string;
  readonly retryable: boolean;
  readonly status: number;
  readonly request_id: string;

  constructor(opts: {
    message: string;
    error_code: string;
    retryable?: boolean;
    status?: number;
    request_id?: string;
  }) {
    super(opts.message);
    this.name = "AppError";
    this.error_code = opts.error_code;
    this.retryable = opts.retryable ?? false;
    this.status = opts.status ?? 400;
    this.request_id = opts.request_id ?? randomUUID();
  }

  toJSON(): ApiErrorBody {
    return {
      request_id: this.request_id,
      error_code: this.error_code,
      message: this.message,
      retryable: this.retryable,
    };
  }
}

export function makeRequestId(): string {
  return randomUUID();
}

export function jsonHeaders(requestId?: string): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    ...(requestId ? { "x-request-id": requestId } : {}),
  };
}

/**
 * Unified error envelope. Logs only the error code and request id — never user
 * text, so ordinary logs do not contain full documents.
 */
export function errorResponse(error: unknown, fallbackRequestId?: string) {
  if (error instanceof AppError) {
    if (error.status >= 500) {
      console.error(
        `[draftly] ${error.error_code} request_id=${error.request_id}`
      );
    }
    return Response.json(error.toJSON(), {
      status: error.status,
      headers: jsonHeaders(error.request_id),
    });
  }

  const request_id = fallbackRequestId ?? makeRequestId();
  console.error(`[draftly] INTERNAL_ERROR request_id=${request_id}`);
  const body: ApiErrorBody = {
    request_id,
    error_code: "INTERNAL_ERROR",
    message: "服务暂时不可用，请稍后重试。",
    retryable: true,
  };
  return Response.json(body, {
    status: 500,
    headers: jsonHeaders(request_id),
  });
}

export function notEnabledResponse(feature: string): Response {
  const request_id = makeRequestId();
  const body: ApiErrorBody = {
    request_id,
    error_code: "FEATURE_NOT_ENABLED",
    message: `${feature}尚未启用。Draftly 不会用假数据模拟该功能。`,
    retryable: false,
  };
  return Response.json(body, {
    status: 501,
    headers: jsonHeaders(request_id),
  });
}