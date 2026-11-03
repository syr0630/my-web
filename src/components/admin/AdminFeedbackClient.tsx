"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/common/Icon";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  type FeedbackCategory,
  type FeedbackRecord,
  type FeedbackStatus,
} from "@/lib/feedback/types";

type Stats = {
  all: number;
  new: number;
  in_progress: number;
  resolved: number;
  archived: number;
};

type ListPayload = {
  items: FeedbackRecord[];
  total: number;
  page: number;
  pageSize: number;
  stats: Stats;
};

const EMPTY_STATS: Stats = {
  all: 0,
  new: 0,
  in_progress: 0,
  resolved: 0,
  archived: 0,
};

const STATUS_STYLES: Record<FeedbackStatus, string> = {
  new: "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--text)]",
  in_progress: "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]",
  resolved: "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--text)]",
  archived: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]",
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function StatusPill({ status }: { status: FeedbackStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${STATUS_STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {FEEDBACK_STATUS_LABELS[status].zh}
      <span className="font-normal opacity-65">
        {FEEDBACK_STATUS_LABELS[status].en}
      </span>
    </span>
  );
}

function CategoryLabel({ category }: { category: FeedbackCategory }) {
  return (
    <span className="text-[11px] text-[var(--text-soft)]">
      {FEEDBACK_CATEGORY_LABELS[category].zh}
      <span className="ml-1.5 text-[10px] text-[var(--muted)]">
        {FEEDBACK_CATEGORY_LABELS[category].en}
      </span>
    </span>
  );
}

function StatCard({
  label,
  en,
  value,
  active,
  onClick,
}: {
  label: string;
  en: string;
  value: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border p-4 text-left transition sm:p-5 ${
        active
          ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_18px_35px_-26px_rgba(76,108,194,0.5)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--surface)]"
      }`}
    >
      <span
        className={`block text-[10px] font-semibold uppercase tracking-[0.15em] ${
          active ? "text-white" : "text-[var(--muted)]"
        }`}
      >
        {en}
      </span>
      <span className="mt-2 flex items-end justify-between gap-2">
        <span className="font-display text-3xl leading-none tracking-[-0.04em]">
          {value}
        </span>
        <span
          className={`text-[11px] ${
            active ? "text-white" : "text-[var(--muted)]"
          }`}
        >
          {label}
        </span>
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]">
        <Icon name="text" size={23} />
      </span>
      <p className="mt-5 font-display text-2xl tracking-[-0.03em] text-[var(--text)]">
        No feedback yet.
      </p>
      <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
        Your next idea might start here.
        <br />
        这里还很安静，等第一条真实的想法。
      </p>
      <Link
        href="/feedback"
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs font-medium text-[var(--text-soft)] transition hover:border-[var(--primary)] hover:text-[var(--primary-strong)]"
      >
        去首页看看反馈表单
        <Icon name="arrowRight" size={13} />
      </Link>
    </div>
  );
}

function Modal({
  children,
  onClose,
  labelledBy,
}: {
  children: ReactNode;
  onClose: () => void;
  labelledBy: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(18,20,28,0.42)] p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:max-w-2xl sm:rounded-[24px]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="关闭详情"
          className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          <Icon name="close" size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function AdminFeedbackClient() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [status, setStatus] = useState<FeedbackStatus | "">("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [selected, setSelected] = useState<FeedbackRecord | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [draftStatus, setDraftStatus] = useState<FeedbackStatus>("new");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    params.set("sort", sort);
    params.set("page", String(page));

    try {
      const response = await fetch(`/api/admin/feedback?${params.toString()}`, {
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | (ListPayload & { message?: string })
        | null;
      if (!response.ok || !payload) {
        setError(payload?.message || "无法读取反馈列表，请重试。");
        return;
      }
      setItems(payload.items);
      setTotal(payload.total);
      setPage(payload.page);
      setPageSize(payload.pageSize);
      setStats(payload.stats);
    } catch {
      setError("网络连接失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [search, category, status, sort, page, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function selectStat(next: FeedbackStatus | "") {
    setStatus(next);
    setPage(1);
  }

  async function openDetail(item: FeedbackRecord) {
    setSelected(item);
    setDraftNote(item.admin_note ?? "");
    setDraftStatus(item.status);
  }

  const closeDetail = useCallback(() => {
    setSelected(null);
    setSaving(false);
  }, []);

  async function saveDetail(patch: {
    status?: FeedbackStatus;
    admin_note?: string | null;
    close?: boolean;
  }) {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {};
      if (patch.status !== undefined) body.status = patch.status;
      if (patch.admin_note !== undefined) body.admin_note = patch.admin_note;

      const response = await fetch(`/api/admin/feedback/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | { feedback?: FeedbackRecord; message?: string }
        | null;
      if (!response.ok || !payload?.feedback) {
        setError(payload?.message || "保存失败，请重试。");
        return;
      }

      setSelected(payload.feedback);
      setDraftNote(payload.feedback.admin_note ?? "");
      setDraftStatus(payload.feedback.status);
      setNotice("已保存这条反馈的处理状态。");
      if (patch.close) closeDetail();
      await load();
    } catch {
      setError("网络连接失败，保存没有生效。");
    } finally {
      setSaving(false);
    }
  }

  async function archiveSelected() {
    await saveDetail({ status: "archived", close: true });
  }

  async function deleteSelected() {
    if (!selected || saving) return;
    const confirmed = window.confirm(
      "Delete this feedback permanently? 这条反馈将被永久删除，且无法恢复。"
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/feedback/${selected.id}`, {
        method: "DELETE",
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setError(payload?.message || "删除失败，请重试。");
        return;
      }
      closeDetail();
      setNotice("反馈已删除。");
      await load();
    } catch {
      setError("网络连接失败，删除没有生效。");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    router.replace("/admin/login");
    router.refresh();
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(search || category || status);

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
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
              Feedback inbox · 反馈后台
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <Link
              href="/admin/analytics"
              className="hidden rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] sm:inline-flex"
            >
              数据统计
            </Link>
            <Link
              href="/"
              className="hidden rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] sm:inline-flex"
            >
              查看网站
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-medium text-[var(--text-soft)] transition hover:border-[var(--primary)] hover:text-[var(--primary-strong)]"
              data-testid="admin-logout"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="landing-eyebrow justify-start">
              <span className="h-px w-7 bg-[var(--border-strong)]" />
              Admin / Feedback
            </p>
            <h1 className="mt-3 font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-none tracking-[-0.05em] text-[var(--text)]">
              What people told us.
            </h1>
            <p className="mt-3 max-w-xl text-[12px] leading-6 text-[var(--muted)]">
              只展示真实提交的反馈。按时间倒序排列，可筛选、备注、归档或删除。
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            {total} record{total === 1 ? "" : "s"} · newest first
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <StatCard
            label="全部"
            en="All"
            value={stats.all}
            active={!status}
            onClick={() => selectStat("")}
          />
          <StatCard
            label="新反馈"
            en="New"
            value={stats.new}
            active={status === "new"}
            onClick={() => selectStat("new")}
          />
          <StatCard
            label="处理中"
            en="In progress"
            value={stats.in_progress}
            active={status === "in_progress"}
            onClick={() => selectStat("in_progress")}
          />
          <StatCard
            label="已解决"
            en="Resolved"
            value={stats.resolved}
            active={status === "resolved"}
            onClick={() => selectStat("resolved")}
          />
          <StatCard
            label="已归档"
            en="Archived"
            value={stats.archived}
            active={status === "archived"}
            onClick={() => selectStat("archived")}
          />
        </div>

        <div className="mt-7 rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-3.5 sm:flex-row sm:items-center sm:p-4">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">搜索邮箱或反馈正文</span>
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                <Icon name="scan" size={15} />
              </span>
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="搜索邮箱或反馈正文…"
                className="min-h-[42px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] pl-10 pr-3 text-xs text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-[var(--ring)]"
                data-testid="admin-search"
              />
            </label>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as FeedbackCategory | "");
                  setPage(1);
                }}
                aria-label="按反馈类别筛选"
                className="select min-h-[42px] text-xs sm:w-[150px]"
                data-testid="admin-category-filter"
              >
                <option value="">全部类别</option>
                {FEEDBACK_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {FEEDBACK_CATEGORY_LABELS[item].zh}
                  </option>
                ))}
              </select>

              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as FeedbackStatus | "");
                  setPage(1);
                }}
                aria-label="按处理状态筛选"
                className="select min-h-[42px] text-xs sm:w-[140px]"
                data-testid="admin-status-filter"
              >
                <option value="">全部状态</option>
                {FEEDBACK_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {FEEDBACK_STATUS_LABELS[item].zh}
                  </option>
                ))}
              </select>

              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as "newest" | "oldest");
                  setPage(1);
                }}
                aria-label="按提交时间排序"
                className="select min-h-[42px] text-xs sm:w-[130px]"
              >
                <option value="newest">最新优先</option>
                <option value="oldest">最早优先</option>
              </select>

              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-soft)] transition hover:border-[var(--primary)] hover:text-[var(--primary-strong)] disabled:opacity-50"
                data-testid="admin-refresh"
              >
                <Icon name="refresh" size={14} className={loading ? "spin" : ""} />
                刷新
              </button>
            </div>
          </div>

          {notice ? (
            <div
              role="status"
              className="flex items-center gap-2 border-b border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-2.5 text-[11px] text-[var(--primary-strong)]"
            >
              <Icon name="check" size={13} />
              {notice}
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex items-center gap-2 border-b border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2.5 text-[11px] text-[var(--danger)]"
            >
              <Icon name="alert" size={13} />
              {error}
            </div>
          ) : null}

          {loading && items.length === 0 ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            hasFilters ? (
              <div className="px-6 py-16 text-center">
                <p className="font-display text-xl text-[var(--text)]">
                  没有符合条件的反馈。
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  换一个关键词或清除筛选后再试。
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setCategory("");
                    setStatus("");
                    setPage(1);
                  }}
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--text-soft)]"
                >
                  清除筛选
                </button>
              </div>
            ) : (
              <EmptyState />
            )
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
                      <th className="px-4 py-3 font-semibold">Submitted</th>
                      <th className="px-4 py-3 font-semibold">Type / 类别</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="w-[34%] px-4 py-3 font-semibold">Feedback</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="group border-b border-[var(--border)]/70 align-top transition last:border-0 hover:bg-[var(--surface-muted)]"
                        data-testid="feedback-row"
                        data-feedback-id={item.id}
                      >
                        <td className="whitespace-nowrap px-4 py-4 text-[11px] text-[var(--muted)]">
                          {formatDate(item.created_at)}
                        </td>
                        <td className="px-4 py-4">
                          <CategoryLabel category={item.category} />
                        </td>
                        <td className="max-w-[170px] truncate px-4 py-4 text-[11px] text-[var(--text-soft)]">
                          {item.email ?? (
                            <span className="text-[var(--muted)]">Anonymous</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => void openDetail(item)}
                            className="line-clamp-2 max-w-lg text-left text-xs leading-6 text-[var(--text-soft)] transition hover:text-[var(--primary-strong)]"
                          >
                            {item.message}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill status={item.status} />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => void openDetail(item)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[10px] font-medium text-[var(--text-soft)] transition hover:border-[var(--primary)] hover:text-[var(--primary-strong)]"
                            data-testid="feedback-open"
                          >
                            查看
                            <Icon name="arrowRight" size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-[var(--border)] md:hidden">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openDetail(item)}
                    className="block w-full p-4 text-left transition hover:bg-[var(--surface-muted)]"
                    data-testid="feedback-card"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <CategoryLabel category={item.category} />
                      <StatusPill status={item.status} />
                    </div>
                    <p className="mt-2.5 line-clamp-3 text-xs leading-6 text-[var(--text-soft)]">
                      {item.message}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between gap-3 text-[10px] text-[var(--muted)]">
                      <span className="truncate">{item.email ?? "Anonymous"}</span>
                      <span className="shrink-0">{formatDate(item.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {total > 0 ? (
            <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3.5 text-[11px] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
              <span>
                第 {page} / {pageCount} 页 · 共 {total} 条
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, current + 1))
                  }
                  disabled={page >= pageCount || loading}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {selected ? (
        <Modal onClose={closeDetail} labelledBy="feedback-detail-title">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] p-5 pr-14 sm:p-6 sm:pr-16">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={selected.status} />
              <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                {FEEDBACK_CATEGORY_LABELS[selected.category].en}
              </span>
            </div>
            <h2
              id="feedback-detail-title"
              className="mt-3 font-display text-2xl tracking-[-0.035em] text-[var(--text)]"
            >
              一条来自 {selected.email ?? "匿名访客"} 的反馈
            </h2>
            <p className="mt-1.5 text-[10px] text-[var(--muted)]">
              提交于 {formatDate(selected.created_at)} · 最近更新{" "}
              {formatDate(selected.updated_at)} · ID {selected.id.slice(0, 8)}
            </p>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                Email · 邮箱
              </p>
              <p className="mt-1.5 break-all text-xs text-[var(--text-soft)]">
                {selected.email ?? "Anonymous · 未填写"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                Message · 反馈正文
              </p>
              <div className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[13px] leading-7 text-[var(--text-soft)]">
                {selected.message}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="admin-status"
                  className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]"
                >
                  Status · 处理状态
                </label>
                <select
                  id="admin-status"
                  value={draftStatus}
                  onChange={(event) =>
                    setDraftStatus(event.target.value as FeedbackStatus)
                  }
                  className="select mt-2 min-h-[42px] text-xs"
                  data-testid="admin-detail-status"
                >
                  {FEEDBACK_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {FEEDBACK_STATUS_LABELS[item].zh} ·{" "}
                      {FEEDBACK_STATUS_LABELS[item].en}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
                  Consent · 同意记录
                </p>
                <p className="mt-3 text-xs text-[var(--text-soft)]">
                  {selected.consent ? "已勾选" : "未记录"} ·{" "}
                  {formatDate(selected.consented_at)}
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-note"
                className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]"
              >
                Admin note · 内部备注
              </label>
              <textarea
                id="admin-note"
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="记录处理思路、回复状态或后续动作。仅管理员可见。"
                className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-xs leading-6 text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--ring)]"
                data-testid="admin-note"
              />
              <p className="mt-1 text-right text-[10px] text-[var(--muted)]">
                {draftNote.length} / 2000
              </p>
            </div>

            <div className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void saveDetail({
                      status: draftStatus,
                      admin_note: draftNote,
                    })
                  }
                  disabled={saving}
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 text-xs font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:opacity-50"
                  data-testid="admin-save"
                >
                  {saving ? (
                    <Icon name="loader" size={14} className="spin" />
                  ) : (
                    <Icon name="check" size={14} />
                  )}
                  保存状态与备注
                </button>
                <button
                  type="button"
                  onClick={() => void archiveSelected()}
                  disabled={saving || selected.status === "archived"}
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-medium text-[var(--text-soft)] transition hover:border-[var(--primary)] disabled:opacity-40"
                  data-testid="admin-archive"
                >
                  <Icon name="download" size={14} />
                  归档
                </button>
              </div>
              <button
                type="button"
                onClick={() => void deleteSelected()}
                disabled={saving}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-transparent px-3 text-xs font-medium text-[var(--danger)] transition hover:bg-[var(--danger-bg)] disabled:opacity-50"
                data-testid="admin-delete"
              >
                <Icon name="trash" size={14} />
                永久删除
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}



