import { ApiClientError } from "@/lib/api/client";
import type { Messages } from "@/lib/i18n/messages";

export type DisplayError = {
  message: string;
  code?: string;
  requestId?: string;
  retryable?: boolean;
};

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export function toDisplayError(
  error: unknown,
  t: Messages,
  fallback: string
): DisplayError {
  if (error instanceof ApiClientError) {
    const key = error.body.error_code as keyof Messages["errors"];
    const localized = t.errors[key];
    return {
      message: localized ?? error.body.message,
      code: error.body.error_code,
      requestId: error.body.request_id,
      retryable: error.body.retryable,
    };
  }

  return { message: fallback, retryable: true };
}