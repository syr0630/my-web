"use client";

import { useEffect, useMemo, useState } from "react";
import { CharCounter } from "@/components/common/CharCounter";
import { Icon } from "@/components/common/Icon";
import { DiffHighlight } from "@/components/editor/DiffHighlight";
import { InteractiveDiff } from "@/components/editor/InteractiveDiff";
import { MAX_VISIBLE_CHARS } from "@/lib/constants";
import type { DiffRange } from "@/lib/diff/text-diff";
import { countVisibleChars } from "@/lib/text/char-count";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type {
  ContentLanguage,
  PolishStandard,
  SentencePair,
} from "@/types";

type View = "highlight" | "edit";

type Props = {
  originalText: string;
  onOriginalChange: (text: string) => void;
  currentText: string;
  onCurrentChange: (text: string) => void;
  pairs: SentencePair[];
  generatedText: string;
  loading: boolean;
  onTryExample: () => void;
  interactive?: boolean;
  polishStyle?: PolishStandard;
  contentLanguage?: ContentLanguage;
  onReplaceRange?: (
    start: number,
    end: number,
    replacement: string,
    expected: string
  ) => boolean;
};

export function DualPaneEditor({
  originalText,
  onOriginalChange,
  currentText,
  onCurrentChange,
  pairs,
  generatedText,
  loading,
  onTryExample,
  interactive = false,
  polishStyle = "standard",
  contentLanguage = "auto",
  onReplaceRange,
}: Props) {
  const { t, uiLocale } = useLocale();
  const en = uiLocale === "en";
  const [view, setView] = useState<View>("highlight");
  const [showDeletes, setShowDeletes] = useState(false);

  const count = countVisibleChars(originalText);
  const overLimit = count > MAX_VISIBLE_CHARS;

  useEffect(() => {
    if (generatedText) setView("highlight");
  }, [generatedText]);

  const altRanges = useMemo<DiffRange[]>(
    () =>
      pairs
        .filter((pair) => pair.alternatives?.length && pair.current)
        .map((pair) => ({
          start: pair.currentStart,
          end: pair.currentEnd,
        })),
    [pairs]
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="app-card flex min-h-[360px] flex-col p-4 sm:p-5 lg:min-h-[460px]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="original-input"
            className="text-sm font-semibold text-slate-800"
          >
            {t.common.original}
          </label>
          <CharCounter text={originalText} />
        </div>

        <textarea
          id="original-input"
          data-testid="original-input"
          className={`textarea min-h-[280px] flex-1 ${
            overLimit ? "!border-[var(--danger-border)]" : ""
          }`}
          value={originalText}
          onChange={(event) => onOriginalChange(event.target.value)}
          placeholder={t.common.originalPlaceholder}
          aria-invalid={overLimit}
          aria-describedby="original-limit-hint"
          spellCheck
        />

        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <p
            id="original-limit-hint"
            className={`text-[11px] leading-relaxed ${
              overLimit ? "font-medium text-[var(--danger)]" : "text-muted"
            }`}
          >
            {overLimit ? t.common.overLimit : t.common.limitHint}
          </p>
          <button
            type="button"
            className="inline-flex min-h-[28px] shrink-0 items-center text-[11px] font-medium text-[var(--primary)] underline decoration-dotted underline-offset-2 hover:text-[var(--primary-strong)]"
            onClick={onTryExample}
            disabled={loading}
          >
            {t.common.tryExample}
          </button>
        </div>
      </section>

      <section className="app-card flex min-h-[360px] flex-col p-4 sm:p-5 lg:min-h-[460px]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              {t.common.result}
            </h2>
            {loading ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--primary)]">
                <Icon name="loader" size={12} className="spin" />
                {t.common.processing}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <CharCounter text={currentText} limit={false} />
            <div
              className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-0.5"
              role="group"
              aria-label={t.common.result}
            >
              <button
                type="button"
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  view === "highlight"
                    ? "bg-[var(--surface)] text-slate-800 shadow-sm"
                    : "text-slate-500"
                }`}
                aria-pressed={view === "highlight"}
                onClick={() => setView("highlight")}
                disabled={!currentText}
              >
                {t.common.highlightView}
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  view === "edit"
                    ? "bg-[var(--surface)] text-slate-800 shadow-sm"
                    : "text-slate-500"
                }`}
                aria-pressed={view === "edit"}
                onClick={() => setView("edit")}
                disabled={!currentText}
              >
                {t.common.editView}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div
            className="loading-bar mb-2"
            role="progressbar"
            aria-label={t.common.processing}
          />
        ) : null}

        {!currentText && loading ? (
          <div className="result-surface flex-1 space-y-2.5" aria-hidden="true">
            <div className="h-4 w-11/12 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-10/12 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-9/12 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-7/12 animate-pulse rounded bg-slate-100" />
          </div>
        ) : null}

        {!currentText && !loading ? (
          <div className="result-surface flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted" data-testid="result-empty">
            <Icon name="sparkles" size={22} className="text-[var(--primary)] opacity-40" />
            <p className="max-w-[16rem] text-sm leading-relaxed">
              {t.common.emptyResult}
            </p>
          </div>
        ) : null}

        {currentText && view === "highlight" ? (
          <div
            className="result-surface flex-1 overflow-auto"
            data-testid="result-highlight"
          >
            {interactive && onReplaceRange ? (
              <InteractiveDiff
                original={originalText}
                current={currentText}
                showDeletes={showDeletes}
                altRanges={altRanges}
                enabled
                style={polishStyle}
                contentLanguage={contentLanguage}
                onReplace={onReplaceRange}
              />
            ) : (
              <DiffHighlight
                original={originalText}
                current={currentText}
                showDeletes={showDeletes}
                altRanges={altRanges}
              />
            )}
          </div>
        ) : null}

        {interactive && onReplaceRange ? (
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--primary)]">
            {en
              ? "Hover a highlighted word to see in-context alternatives (click on touchscreens). Replacing only changes that word; undo restores it."
              : "将鼠标移到高亮表达上查看上下文替换建议（触屏点击）。只替换该处，不会全文替换；可用撤销恢复。"}
          </p>
        ) : null}

        {currentText && view === "edit" ? (
          <textarea
            className="textarea min-h-[280px] flex-1"
            data-testid="result-edit"
            value={currentText}
            onChange={(event) => onCurrentChange(event.target.value)}
            disabled={loading}
            placeholder={t.common.resultPlaceholder}
            aria-label={t.common.result}
            spellCheck
          />
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--success-bg)] ring-1 ring-[var(--success-border)]" />
              {t.common.legendAdded}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 bg-[var(--warning)]" />
              {t.common.legendAlt}
            </span>
          </div>
          {currentText ? (
            <button
              type="button"
              className="text-[11px] text-muted underline decoration-dotted underline-offset-2 hover:text-slate-700"
              onClick={() => setShowDeletes((value) => !value)}
              aria-pressed={showDeletes}
            >
              {showDeletes ? t.common.hideDeletes : t.common.showDeletes}
            </button>
          ) : null}
        </div>

        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
          {t.common.outputNote}
        </p>
      </section>
    </div>
  );
}

