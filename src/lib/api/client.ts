import type { ApiErrorBody } from "@/types";
import { recordFeatureUsage } from "@/lib/analytics/client";

export class ApiClientError extends Error {
  readonly body: ApiErrorBody;
  readonly status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiClientError";
    this.status = status;
    this.body = body;
  }
}

export type ApiRequestOptions = {
  signal?: AbortSignal;
};

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toErrorBody(data: unknown, status: number): ApiErrorBody {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.message === "string") {
      return {
        request_id:
          typeof record.request_id === "string" ? record.request_id : "unknown",
        error_code:
          typeof record.error_code === "string" ? record.error_code : "UNKNOWN",
        message: record.message,
        retryable: Boolean(record.retryable),
      };
    }
  }
  return {
    request_id: "unknown",
    error_code: "NETWORK_ERROR",
    message:
      status === 0
        ? "网络请求失败，请检查连接后重试。"
        : "请求失败，请稍后重试。",
    retryable: true,
  };
}

async function request<T>(
  path: string,
  init: RequestInit,
  options?: ApiRequestOptions
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, signal: options?.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    recordFeatureUsage(path, "error");
    throw new ApiClientError(0, {
      request_id: "unknown",
      error_code: "NETWORK_ERROR",
      message: "网络请求失败，请检查连接后重试。",
      retryable: true,
    });
  }

  const data = await parseBody(response);

  if (!response.ok) {
    recordFeatureUsage(path, "error");
    throw new ApiClientError(response.status, toErrorBody(data, response.status));
  }

  if (data === null) {
    recordFeatureUsage(path, "error");
    throw new ApiClientError(502, {
      request_id: "unknown",
      error_code: "AI_INVALID_RESPONSE",
      message: "服务端返回了空响应，请重试。",
      retryable: true,
    });
  }

  recordFeatureUsage(path, "success");
  return data as T;
}

export function apiPost<T>(
  path: string,
  body: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  return request<T>(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    options
  );
}

export function apiGet<T>(
  path: string,
  options?: ApiRequestOptions
): Promise<T> {
  return request<T>(path, { method: "GET", cache: "no-store" }, options);
}

export function apiPatch<T>(
  path: string,
  body: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  return request<T>(
    path,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    options
  );
}

export function apiDelete<T>(
  path: string,
  options?: ApiRequestOptions
): Promise<T> {
  return request<T>(path, { method: "DELETE" }, options);
}

export function apiUpload<T>(
  path: string,
  form: FormData,
  options?: ApiRequestOptions
): Promise<T> {
  return request<T>(path, { method: "POST", body: form }, options);
}