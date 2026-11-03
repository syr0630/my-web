import { getFeedbackDb } from "@/lib/feedback/db";

export type AnalyticsEventType = "page_view" | "feature_run";
export type AnalyticsStatus = "success" | "error";

export type AnalyticsEventInput = {
  eventType: AnalyticsEventType;
  path?: string | null;
  feature?: string | null;
  status?: AnalyticsStatus | null;
  visitorId: string;
};

export type AnalyticsDailyPoint = {
  date: string;
  views: number;
  runs: number;
};

export type AnalyticsFeatureRow = {
  feature: string;
  runs: number;
  success: number;
  error: number;
};

export type AnalyticsRecentEvent = {
  eventType: AnalyticsEventType;
  path: string | null;
  feature: string | null;
  status: AnalyticsStatus | null;
  createdAt: string;
};

export type AnalyticsSummary = {
  generatedAt: string;
  totals: {
    pageViews: number;
    uniqueVisitors: number;
    todayViews: number;
    featureRuns: number;
    todayRuns: number;
    successRuns: number;
    errorRuns: number;
    successRate: number;
  };
  daily: AnalyticsDailyPoint[];
  topPages: { path: string; views: number }[];
  features: AnalyticsFeatureRow[];
  recent: AnalyticsRecentEvent[];
};

export const ANALYTICS_FEATURES = [
  "polish",
  "humanize",
  "translate",
  "grammar",
  "detector",
  "academic",
  "style_profile",
  "style_consistency",
  "document_extract",
] as const;

export type AnalyticsFeature = (typeof ANALYTICS_FEATURES)[number];

export function isAnalyticsFeature(value: unknown): value is AnalyticsFeature {
  return (
    typeof value === "string" &&
    ANALYTICS_FEATURES.includes(value as AnalyticsFeature)
  );
}

function count(db: ReturnType<typeof getFeedbackDb>, sql: string): number {
  const row = db.prepare(sql).get() as { count: number } | undefined;
  return Number(row?.count ?? 0);
}

export function recordAnalyticsEvent(input: AnalyticsEventInput): void {
  const db = getFeedbackDb();
  db.prepare(
    `INSERT INTO analytics_events
       (event_type, path, feature, status, visitor_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    input.eventType,
    input.path?.slice(0, 240) ?? null,
    input.feature?.slice(0, 80) ?? null,
    input.status ?? null,
    input.visitorId.slice(0, 96),
    new Date().toISOString()
  );
}

export function getAnalyticsSummary(days = 14): AnalyticsSummary {
  const db = getFeedbackDb();
  const windowDays = Math.min(Math.max(Math.floor(days), 7), 90);

  const pageViews = count(
    db,
    "SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = 'page_view'"
  );
  const featureRuns = count(
    db,
    "SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = 'feature_run'"
  );
  const successRuns = count(
    db,
    "SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = 'feature_run' AND status = 'success'"
  );
  const errorRuns = count(
    db,
    "SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = 'feature_run' AND status = 'error'"
  );

  const uniqueVisitors = count(
    db,
    "SELECT COUNT(DISTINCT visitor_id) AS count FROM analytics_events WHERE event_type = 'page_view'"
  );
  const todayViews = count(
    db,
    "SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = 'page_view' AND date(created_at) = date('now')"
  );
  const todayRuns = count(
    db,
    "SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = 'feature_run' AND date(created_at) = date('now')"
  );

  const rows = db
    .prepare(
      `SELECT substr(created_at, 1, 10) AS day,
              SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS views,
              SUM(CASE WHEN event_type = 'feature_run' THEN 1 ELSE 0 END) AS runs
         FROM analytics_events
        WHERE date(created_at) >= date('now', ?)
        GROUP BY day
        ORDER BY day ASC`
    )
    .all(`-${windowDays - 1} days`) as {
    day: string;
    views: number;
    runs: number;
  }[];

  const byDay = new Map(rows.map((row) => [row.day, row]));
  const daily: AnalyticsDailyPoint[] = [];
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key);
    daily.push({
      date: key,
      views: Number(row?.views ?? 0),
      runs: Number(row?.runs ?? 0),
    });
  }

  const topPages = db
    .prepare(
      `SELECT path, COUNT(*) AS views
         FROM analytics_events
        WHERE event_type = 'page_view' AND path IS NOT NULL
        GROUP BY path
        ORDER BY views DESC
        LIMIT 8`
    )
    .all() as { path: string; views: number }[];

  const features = db
    .prepare(
      `SELECT feature,
              COUNT(*) AS runs,
              SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success,
              SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error
         FROM analytics_events
        WHERE event_type = 'feature_run' AND feature IS NOT NULL
        GROUP BY feature
        ORDER BY runs DESC`
    )
    .all() as AnalyticsFeatureRow[];

  const recentRows = db
    .prepare(
      `SELECT event_type AS eventType, path, feature, status, created_at AS createdAt
         FROM analytics_events
        ORDER BY id DESC
        LIMIT 15`
    )
    .all() as AnalyticsRecentEvent[];

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      pageViews,
      uniqueVisitors,
      todayViews,
      featureRuns,
      todayRuns,
      successRuns,
      errorRuns,
      successRate:
        featureRuns > 0 ? Math.round((successRuns / featureRuns) * 1000) / 10 : 0,
    },
    daily,
    topPages: topPages.map((row) => ({
      path: row.path,
      views: Number(row.views),
    })),
    features: features.map((row) => ({
      feature: row.feature,
      runs: Number(row.runs),
      success: Number(row.success),
      error: Number(row.error),
    })),
    recent: recentRows,
  };
}