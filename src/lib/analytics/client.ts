"use client";

import type { AnalyticsFeature } from "@/lib/analytics/db";

const VISITOR_KEY = "draftly.visitor.v1";

const ENDPOINT_FEATURES: { prefix: string; feature: AnalyticsFeature }[] = [
  { prefix: "/api/v1/polish", feature: "polish" },
  { prefix: "/api/v1/humanize", feature: "humanize" },
  { prefix: "/api/v1/translate", feature: "translate" },
  { prefix: "/api/v1/grammar/check", feature: "grammar" },
  { prefix: "/api/v1/detector/analyze", feature: "detector" },
  { prefix: "/api/v1/academic", feature: "academic" },
  { prefix: "/api/style-profile/analyze", feature: "style_profile" },
  { prefix: "/api/style-consistency/analyze", feature: "style_consistency" },
  { prefix: "/api/v1/documents/extract", feature: "document_extract" },
];

export function getVisitorId(): string {
  if (typeof window === "undefined") return "anonymous";
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length >= 8) return existing;
    const created =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return "anonymous";
  }
}

function featureForPath(path: string): AnalyticsFeature | null {
  const match = ENDPOINT_FEATURES.find((item) => path.startsWith(item.prefix));
  return match?.feature ?? null;
}

/** Fire-and-forget; analytics must never block or fail a writing request. */
export function recordFeatureUsage(
  path: string,
  status: "success" | "error"
): void {
  if (typeof window === "undefined") return;
  const feature = featureForPath(path);
  if (!feature) return;
  try {
    const payload = JSON.stringify({
      feature,
      status,
      visitorId: getVisitorId(),
    });
    void fetch("/api/analytics/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      cache: "no-store",
    }).catch(() => undefined);
  } catch {
    // Analytics are best-effort only.
  }
}

export function recordPageView(path: string): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, visitorId: getVisitorId() }),
      keepalive: true,
      cache: "no-store",
    }).catch(() => undefined);
  } catch {
    // Analytics are best-effort only.
  }
}