"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/common/Icon";
import { apiPost } from "@/lib/api/client";
import { computeDiff, type DiffRange } from "@/lib/diff/text-diff";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type {
  ContentLanguage,
  PolishStandard,
  WordSuggestionsResponse,
} from "@/types";

type Token = {
  key: string;
  start: number;
  end: number;
  text: string;
  alt: boolean;
};

type Piece =
  | { kind: "plain"; text: string; alt: boolean }
  | { kind: "delete"; text: string }
  | { kind: "token"; token: Token };

type ActiveToken = Token & { rect: DOMRect };

type Props = {
  original: string;
  current: string;
  showDeletes: boolean;
  altRanges: DiffRange[];
  enabled: boolean;
  style: PolishStandard;
  contentLanguage: ContentLanguage;
  onReplace: (
    start: number,
    end: number,
    replacement: string,
    expected: string
  ) => boolean;
};

const WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*|[\u3400-\u4dbf\u4e00-\u9fff]+/g;

function overlapsAlt(start: number, end: number, ranges: DiffRange[]): boolean {
  return ranges.some((range) => start < range.end && end > range.start);
}

function splitInsert(
  text: string,
  start: number,
  altRanges: DiffRange[]
): Piece[] {
  const pieces: Piece[] = [];
  let cursor = 0;
  WORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WORD_RE.exec(text))) {
    if (match.index > cursor) {
      pieces.push({
        kind: "plain",
        text: text.slice(cursor, match.index),
        alt: false,
      });
    }
    const tokenStart = start + match.index;
    const tokenEnd = tokenStart + match[0].length;
    if (match[0].length >= 2 || /[\u3400-\u9fff]/.test(match[0])) {
      pieces.push({
        kind: "token",
        token: {
          key: `${tokenStart}-${tokenEnd}`,
          start: tokenStart,
          end: tokenEnd,
          text: match[0],
          alt: overlapsAlt(tokenStart, tokenEnd, altRanges),
        },
      });
    } else {
      pieces.push({ kind: "plain", text: match[0], alt: false });
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    pieces.push({ kind: "plain", text: text.slice(cursor), alt: false });
  }
  return pieces;
}

function buildPieces(
  original: string,
  current: string,
  showDeletes: boolean,
  altRanges: DiffRange[]
): Piece[] {
  const segments = computeDiff(original, current);
  const pieces: Piece[] = [];
  let offset = 0;

  for (const segment of segments) {
    if (segment.type === "delete") {
      if (showDeletes) pieces.push({ kind: "delete", text: segment.text });
      continue;
    }
    if (segment.type === "insert") {
      pieces.push(...splitInsert(segment.text, offset, altRanges));
      offset += segment.text.length;
      continue;
    }
    pieces.push({
      kind: "plain",
      text: segment.text,
      alt: overlapsAlt(offset, offset + segment.text.length, altRanges),
    });
    offset += segment.text.length;
  }

  return pieces;
}

export function InteractiveDiff({
  original,
  current,
  showDeletes,
  altRanges,
  enabled,
  style,
  contentLanguage,
  onReplace,
}: Props) {
  const { uiLocale } = useLocale();
  const en = uiLocale === "en";
  const pieces = useMemo(
    () => buildPieces(original, current, showDeletes, altRanges),
    [original, current, showDeletes, altRanges]
  );

  const [active, setActive] = useState<ActiveToken | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const cacheRef = useRef(new Map<string, string[]>());
  const activeRef = useRef<ActiveToken | null>(null);
  const tokenRefs = useRef(new Map<string, HTMLButtonElement>());
  const popoverRef = useRef<HTMLDivElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const openedAtRef = useRef(0);
  const focusOptionRef = useRef(false);

  activeRef.current = active;

  const keyFor = (token: Token) =>
    `${style}|${token.text}|${current.slice(
      Math.max(0, token.start - 120),
      token.start
    )}|${current.slice(token.end, token.end + 120)}`;

  function clearTimers() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    hoverTimer.current = null;
    closeTimer.current = null;
  }

  function close(focusBack = false) {
    const previous = activeRef.current;
    abortRef.current?.abort();
    setActive(null);
    setSuggestions([]);
    setError(null);
    setLoading(false);
    if (focusBack && previous) {
      tokenRefs.current.get(previous.key)?.focus();
    }
  }

  function open(token: Token, rect: DOMRect, focusOption: boolean) {
    clearTimers();
    abortRef.current?.abort();
    openedAtRef.current = Date.now();
    focusOptionRef.current = focusOption;
    setActive({ ...token, rect });
    setError(null);
    const cached = cacheRef.current.get(keyFor(token));
    setSuggestions(cached ?? []);
    setLoading(!cached);
    if (focusOption) {
      window.setTimeout(() => firstOptionRef.current?.focus(), 0);
    }
  }

  useEffect(() => {
    if (!active) return;
    const key = keyFor(active);
    if (cacheRef.current.has(key)) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const isActiveKey = () =>
      activeRef.current !== null && keyFor(activeRef.current) === key;
    setLoading(true);
    apiPost<WordSuggestionsResponse>(
      "/api/v1/word-suggestions",
      {
        text: current,
        originalText: original,
        selectedText: active.text,
        beforeContext: current.slice(Math.max(0, active.start - 120), active.start),
        afterContext: current.slice(active.end, active.end + 120),
        contentLanguage,
        style,
      },
      { signal: controller.signal }
    )
      .then((data) => {
        if (!isActiveKey()) return;
        // Empty results are not cached: the next open should be able to retry
        // instead of being stuck on a transient no-candidate answer.
        if (data.suggestions.length) {
          cacheRef.current.set(key, data.suggestions);
        }
        setSuggestions(data.suggestions);
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (isActiveKey()) {
          setError(
            en
              ? "Suggestions are unavailable right now. Your text is unchanged."
              : "暂时无法获取建议，当前文本不会被修改。"
          );
        }
      })
      .finally(() => {
        if (isActiveKey()) setLoading(false);
      });

    return () => controller.abort();
    // keyFor is derived from active/current/style; deliberately run on active only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.key]);

  useEffect(() => {
    if (!active) return;
    if (!focusOptionRef.current) return;
    if (suggestions.length) {
      firstOptionRef.current?.focus();
      focusOptionRef.current = false;
    } else if (!loading) {
      focusOptionRef.current = false;
    }
  }, [active, suggestions.length, loading]);

  useEffect(() => {
    if (!active) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-synonym-token]")) return;
      close();
    };
    const onDismiss = () => {
      if (Date.now() - openedAtRef.current < 320) return;
      close();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onDismiss);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onDismiss);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.key]);

  useEffect(() => {
    return () => {
      clearTimers();
      abortRef.current?.abort();
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  function choose(suggestion: string) {
    if (!active) return;
    const ok = onReplace(
      active.start,
      active.end,
      suggestion,
      active.text
    );
    if (!ok) {
      setError(
        en
          ? "That span changed. Reopen the word to get fresh suggestions."
          : "这段文字已经变化，请重新打开该词获取建议。"
      );
      return;
    }
    setApplied(suggestion);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setApplied(null), 3200);
    close(false);
  }

  const width =
    typeof window === "undefined"
      ? 320
      : Math.min(320, window.innerWidth - 24);
  const above =
    active !== null &&
    typeof window !== "undefined" &&
    active.rect.bottom + 340 > window.innerHeight &&
    active.rect.top > 340;
  const left =
    active !== null && typeof window !== "undefined"
      ? Math.max(12, Math.min(active.rect.left, window.innerWidth - width - 12))
      : 12;

  return (
    <span className="relative">
      {pieces.map((piece, index) => {
        if (piece.kind === "delete") {
          return (
            <span key={`d-${index}`} className="diff-delete">
              {piece.text}
            </span>
          );
        }
        if (piece.kind === "plain") {
          return (
            <span
              key={`p-${index}`}
              className={piece.alt ? "alt-underline" : undefined}
            >
              {piece.text}
            </span>
          );
        }

        const token = piece.token;
        if (!enabled) {
          return (
            <span key={token.key} className={token.alt ? "alt-underline" : undefined}>
              {token.text}
            </span>
          );
        }

        return (
          <button
            key={token.key}
            ref={(node) => {
              if (node) tokenRefs.current.set(token.key, node);
              else tokenRefs.current.delete(token.key);
            }}
            type="button"
            className={`synonym-target diff-insert ${token.alt ? "alt-underline" : ""}`}
            data-synonym-token
            data-testid="synonym-target"
            aria-haspopup="dialog"
            aria-expanded={active?.key === token.key}
            title={en ? "Replace word" : "替换表达"}
            onMouseEnter={(event) => {
              clearTimers();
              const rect = event.currentTarget.getBoundingClientRect();
              hoverTimer.current = window.setTimeout(
                () => open(token, rect, false),
                240
              );
            }}
            onMouseLeave={() => {
              if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
              closeTimer.current = window.setTimeout(() => {
                if (!popoverRef.current?.matches(":hover")) close();
              }, 220);
            }}
            onClick={(event) => {
              event.stopPropagation();
              open(token, event.currentTarget.getBoundingClientRect(), true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open(token, event.currentTarget.getBoundingClientRect(), true);
              }
            }}
          >
            {token.text}
          </button>
        );
      })}

      {applied ? (
        <span className="synonym-toast" role="status">
          <Icon name="check" size={13} />
          {en ? `Replaced with “${applied}” · Undo is available` : `已替换为「${applied}」· 可用撤销恢复`}
        </span>
      ) : null}

      {active && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              className="synonym-popover"
              role="dialog"
              aria-label={en ? "Word suggestions" : "替换表达建议"}
              style={{
                position: "fixed",
                top: above ? active.rect.top - 10 : active.rect.bottom + 10,
                left,
                width,
                transform: above ? "translateY(-100%)" : undefined,
                zIndex: 90,
              }}
              onMouseEnter={() => {
                if (closeTimer.current) window.clearTimeout(closeTimer.current);
              }}
              onMouseLeave={() => {
                closeTimer.current = window.setTimeout(() => close(), 220);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                  {en ? "Replace word" : "替换表达"}
                </p>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted hover:text-[var(--text)]"
                  onClick={() => close(true)}
                  aria-label={en ? "Close suggestions" : "关闭建议"}
                >
                  <Icon name="close" size={14} />
                </button>
              </div>

              <p className="mt-1.5 font-display text-lg leading-tight tracking-tight text-[var(--text)]">
                {en ? "Replace " : "替换 "}
                <span className="text-[var(--primary-strong)]">
                  “{active.text}”
                </span>
              </p>

              <div className="mt-2 rounded-lg bg-[var(--surface-muted)] px-2.5 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {en ? "Original" : "原文"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-[var(--text-soft)]">
                  {original.length > 180
                    ? `${original.slice(0, 180)}…`
                    : original}
                </p>
              </div>

              {loading ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <Icon name="loader" size={14} className="animate-spin" />
                  {en ? "Finding context-aware options…" : "正在结合上下文生成建议…"}
                </p>
              ) : error ? (
                <p className="mt-3 text-xs leading-5 text-[var(--danger)]">
                  {error}
                </p>
              ) : suggestions.length ? (
                <ul className="mt-3 space-y-1" role="list">
                  {suggestions.map((suggestion, index) => (
                    <li key={`${suggestion}-${index}`}>
                      <button
                        ref={index === 0 ? firstOptionRef : undefined}
                        type="button"
                        className="synonym-option"
                        onClick={() => choose(suggestion)}
                      >
                        <span>{suggestion}</span>
                        <Icon name="arrowRight" size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs leading-5 text-muted">
                  {en
                    ? "No reliable alternative for this context. Keep the current wording."
                    : "当前语境下没有足够可靠的替代表达，保留当前用词即可。"}
                </p>
              )}

              <button
                type="button"
                className="mt-3 w-full rounded-lg border border-[var(--border)] px-2.5 py-2 text-[11px] font-medium text-[var(--text-soft)] hover:bg-[var(--surface-muted)]"
                onClick={() => close(true)}
              >
                {en ? "Keep current wording" : "保留当前表达"}
              </button>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}