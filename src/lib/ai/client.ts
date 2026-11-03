import { AppError } from "@/lib/errors";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 90_000;
const REASONING_HEADROOM = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry one transient upstream 5xx (for example a provider-side 502). */
async function fetchWithRetry(
  makeRequest: () => Promise<Response>
): Promise<Response> {
  let response = await makeRequest();
  for (let attempt = 1; attempt < 2 && response.status >= 500; attempt++) {
    await sleep(300);
    response = await makeRequest();
  }
  return response;
}

function normalizeBaseUrl(input: string): string {
  return input
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "");
}

export function getAiConfig(): AiConfig {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError({
      message:
        "服务端未配置 AI_API_KEY，暂时无法调用真实 AI。请在 .env.local 中设置后重启服务。",
      error_code: "AI_NOT_CONFIGURED",
      retryable: false,
      status: 503,
    });
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(process.env.AI_BASE_URL || DEFAULT_BASE_URL),
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

export function getConfiguredModel(): string | null {
  if (!isAiConfigured()) return null;
  return process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

type ProviderPayload = {
  choices?: {
    message?: {
      content?: string | { type?: string; text?: string }[];
    };
  }[];
  error?: { message?: string };
  model?: string;
};

function extractContent(payload: ProviderPayload): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("");
  }
  return "";
}

/** Remove accidental Markdown fences; never interpret the result as HTML. */
export function cleanAiText(text: string): string {
  let output = text.trim();
  output = output.replace(/^```[A-Za-z0-9_-]*\s*\n?/, "");
  output = output.replace(/\n?```\s*$/, "");
  return output.trim();
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: {
    temperature?: number;
    maxTokens?: number;
    /**
     * Academic rewrites need the full completion budget for the visible text.
     * Without this, a reasoning model can spend max_tokens on hidden reasoning
     * and return an empty or truncated answer.
     */
    reasoningEffort?: "none" | "low" | "medium" | "high";
  }
): Promise<{ text: string; model: string }> {
  const config = getAiConfig();

  let response: Response;
  try {
    response = await fetchWithRetry(() =>
      fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: opts?.temperature ?? 0.35,
          // DeepSeek may spend part of the completion budget on reasoning_content;
          // keep headroom so the visible answer is not truncated to empty.
          max_tokens:
            (opts?.maxTokens ?? 1600) + REASONING_HEADROOM,
          ...(opts?.reasoningEffort
            ? { reasoning_effort: opts.reasoningEffort }
            : {}),
          stream: false,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    );
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new AppError({
      message: aborted
        ? "AI 服务响应超时，请稍后重试。"
        : "无法连接 AI 服务，请检查网络或服务地址后重试。",
      error_code: aborted ? "AI_TIMEOUT" : "AI_NETWORK_ERROR",
      retryable: true,
      status: 504,
    });
  }

  const raw = await response.text();
  let data: ProviderPayload;

  try {
    data = JSON.parse(raw) as ProviderPayload;
  } catch {
    throw new AppError({
      message: "AI 服务返回了无法解析的响应。",
      error_code: "AI_INVALID_RESPONSE",
      retryable: true,
      status: 502,
    });
  }

  if (!response.ok) {
    const detail = data.error?.message || `HTTP ${response.status}`;
    throw new AppError({
      message: `AI 服务调用失败：${detail}`,
      error_code: "AI_PROVIDER_ERROR",
      retryable: response.status >= 500 || response.status === 429,
      status: response.status === 429 ? 429 : 502,
    });
  }

  const text = cleanAiText(extractContent(data));
  if (!text) {
    throw new AppError({
      message: "AI 未返回有效文本内容，请重试。",
      error_code: "AI_EMPTY_RESPONSE",
      retryable: true,
      status: 502,
    });
  }

  return { text, model: data.model || config.model };
}

function stripListMarker(value: string): string {
  return value
    .replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, "")
    .replace(/^["“]([\s\S]*)["”]$/, "$1")
    .trim();
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => stripListMarker(item))
    .filter(Boolean);
}

/**
 * Tolerant parser for the alternatives endpoint: accepts a bare JSON array or an
 * object containing an `alternatives` array. Anything else is an upstream error,
 * never silently replaced with fake suggestions.
 */
export function parseJsonStringArray(text: string): string[] {
  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  let parsed: unknown = null;

  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    try {
      parsed = JSON.parse(text.slice(arrayStart, arrayEnd + 1));
    } catch {
      parsed = null;
    }
  }

  if (!Array.isArray(parsed)) {
    const objectStart = text.indexOf("{");
    const objectEnd = text.lastIndexOf("}");
    if (objectStart !== -1 && objectEnd > objectStart) {
      try {
        const object = JSON.parse(text.slice(objectStart, objectEnd + 1)) as Record<
          string,
          unknown
        >;
        parsed =
          object.alternatives ?? object.items ?? object.results ?? null;
      } catch {
        parsed = null;
      }
    }
  }

  const alternatives = toStringList(parsed);
  if (!alternatives.length) {
    throw new AppError({
      message: "AI 返回的替代表达格式无效，请重试。",
      error_code: "AI_INVALID_STRUCTURE",
      retryable: true,
      status: 502,
    });
  }

  return Array.from(new Set(alternatives)).slice(0, 5);
}

/**
 * Tolerant JSON-object parser for structured tool responses. The model is told
 * to return JSON only, but occasionally wraps it in prose or a fence; we extract
 * the outer object and never evaluate it.
 */
export function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new AppError({
      message: "AI 返回的结构化结果格式无效，请重试。",
      error_code: "AI_INVALID_STRUCTURE",
      retryable: true,
      status: 502,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AppError({
      message: "AI 返回的结构化结果无法解析，请重试。",
      error_code: "AI_INVALID_STRUCTURE",
      retryable: true,
      status: 502,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError({
      message: "AI 返回的结构化结果格式无效，请重试。",
      error_code: "AI_INVALID_STRUCTURE",
      retryable: true,
      status: 502,
    });
  }

  return parsed as Record<string, unknown>;
}