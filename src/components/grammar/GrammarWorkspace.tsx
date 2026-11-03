"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CharCounter } from "@/components/common/CharCounter";
import { Icon } from "@/components/common/Icon";
import { LanguageSelect } from "@/components/common/LanguageSelect";
import { Notice } from "@/components/common/Notice";
import { PageHeader } from "@/components/common/PageHeader";
import { apiPost } from "@/lib/api/client";
import {
  isAbortError,
  toDisplayError,
  type DisplayError,
} from "@/lib/api/display-error";
import { MAX_VISIBLE_CHARS } from "@/lib/constants";
import { setHandoff, takeHandoff } from "@/lib/handoff";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { countVisibleChars } from "@/lib/text/char-count";
import {
  beginWorkspaceTask,
  cancelWorkspaceTask,
  finishWorkspaceTask,
  isWorkspaceTaskCurrent,
} from "@/lib/workspace/tasks";
import { useWorkspaceState } from "@/lib/workspace/state";
import type {
  ContentLanguage,
  GrammarIssue,
  GrammarResponse,
  GrammarSeverity,
  GrammarIssueType,
} from "@/types";

const COPY = {
  "zh-CN": {
    eyebrow: "Grammar",
    title: "语法检查",
    subtitle: "逐句检查语法、拼写、标点与搭配，修改前先看清每一处。",
    badge: "真实 AI 校对",
    input: "待检查文本",
    placeholder: "粘贴一段中文或英文，最多 2000 个可见字符。",
    run: "检查语法",
    rerun: "重新检查",
    example: "填入示例",
    result: "修正结果",
    issues: "检查结果",
    empty: "运行检查后，问题会出现在这里。",
    noIssues: "没有发现需要修改的问题。",
    applyAll: "全部应用",
    ignoreAll: "全部忽略",
    apply: "应用",
    applied: "已应用",
    ignore: "忽略",
    ignored: "已忽略",
    copy: "复制修正结果",
    copied: "已复制",
    send: "送到文本润色",
    position: "位置",
    original: "原文",
    replacement: "建议",
    disclaimer: "只修正确定的错误，不替代人工终审。",
    types: {
      grammar: "语法",
      spelling: "拼写",
      punctuation: "标点",
      word_choice: "用词",
      style: "表达",
    } as Record<GrammarIssueType, string>,
    severities: {
      error: "错误",
      warning: "警告",
      suggestion: "建议",
    } as Record<GrammarSeverity, string>,
    required: "请先输入文本。",
    limit: "已超出 2000 可见字符上限，请删减后再提交。",
    failed: "检查失败，已保留你的文本。",
    noResult: "还没有修正结果。",
    charCount: "可见字符",
  },
  en: {
    eyebrow: "Grammar",
    title: "Grammar check",
    subtitle:
      "Check grammar, spelling, punctuation and collocations sentence by sentence.",
    badge: "Real AI proofreading",
    input: "Text to check",
    placeholder: "Paste Chinese or English text, up to 2000 visible characters.",
    run: "Check grammar",
    rerun: "Check again",
    example: "Use example",
    result: "Corrected text",
    issues: "Findings",
    empty: "Findings will appear here after a check.",
    noIssues: "No issues that need changing were found.",
    applyAll: "Apply all",
    ignoreAll: "Ignore all",
    apply: "Apply",
    applied: "Applied",
    ignore: "Ignore",
    ignored: "Ignored",
    copy: "Copy corrected text",
    copied: "Copied",
    send: "Send to polisher",
    position: "Position",
    original: "Original",
    replacement: "Suggestion",
    disclaimer:
      "Only confident corrections are applied; this does not replace human review.",
    types: {
      grammar: "Grammar",
      spelling: "Spelling",
      punctuation: "Punctuation",
      word_choice: "Word choice",
      style: "Expression",
    } as Record<GrammarIssueType, string>,
    severities: {
      error: "Error",
      warning: "Warning",
      suggestion: "Suggestion",
    } as Record<GrammarSeverity, string>,
    required: "Please enter some text first.",
    limit: "The 2000-character limit has been exceeded.",
    failed: "The check failed and your text was kept.",
    noResult: "No corrected text yet.",
    charCount: "visible characters",
  },
} as const;

const EXAMPLE_ZH =
  "随着人工智能技术的快速发展，越来越多的研究者开始关注大语言模型在教育领域的应用，但是目前仍有一些问题需要进一步探讨。";
const EXAMPLE_EN =
  "The experiment was conducted in a laboratory, and the results shows that the new method is more better than the traditional one.";

function applyIssues(
  text: string,
  issues: GrammarIssue[],
  ignored: Set<string>
): string {
  let output = text;
  for (const issue of [...issues].reverse()) {
    if (ignored.has(issue.id)) continue;
    output =
      output.slice(0, issue.start) +
      issue.replacement +
      output.slice(issue.end);
  }
  return output;
}

export function GrammarWorkspace() {
  const { uiLocale, t } = useLocale();
  const c = COPY[uiLocale];
  const router = useRouter();

  const [text, setText] = useWorkspaceState("grammar.text", "");
  const [contentLanguage, setContentLanguage] =
    useWorkspaceState<ContentLanguage>("grammar.contentLanguage", "auto");
  const [issues, setIssues] = useWorkspaceState<GrammarIssue[] | null>(
    "grammar.issues",
    null
  );
  const [ignoredIds, setIgnoredIds] = useWorkspaceState<string[]>(
    "grammar.ignored",
    []
  );
  const [loading, setLoading] = useWorkspaceState<boolean>(
    "grammar.loading",
    false,
    { persist: false }
  );
  const [error, setError] = useWorkspaceState<DisplayError | null>(
    "grammar.error",
    null,
    { persist: false }
  );
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useWorkspaceState<string | null>(
    "grammar.notice",
    null
  );

  const ignored = useMemo(() => new Set(ignoredIds), [ignoredIds]);
  const versionRef = useRef(`${Date.now().toString(36)}-start`);

  useEffect(() => {
    const handoff = takeHandoff("grammar");
    if (handoff) {
      setText(handoff.slice(0, MAX_VISIBLE_CHARS));
      versionRef.current = `${Date.now().toString(36)}-handoff`;
    }
  }, [setText]);

  const count = countVisibleChars(text);
  const overLimit = count > MAX_VISIBLE_CHARS;
  const corrected = useMemo(
    () => (issues ? applyIssues(text, issues, ignored) : ""),
    [text, issues, ignored]
  );

  function updateText(value: string) {
    cancelWorkspaceTask("grammar");
    setLoading(false);
    setText(value);
    setIssues(null);
    setIgnoredIds([]);
    setNotice(null);
    versionRef.current = `${Date.now().toString(36)}-${value.length}`;
  }

  function fillExample() {
    updateText(uiLocale === "en" ? EXAMPLE_EN : EXAMPLE_ZH);
  }

  async function run() {
    setError(null);
    setNotice(null);
    if (!text.trim()) {
      setError({ message: c.required });
      return;
    }
    if (overLimit) {
      setError({ message: c.limit });
      return;
    }

    const task = beginWorkspaceTask("grammar");
    setLoading(true);

    try {
      const data = await apiPost<GrammarResponse>(
        "/api/v1/grammar/check",
        {
          text,
          contentLanguage,
          sourceVersion: versionRef.current,
        },
        { signal: task.controller.signal }
      );
      if (!isWorkspaceTaskCurrent("grammar", task.epoch)) return;
      setIssues(data.issues);
      setIgnoredIds([]);
      setNotice(
        data.issues.length
          ? `${data.issues.length} ${uiLocale === "en" ? "findings" : "处问题"}`
          : c.noIssues
      );
    } catch (caught) {
      if (
        isWorkspaceTaskCurrent("grammar", task.epoch) &&
        !isAbortError(caught)
      ) {
        setError(toDisplayError(caught, t, c.failed));
      }
    } finally {
      if (isWorkspaceTaskCurrent("grammar", task.epoch)) {
        setLoading(false);
        finishWorkspaceTask("grammar", task.epoch);
      }
    }
  }

  function setIssueIgnored(id: string, shouldIgnore: boolean) {
    setIgnoredIds((current) =>
      shouldIgnore
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((item) => item !== id)
    );
  }

  async function copyResult() {
    if (!corrected) return;
    try {
      await navigator.clipboard.writeText(corrected);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError({ message: "复制失败，请手动选择文本。" });
    }
  }

  function sendToPolisher() {
    if (!corrected.trim()) return;
    setHandoff({ text: corrected, from: "grammar" });
    router.push("/polisher?handoff=1");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={c.eyebrow}
        icon="checkBadge"
        title={c.title}
        subtitle={c.subtitle}
        badge={<span className="chip">{c.badge}</span>}
      />

      <section className="app-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <LanguageSelect
              value={contentLanguage}
              onChange={setContentLanguage}
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fillExample}
              disabled={loading}
            >
              {c.example}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void run()}
              disabled={loading || !text.trim() || overLimit}
              data-testid="grammar-run"
            >
              <Icon
                name={loading ? "loader" : "checkBadge"}
                size={17}
                className={loading ? "animate-spin" : undefined}
              />
              {loading ? "…" : issues ? c.rerun : c.run}
            </button>
          </div>
        </div>

        <label htmlFor="grammar-input" className="field-label">
          {c.input}
        </label>
        <textarea
          id="grammar-input"
          data-testid="grammar-input"
          className={`textarea mt-1.5 min-h-[220px] ${
            overLimit ? "!border-[var(--danger-border)]" : ""
          }`}
          value={text}
          onChange={(event) => updateText(event.target.value)}
          placeholder={c.placeholder}
          aria-invalid={overLimit}
          aria-describedby="grammar-limit"
          spellCheck
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p
            id="grammar-limit"
            className={`text-[11px] ${
              overLimit ? "text-[var(--danger)]" : "text-muted"
            }`}
          >
            {overLimit
              ? c.limit
              : `${MAX_VISIBLE_CHARS} ${c.charCount}`}
          </p>
          <CharCounter text={text} />
        </div>
      </section>

      {error ? (
        <Notice tone="error" testId="grammar-error">
          {error.message}
          {error.code ? (
            <span className="ml-1 font-mono text-[11px] opacity-70">
              {error.code}
            </span>
          ) : null}
        </Notice>
      ) : null}

      {notice && !error ? (
        <Notice tone="success" testId="grammar-notice">
          {notice}
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="app-card flex min-h-[300px] flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              {c.issues}{" "}
              {issues ? (
                <span className="ml-1 text-xs font-normal text-muted">
                  {issues.length}
                </span>
              ) : null}
            </h2>
            {issues && issues.length ? (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="inline-flex min-h-[28px] items-center text-[11px] font-medium text-[var(--primary)] hover:underline"
                  onClick={() => setIgnoredIds([])}
                >
                  {c.applyAll}
                </button>
                <span className="text-[var(--border-strong)]">/</span>
                <button
                  type="button"
                  className="text-[11px] font-medium text-muted hover:text-[var(--text)]"
                  onClick={() =>
                    setIgnoredIds(issues.map((issue) => issue.id))
                  }
                >
                  {c.ignoreAll}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex-1">
            {!issues ? (
              <p className="text-sm text-muted">{c.empty}</p>
            ) : issues.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-[var(--primary-softer)] p-3 text-sm text-[var(--primary-strong)]">
                <Icon name="check" size={17} />
                {c.noIssues}
              </div>
            ) : (
              <ul className="space-y-2" data-testid="grammar-issues">
                {issues.map((issue) => {
                  const isIgnored = ignored.has(issue.id);
                  return (
                    <li
                      key={issue.id}
                      data-testid="grammar-issue"
                      className={`rounded-xl border p-3 transition ${
                        isIgnored
                          ? "border-[var(--border)] bg-[var(--surface-muted)] opacity-65"
                          : "border-[var(--border)] bg-[var(--surface)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="chip">
                          {c.types[issue.type]}
                        </span>
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide ${
                            issue.severity === "error"
                              ? "text-[var(--danger)]"
                              : issue.severity === "warning"
                                ? "text-[var(--warning)]"
                                : "text-muted"
                          }`}
                        >
                          {c.severities[issue.severity]}
                        </span>
                        <span className="ml-auto text-[10px] text-muted">
                          {c.position} {issue.start + 1}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--text-soft)]">
                        {issue.message}
                      </p>
                      <p className="mt-2 break-words font-mono text-[11px] leading-relaxed text-[var(--muted)]">
                        <span className="text-[var(--danger)]">
                          {issue.original}
                        </span>
                        <span className="mx-1.5">→</span>
                        <span className="text-[var(--primary-strong)]">
                          {issue.replacement || (uiLocale === "en" ? "remove" : "删除")}
                        </span>
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            !isIgnored
                              ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-strong)]"
                              : "border-[var(--border)] text-muted"
                          }`}
                          onClick={() => setIssueIgnored(issue.id, false)}
                          aria-pressed={!isIgnored}
                        >
                          {!isIgnored ? c.applied : c.apply}
                        </button>
                        <button
                          type="button"
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            isIgnored
                              ? "border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-soft)]"
                              : "border-[var(--border)] text-muted"
                          }`}
                          onClick={() => setIssueIgnored(issue.id, true)}
                          aria-pressed={isIgnored}
                        >
                          {isIgnored ? c.ignored : c.ignore}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="app-card flex min-h-[300px] flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              {c.result}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary !min-h-[34px] !px-2.5 !text-[11px]"
                onClick={() => void copyResult()}
                disabled={!corrected}
              >
                <Icon name="copy" size={13} />
                {copied ? c.copied : c.copy}
              </button>
              <button
                type="button"
                className="btn btn-secondary !min-h-[34px] !px-2.5 !text-[11px]"
                onClick={sendToPolisher}
                disabled={!corrected}
              >
                {c.send}
                <Icon name="arrowRight" size={13} />
              </button>
            </div>
          </div>

          {corrected ? (
            <div
              className="mt-3 flex-1 whitespace-pre-wrap rounded-xl bg-[var(--surface-muted)] p-3.5 text-sm leading-7 text-[var(--text)]"
              data-testid="grammar-result"
            >
              {corrected}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">{c.noResult}</p>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
            <Icon name="shield" size={12} className="mt-0.5 shrink-0" />
            {c.disclaimer}
          </p>
        </section>
      </div>
    </div>
  );
}

