import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { AppError } from "@/lib/errors";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "local";
}

function isExpired(bucket: Bucket, now: number): boolean {
  return now >= bucket.resetAt;
}

/** In-memory fixed window limit. Good enough for a single Node instance. */
export function assertRateLimit(
  key: string,
  max = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW_MS
): void {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (isExpired(bucket, now)) buckets.delete(bucketKey);
    }
  }

  const current = buckets.get(key);

  if (!current || isExpired(current, now)) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= max) {
    throw new AppError({
      message: "请求过于频繁，请稍后再试。",
      error_code: "RATE_LIMITED",
      retryable: true,
      status: 429,
    });
  }

  current.count += 1;
  buckets.set(key, current);
}