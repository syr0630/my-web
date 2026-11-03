"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/common/Icon";
import type { AnalyticsSummary } from "@/lib/analytics/db";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function percent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function Card({
  label,
  en,
  value,
  hint,
}: {
  label: string;
  en: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
        {en}
      </p>
      <p className="mt-2 font-display text-3xl leading-none tracking-[-0.04em] text-[var(--text)]">
        {value}
      </p>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        {label}
        {hint ? ` · ${hint}` : ""}
      </p>
    </div>
  );
}

export function AdminAnalyticsClient() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/analytics?days=14", {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as AnalyticsSummary & {
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || "统计数据加载失败。");
        }
        setData(payload);
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError(caught instanceof Error ? caught.message : "统计数据加载失败。");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const maxDaily = Math.max(
    1,
    ...(data?.daily.map((point) => Math.max(point.views, point.runs)) ?? [1])
  );
  const maxFeature = Math.max(
    1,
    ...(data?.features.map((row) => row.runs) ?? [1])
  );

  return (
    <div className="min-h-dvh bg-[var(--bg)]" data-testid="admin-analytics">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="brand-seed brand-seed-small" aria-hidden="true">
                <span />
              </span>
              <span className="font-display text-lg tracking-[-0.035em]">
                Draftly
              </span>
            </Link>
            <span className="hidden h-4 w-px bg-[var(--border)] sm:block" />
            <p className="hidden text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] sm:block">
              Analytics · 访问统计
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <Link
              href="/admin/feedback"
              className="rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
            >
              反馈后台
            </Link>
            <Link
              href="/"
              className="hidden rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] sm:inline-flex"
            >
              查看网站
            </Link>
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="landing-eyebrow justify-start">
              <span className="h-px w-7 bg-[var(--border-strong)]" />
              Admin / Analytics
            </p>
            <h1 className="mt-3 font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-none tracking-[-0.05em] text-[var(--text)]">
              Who stopped by.
            </h1>
            <p className="mt-3 max-w-2xl text-[12px] leading-6 text-[var(--muted)]">
              第一方匿名统计：只记录页面路径、功能调用结果和随机访客编号，不保存 IP、正文或登录信息。后台页面不计入访问量。
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Last 14 days · UTC
          </p>
        </div>

        {error ? (
          <div className="mt-7 rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-[13px] text-[var(--text)]">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <p className="mt-10 text-sm text-muted">正在读取真实访问数据…</p>
        ) : null}

        {data ? (
          <>
            <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              <Card
                label="累计访问"
                en="Page views"
                value={data.totals.pageViews}
              />
              <Card
                label="独立访客"
                en="Visitors"
                value={data.totals.uniqueVisitors}
              />
              <Card
                label="今日访问"
                en="Today"
                value={data.totals.todayViews}
              />
              <Card
                label="功能调用"
                en="Feature runs"
                value={data.totals.featureRuns}
              />
              <Card
                label="成功率"
                en="Success"
                value={percent(data.totals.successRate)}
                hint={`${data.totals.successRuns} 成功`}
              />
              <Card
                label="失败调用"
                en="Errors"
                value={data.totals.errorRuns}
                hint={`今日 ${data.totals.todayRuns} 次调用`}
              />
            </div>

            <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl tracking-[-0.03em] text-[var(--text)]">
                    每日趋势
                  </h2>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    蓝色为页面访问，金色为功能调用。
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                    访问
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--tone-academic-accent)]" />
                    调用
                  </span>
                </div>
              </div>
              <div
                className="mt-6 flex h-44 items-end gap-1.5 sm:gap-2"
                role="img"
                aria-label="近十四天访问与功能调用趋势"
              >
                {data.daily.map((point) => (
                  <div
                    key={point.date}
                    className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
                    title={`${point.date} · ${point.views} 访问 · ${point.runs} 调用`}
                  >
                    <div className="flex h-full items-end justify-center gap-0.5">
                      <span
                        className="w-1/2 rounded-t-[3px] bg-[var(--primary)] opacity-80 transition group-hover:opacity-100"
                        style={{
                          height: `${Math.max(2, (point.views / maxDaily) * 100)}%`,
                        }}
                      />
                      <span
                        className="w-1/2 rounded-t-[3px] bg-[var(--tone-academic-accent)] opacity-80 transition group-hover:opacity-100"
                        style={{
                          height: `${Math.max(1, (point.runs / maxDaily) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="truncate text-center text-[8px] text-[var(--muted)] sm:text-[9px]">
                      {point.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
                  <h2 className="font-display text-xl tracking-[-0.03em] text-[var(--text)]">
                    热门页面
                  </h2>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {data.topPages.length ? (
                    data.topPages.map((row) => (
                      <div
                        key={row.path}
                        className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
                      >
                        <span className="min-w-0 truncate font-mono text-[11px] text-[var(--text-soft)]">
                          {row.path}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-[var(--muted)]">
                          {row.views}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="px-5 py-10 text-sm text-[var(--muted)]">
                      还没有访问记录。
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
                  <h2 className="font-display text-xl tracking-[-0.03em] text-[var(--text)]">
                    功能使用
                  </h2>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {data.features.length ? (
                    data.features.map((row) => (
                      <div key={row.feature} className="px-4 py-3 sm:px-5">
                        <div className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-medium text-[var(--text)]">
                            {row.feature}
                          </span>
                          <span className="tabular-nums text-[var(--muted)]">
                            {row.runs} · {row.success} 成功
                            {row.error ? ` · ${row.error} 失败` : ""}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                          <div
                            className="h-full rounded-full bg-[var(--primary)]"
                            style={{
                              width: `${Math.max(3, (row.runs / maxFeature) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="px-5 py-10 text-sm text-[var(--muted)]">
                      还没有功能调用记录。
                    </p>
                  )}
                </div>
              </section>
            </div>

            <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4 sm:px-5">
                <h2 className="font-display text-xl tracking-[-0.03em] text-[var(--text)]">
                  最近事件
                </h2>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                  newest first
                </span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {data.recent.length ? (
                  data.recent.map((event, index) => (
                    <div
                      key={`${event.createdAt}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px] sm:px-5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--muted)]">
                          {event.eventType === "page_view" ? "view" : "run"}
                        </span>
                        <span className="truncate font-mono text-[var(--text-soft)]">
                          {event.path ?? event.feature ?? "—"}
                        </span>
                        {event.status ? (
                          <span
                            className={
                              event.status === "success"
                                ? "text-[var(--success)]"
                                : "text-[var(--danger)]"
                            }
                          >
                            {event.status}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-[var(--muted)]">
                        {formatDate(event.createdAt)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="px-5 py-10 text-sm text-[var(--muted)]">
                    还没有事件。
                  </p>
                )}
              </div>
            </section>

            <p className="mt-5 inline-flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
              <Icon name="shield" size={12} />
              数据来自 Draftly 自身接口；页面刷新后仍会保留。后台访问不计数。
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}