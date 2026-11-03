"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { Notice } from "@/components/common/Notice";
import {
  CONSISTENCY_DIMENSIONS,
  RATING_LABELS,
  STYLE_COPY,
} from "@/components/style-profile/copy";
import { apiPost } from "@/lib/api/client";
import { isAbortError } from "@/lib/api/display-error";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type {
  PolishStandard,
  StyleApplyResponse,
  StyleConsistencyResponse,
  StyleDifference,
} from "@/types";

type Props = {
  originalText: string;
  currentText: string;
  sourceVersion: string;
  styleProfileId: string;
  styleProfileName: string;
  standard: PolishStandard;
  analysisToken: number;
  onApplyText: (text: string) => void;
  onReplaceDifference: (
    start: number,
    end: number,
    replacement: string,
    expected: string
  ) => boolean;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function StyleConsistencyPanel({
  originalText,
  currentText,
  sourceVersion,
  styleProfileId,
  styleProfileName,
  standard,
  analysisToken,
  onApplyText,
  onReplaceDifference,
}: Props) {
  const { uiLocale } = useLocale();
  const c = STYLE_COPY[uiLocale];
  const en = uiLocale === "en";

  const [analysis, setAnalysis] = useState<StyleConsistencyResponse | null>(null);
  const [analyzedText, setAnalyzedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [handled, setHandled] = useState<Set<string>>(new Set());

  const currentTextRef = useRef(currentText);
  currentTextRef.current = currentText;
  const originalTextRef = useRef(originalText);
  originalTextRef.current = originalText;
  const profileIdRef = useRef(styleProfileId);
  profileIdRef.current = styleProfileId;
  const standardRef = useRef(standard);
  standardRef.current = standard;
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);

  const runAnalysis = useCallback(
    async (text: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const run = runRef.current + 1;
      runRef.current = run;

      setLoading(true);
      setError(null);
      setHandled(new Set());

      try {
        const data = await apiPost<StyleConsistencyResponse>(
          "/api/style-consistency/analyze",
          {
            originalText: originalTextRef.current,
            currentText: text,
            styleProfileId: profileIdRef.current,
            standard: standardRef.current,
          },
          { signal: controller.signal }
        );
        if (runRef.current !== run) return;
        setAnalysis(data);
        setAnalyzedText(text);
      } catch (caught) {
        if (runRef.current !== run || isAbortError(caught)) return;
        setError(errorMessage(caught, c.failed));
      } finally {
        if (runRef.current === run) setLoading(false);
      }
    },
    [c.failed]
  );

  useEffect(() => {
    if (analysisToken === 0) return;
    void runAnalysis(currentTextRef.current);
    return () => abortRef.current?.abort();
  }, [analysisToken, styleProfileId, runAnalysis]);

  async function applySuggestions() {
    if (!analysis) return;
    setApplying(true);
    setError(null);
    setNotice(null);
    try {
      const suggestions = [
        ...analysis.differences.map((difference) => difference.suggestion),
        ...analysis.dimensions
          .filter((dimension) => dimension.rating !== "high")
          .map((dimension) => dimension.explanation),
      ].slice(0, 8);

      const data = await apiPost<StyleApplyResponse>(
        "/api/style-consistency/apply",
        {
          currentText,
          styleProfileId,
          standard,
          sourceVersion,
          differences: analysis.differences,
          suggestions,
        }
      );
      onApplyText(data.text);
      setNotice(
        data.appliedChanges.length
          ? `${en ? "Applied: " : "已应用："}${data.appliedChanges.join("；")}`
          : en
            ? "The text was already consistent; no change was needed."
            : "当前文本已较一致，本次没有生成额外修改。"
      );
      setShowReview(false);
    } catch (caught) {
      setError(errorMessage(caught, c.failed));
    } finally {
      setApplying(false);
    }
  }

  function acceptDifference(difference: StyleDifference) {
    setError(null);
    const applied = onReplaceDifference(
      difference.start,
      difference.end,
      difference.suggestion,
      difference.quote
    );
    if (!applied) {
      setError(
        en
          ? "The text changed and this position is no longer valid. Analyze again."
          : "文本已变化，这处差异的位置已失效，请重新分析。"
      );
      return;
    }
    setHandled((current) => new Set(current).add(difference.id));
  }

  function ignoreDifference(difference: StyleDifference) {
    setError(null);
    setHandled((current) => new Set(current).add(difference.id));
  }

  const stale = Boolean(analysis && analyzedText !== currentText);
  const differences = (analysis?.differences ?? []).filter(
    (difference) => !handled.has(difference.id)
  );

  return (
    <section className="app-card p-4 sm:p-5" data-testid="style-consistency">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2 text-base">
            <Icon name="spark" size={18} className="text-[var(--primary)]" />
            {en ? "Style consistency" : "风格匹配反馈"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {en
              ? "An auxiliary comparison with the selected profile. It never replaces your polished text automatically."
              : "对照所选风格画像的辅助分析，不会自动覆盖已经生成的润色稿。"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <Icon name="spark" size={12} />
            {styleProfileName}
          </span>
          <button
            type="button"
            className="btn btn-secondary !min-h-[40px]"
            onClick={() => {
              setNotice(null);
              void runAnalysis(currentTextRef.current);
            }}
            disabled={loading || applying}
            data-testid="style-reanalyze"
          >
            <Icon name={loading ? "loader" : "refresh"} size={16} />
            {loading ? c.analyzing : c.reanalyze}
          </button>
        </div>
      </div>

      {loading && !analysis ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted" role="status">
          <Icon name="loader" size={15} />
          {c.analyzing}
        </p>
      ) : null}

      {error ? (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      {notice ? (
        <div className="mt-4">
          <Notice tone="success">{notice}</Notice>
        </div>
      ) : null}

      {analysis ? (
        <div className="mt-4 space-y-4">
          {stale ? (
            <Notice tone="warning">
              {en
                ? "The text has been edited since this analysis. Re-analyze for an up-to-date comparison."
                : "文本在这次分析后已被编辑；当前反馈基于旧版本，可重新分析。"}
            </Notice>
          ) : null}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  analysis.overall === "high"
                    ? "bg-[var(--success-bg)] text-[var(--text)]"
                    : analysis.overall === "medium"
                      ? "bg-[var(--warning-bg)] text-[var(--text)]"
                      : "bg-[var(--danger-bg)] text-[var(--text)]"
                }`}
              >
                {RATING_LABELS[analysis.overall][en ? "en" : "zh"]}
              </span>
              <span className="text-xs text-muted">
                {en ? "Overall style match" : "总体风格匹配"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)]">
              {analysis.summary}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {CONSISTENCY_DIMENSIONS.map((dimension, index) => {
              const item = analysis.dimensions.find(
                (entry) => entry.key === dimension.key
              );
              if (!item) return null;
              return (
                <div
                  key={dimension.key}
                  className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 ${
                    index === CONSISTENCY_DIMENSIONS.length - 1
                      ? "sm:col-span-2"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[var(--text-soft)]">
                      {en ? dimension.en : dimension.zh}
                    </p>
                    <span
                      className={`text-[10px] font-semibold ${
                        item.rating === "high"
                          ? "text-[var(--text)]"
                          : item.rating === "medium"
                            ? "text-[var(--text)]"
                            : "text-[var(--text)]"
                      }`}
                    >
                      {RATING_LABELS[item.rating][en ? "en" : "zh"]}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    {item.explanation}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              className="btn btn-primary !min-h-[40px]"
              onClick={() => void applySuggestions()}
              disabled={
                applying ||
                loading ||
                (analysis.differences.length === 0 &&
                  analysis.dimensions.every(
                    (dimension) => dimension.rating === "high"
                  ))
              }
              data-testid="style-apply"
            >
              <Icon name={applying ? "loader" : "sparkles"} size={16} />
              {applying
                ? en
                  ? "Applying…"
                  : "正在调整…"
                : en
                  ? "Apply Suggestions"
                  : "应用调整建议"}
            </button>
            <button
              type="button"
              className="btn btn-secondary !min-h-[40px]"
              onClick={() => setShowReview((current) => !current)}
              disabled={!analysis.differences.length}
              data-testid="style-review"
              aria-expanded={showReview}
            >
              <Icon name="scan" size={16} />
              {showReview ? c.hideReview : c.review}
            </button>
            <span className="text-[11px] text-muted">
              {analysis.differences.length
                ? en
                  ? `${differences.length} difference(s) to review`
                  : `${differences.length} 处差异可逐项查看`
                : en
                  ? "No precise textual difference found."
                  : "没有发现可精确定位的差异。"}
            </span>
          </div>

          {showReview ? (
            <div className="space-y-2" data-testid="style-differences">
              {differences.length === 0 ? (
                <p className="text-xs text-muted">
                  {en
                    ? "No remaining differences, or they have been handled."
                    : "没有剩余差异，或已逐项处理。"}
                </p>
              ) : (
                differences.map((difference) => (
                  <div
                    key={difference.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                    data-testid="style-difference"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">
                      {CONSISTENCY_DIMENSIONS.find(
                        (dimension) => dimension.key === difference.type
                      )?.[en ? "en" : "zh"] ?? difference.type}
                    </p>
                    <p className="mt-1 rounded-md bg-[var(--warning-bg)] px-2 py-1 text-xs leading-relaxed text-[var(--text-soft)]">
                      “{difference.quote}”
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                      {difference.reason}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--primary-strong)]">
                      {en ? "Suggested replacement: " : "建议替换为："}
                      {difference.suggestion}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary !min-h-[36px] !px-2.5 text-xs"
                        onClick={() => acceptDifference(difference)}
                        disabled={applying || loading}
                        data-testid="style-accept-difference"
                      >
                        <Icon name="check" size={14} />
                        {en ? "Accept" : "接受这处替换"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost !min-h-[36px] !px-2.5 text-xs"
                        onClick={() => ignoreDifference(difference)}
                        disabled={applying || loading}
                        data-testid="style-ignore-difference"
                      >
                        {en ? "Ignore" : "忽略这处建议"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {analysis.limitations ? (
            <p className="text-[11px] leading-relaxed text-muted">
              {analysis.limitations}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

