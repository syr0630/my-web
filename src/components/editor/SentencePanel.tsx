"use client";

import { useState } from "react";
import { Icon } from "@/components/common/Icon";
import { Notice } from "@/components/common/Notice";
import { DiffHighlight } from "@/components/editor/DiffHighlight";
import { apiPost } from "@/lib/api/client";
import {
  isAbortError,
  toDisplayError,
  type DisplayError,
} from "@/lib/api/display-error";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { AiTextResponse, ContentLanguage, SentencePair } from "@/types";

type Props = {
  pairs: SentencePair[];
  contentLanguage: ContentLanguage;
  busy?: boolean;
  onRestore: (id: string) => void;
  onApplyAlternative: (id: string, alternative: string) => void;
  onAlternatives: (id: string, alternatives: string[]) => void;
  onExplanation: (id: string, explanation: string) => void;
};

type PendingKind = "alt" | "explain";

export function SentencePanel({
  pairs,
  contentLanguage,
  busy,
  onRestore,
  onApplyAlternative,
  onAlternatives,
  onExplanation,
}: Props) {
  const { t } = useLocale();
  const [pending, setPending] = useState<{
    id: string;
    kind: PendingKind;
  } | null>(null);
  const [error, setError] = useState<DisplayError | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const changed = pairs
    .map((pair, index) => ({ pair, index }))
    .filter(({ pair }) => pair.changed && pair.current);

  async function loadAlternatives(pair: SentencePair) {
    setPending({ id: pair.id, kind: "alt" });
    setError(null);
    try {
      const data = await apiPost<AiTextResponse>("/api/v1/alternatives", {
        originalSentence: pair.original || pair.current,
        currentSentence: pair.current,
        contentLanguage,
      });
      const alternatives = data.alternatives ?? [];
      if (!alternatives.length) {
        setError({
          message: t.common.failedKeepInput,
          code: "AI_INVALID_STRUCTURE",
        });
        return;
      }
      onAlternatives(pair.id, alternatives);
    } catch (caught) {
      if (!isAbortError(caught)) {
        setError(toDisplayError(caught, t, t.common.failedKeepInput));
      }
    } finally {
      setPending(null);
    }
  }

  async function loadExplanation(pair: SentencePair) {
    setPending({ id: pair.id, kind: "explain" });
    setError(null);
    try {
      const data = await apiPost<AiTextResponse>("/api/v1/explain-change", {
        originalSentence: pair.original || pair.current,
        revisedSentence: pair.current,
        contentLanguage,
      });
      if (!data.explanation) {
        setError({
          message: t.common.failedKeepInput,
          code: "AI_EMPTY_RESPONSE",
        });
        return;
      }
      onExplanation(pair.id, data.explanation);
    } catch (caught) {
      if (!isAbortError(caught)) {
        setError(toDisplayError(caught, t, t.common.failedKeepInput));
      }
    } finally {
      setPending(null);
    }
  }

  async function copySentence(pair: SentencePair) {
    try {
      await navigator.clipboard.writeText(pair.current);
      setCopiedId(pair.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setError({ message: t.common.copyFailed });
    }
  }

  if (!changed.length) {
    return (
      <section className="app-card p-4 sm:p-5" data-testid="sentence-panel">
        <div className="flex flex-col items-start gap-2 text-sm text-muted">
          <span className="flex items-center gap-2 font-medium text-[var(--text-soft)]">
            <Icon name="split" size={18} />
            {t.common.changesTitle}
          </span>
          <p>{t.common.noChanges}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="app-card p-4 sm:p-5" aria-busy={Boolean(pending) || busy} data-testid="sentence-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <Icon name="split" size={18} className="text-[var(--primary)]" />
          {t.common.changesTitle}
          <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary-strong)]">
            {changed.length} {t.common.changesSuffix}
          </span>
        </h2>
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
      </div>

      {error ? (
        <div className="mb-3">
          <Notice
            tone="error"
            meta={
              error.code
                ? `${error.code}${
                    error.requestId ? ` · ${error.requestId}` : ""
                  }`
                : undefined
            }
          >
            {error.message}
          </Notice>
        </div>
      ) : null}

      <ul className="space-y-3">
        {changed.map(({ pair, index }) => {
          const isPendingAlt =
            pending?.id === pair.id && pending.kind === "alt";
          const isPendingExplain =
            pending?.id === pair.id && pending.kind === "explain";
          const hasAlternatives = Boolean(pair.alternatives?.length);
          const isNew = !pair.original;

          return (
            <li
              key={pair.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5"
              data-testid="sentence-card"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium tabular-nums text-[var(--muted)]">
                  #{index + 1}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isNew
                      ? "bg-[var(--warning-bg)] text-[var(--text)]"
                      : "bg-[var(--primary-soft)] text-[var(--primary-strong)]"
                  }`}
                >
                  {isNew ? t.common.newSentence : t.common.rewrittenSentence}
                </span>
                {hasAlternatives ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text)]">
                    <Icon name="sparkles" size={12} />
                    {t.common.alternatives}
                  </span>
                ) : null}
              </div>

              {pair.original ? (
                <div className="mb-2">
                  <p className="mb-1 text-[11px] font-medium text-[var(--muted)]">
                    {t.common.original}
                  </p>
                  <p className="rounded-lg bg-[var(--surface)] px-2.5 py-2 text-sm leading-relaxed text-[var(--muted)]">
                    {pair.original}
                  </p>
                </div>
              ) : null}

              <div>
                <p className="mb-1 text-[11px] font-medium text-[var(--muted)]">
                  {t.common.result}
                </p>
                <p
                  className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm leading-relaxed text-[var(--text)] ${
                    hasAlternatives ? "alt-underline" : ""
                  }`}
                >
                  <DiffHighlight
                    original={pair.original}
                    current={pair.current}
                    showDeletes={false}
                  />
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className="btn btn-secondary !min-h-[34px] !gap-1.5 !px-2.5 !py-1 !text-xs"
                  data-action="restore"
                  onClick={() => onRestore(pair.id)}
                  disabled={busy}
                >
                  <Icon name="restore" size={14} />
                  {t.common.restoreSentence}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary !min-h-[34px] !gap-1.5 !px-2.5 !py-1 !text-xs"
                  data-action="copy"
                  onClick={() => copySentence(pair)}
                  disabled={busy}
                >
                  <Icon name="copy" size={14} />
                  {copiedId === pair.id
                    ? t.common.copied
                    : t.common.copySentence}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary !min-h-[34px] !gap-1.5 !px-2.5 !py-1 !text-xs"
                  data-action="alternatives"
                  onClick={() => loadAlternatives(pair)}
                  disabled={busy || Boolean(pending)}
                  aria-busy={isPendingAlt}
                >
                  <Icon
                    name={isPendingAlt ? "loader" : "sparkles"}
                    size={14}
                    className={isPendingAlt ? "spin" : undefined}
                  />
                  {isPendingAlt ? t.common.altLoading : t.common.alternatives}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary !min-h-[34px] !gap-1.5 !px-2.5 !py-1 !text-xs"
                  data-action="explain"
                  onClick={() => loadExplanation(pair)}
                  disabled={busy || Boolean(pending)}
                  aria-busy={isPendingExplain}
                >
                  <Icon name={isPendingExplain ? "loader" : "info"} size={14} className={isPendingExplain ? "spin" : undefined} />
                  {isPendingExplain ? t.common.explainLoading : t.common.explain}
                </button>
              </div>

              {hasAlternatives ? (
                <div className="mt-2.5 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-2.5" data-testid="alternatives-list">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text)]">
                    {t.common.alternatives} · {t.common.clickToApply}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {pair.alternatives?.map((alternative) => (
                      <button
                        key={alternative}
                        type="button"
                        className="rounded-lg border border-[var(--warning-border)] bg-[var(--surface)] px-2.5 py-1.5 text-left text-sm leading-relaxed text-[var(--text-soft)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-softer)]"
                        data-testid="alternative-option"
                        onClick={() => onApplyAlternative(pair.id, alternative)}
                        disabled={busy}
                      >
                        {alternative}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {pair.explanation ? (
                <div className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-[var(--surface)] px-2.5 py-2 text-xs leading-relaxed text-[var(--muted)]" data-testid="explanation">
                  <Icon
                    name="info"
                    size={14}
                    className="mt-0.5 shrink-0 text-[var(--muted)]"
                  />
                  <span>{pair.explanation}</span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

