import type { DiffSegment, SentencePair } from "@/types";

/* ------------------------------------------------------------------ */
/* Sentence splitting                                                  */
/* ------------------------------------------------------------------ */

export type Sentence = {
  text: string;
  start: number;
  end: number;
};

const CJK_CHAR_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const STRONG_END = new Set(["。", "！", "？", "；", "…", "．", ".", "!", "?", ";"]);
const ASCII_END = new Set([".", "!", "?", ";"]);
const CLOSERS = new Set([
  "”",
  "’",
  '"',
  "'",
  "」",
  "』",
  "）",
  ")",
  "]",
  "】",
  "》",
  "〉",
]);
const WHITESPACE_RE = /\s/;

function isSpace(ch: string | undefined): boolean {
  return ch !== undefined && WHITESPACE_RE.test(ch);
}

/**
 * Split a draft into sentences while keeping exact offsets.
 *
 * Handles Chinese and English punctuation in the same pass, so mixed text
 * never needs a separate code path. Leading/trailing whitespace stays outside
 * the span, which keeps paragraph breaks intact when one sentence is restored.
 */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const len = text.length;

  const push = (from: number, to: number) => {
    let start = from;
    let end = to;
    while (start < end && isSpace(text[start])) start += 1;
    while (end > start && isSpace(text[end - 1])) end -= 1;
    if (end > start) {
      out.push({ text: text.slice(start, end), start, end });
    }
  };

  let start = 0;
  let i = 0;

  while (i < len) {
    const ch = text[i];

    if (ch === "\n") {
      push(start, i);
      start = i + 1;
      i += 1;
      continue;
    }

    if (STRONG_END.has(ch)) {
      // Decimal points such as 3.14 are not sentence boundaries.
      if (
        ch === "." &&
        /\d/.test(text[i - 1] ?? "") &&
        /\d/.test(text[i + 1] ?? "")
      ) {
        i += 1;
        continue;
      }

      let j = i + 1;
      while (j < len && CLOSERS.has(text[j])) j += 1;

      const isCjkPunctuation = !ASCII_END.has(ch);
      const next = j < len ? text[j] : undefined;

      if (
        isCjkPunctuation ||
        next === undefined ||
        isSpace(next) ||
        CJK_CHAR_RE.test(next)
      ) {
        push(start, j);
        start = j;
        i = j;
        continue;
      }
    }

    i += 1;
  }

  push(start, len);
  return out;
}

/* ------------------------------------------------------------------ */
/* Similarity                                                          */
/* ------------------------------------------------------------------ */

const TOKEN_RE =
  /[\u3400-\u4dbf\u4e00-\u9fff]|[A-Za-z]+(?:['’-][A-Za-z]+)*|\d+(?:[.,]\d+)?/g;

function tokenizeForSimilarity(text: string): string[] {
  const matches = text.toLowerCase().match(TOKEN_RE);
  return matches ?? [];
}

/** Sørensen–Dice coefficient over token multisets, 0–1. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const left = tokenizeForSimilarity(a);
  const right = tokenizeForSimilarity(b);
  if (!left.length || !right.length) return 0;

  const counts = new Map<string, number>();
  for (const token of left) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  let shared = 0;
  for (const token of right) {
    const remaining = counts.get(token) ?? 0;
    if (remaining > 0) {
      shared += 1;
      counts.set(token, remaining - 1);
    }
  }

  return (2 * shared) / (left.length + right.length);
}

/* ------------------------------------------------------------------ */
/* Alignment                                                           */
/* ------------------------------------------------------------------ */

type AlignOp =
  | { type: "match"; oi: number; ci: number }
  | { type: "del"; oi: number }
  | { type: "ins"; ci: number };

const GAP_COST = 0.95;
const EPSILON = 1e-9;

function align(originals: Sentence[], currents: Sentence[]): AlignOp[] {
  const n = originals.length;
  const m = currents.length;

  if (n === 0) return currents.map((_, ci) => ({ type: "ins", ci }));
  if (m === 0) return originals.map((_, oi) => ({ type: "del", oi }));

  const subCost: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < m; j += 1) {
      const sim = similarity(originals[i].text, currents[j].text);
      const positionPenalty = Math.abs(i / n - j / m);
      subCost[i][j] = 0.18 + (1 - sim) * 1.15 + positionPenalty * 1.4;
    }
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0)
  );
  for (let i = 1; i <= n; i += 1) dp[i][0] = i * GAP_COST;
  for (let j = 1; j <= m; j += 1) dp[0][j] = j * GAP_COST;

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const pair = dp[i - 1][j - 1] + subCost[i - 1][j - 1];
      const drop = dp[i - 1][j] + GAP_COST;
      const add = dp[i][j - 1] + GAP_COST;
      dp[i][j] = Math.min(pair, drop, add);
    }
  }

  const ops: AlignOp[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const pair = dp[i - 1][j - 1] + subCost[i - 1][j - 1];
      if (Math.abs(dp[i][j] - pair) < EPSILON) {
        ops.push({ type: "match", oi: i - 1, ci: j - 1 });
        i -= 1;
        j -= 1;
        continue;
      }
    }
    if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + GAP_COST)) < EPSILON) {
      ops.push({ type: "del", oi: i - 1 });
      i -= 1;
      continue;
    }
    ops.push({ type: "ins", ci: j - 1 });
    j -= 1;
  }

  return ops.reverse();
}

/* ------------------------------------------------------------------ */
/* Hashing / keys                                                      */
/* ------------------------------------------------------------------ */

export function hashText(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Stable key for "the original sentence this pair came from". */
export function pairKey(pair: Pick<SentencePair, "original" | "current">): string {
  return `k-${hashText(pair.original || pair.current)}`;
}

/** Explanation is only valid for one specific revision. */
export function explanationKey(
  pair: Pick<SentencePair, "original" | "current">
): string {
  return `e-${hashText(`${pair.original}\u0000${pair.current}`)}`;
}

/* ------------------------------------------------------------------ */
/* Pair builder                                                        */
/* ------------------------------------------------------------------ */

type Group = { ois: number[]; cis: number[] };

function buildGroups(ops: AlignOp[]): Group[] {
  const groups: Group[] = [];
  let pendingDels: number[] = [];
  let pendingIns: number[] = [];

  const flush = () => {
    if (pendingDels.length || pendingIns.length) {
      groups.push({ ois: pendingDels, cis: pendingIns });
      pendingDels = [];
      pendingIns = [];
    }
  };

  for (const op of ops) {
    if (op.type === "match") {
      if (pendingIns.length) {
        flush();
      }
      const extra = pendingDels;
      pendingDels = [];
      groups.push({ ois: [...extra, op.oi], cis: [op.ci] });
      continue;
    }
    if (op.type === "del") {
      pendingDels.push(op.oi);
      continue;
    }
    pendingIns.push(op.ci);
  }

  if (pendingIns.length) {
    flush();
  } else if (pendingDels.length && groups.length) {
    // Trailing originals that disappeared from the result belong to the last
    // restorable group, so "restore" puts them back where they were.
    groups[groups.length - 1].ois.push(...pendingDels);
  }

  return groups;
}

function spanForGroup(
  group: Group,
  originals: Sentence[],
  currents: Sentence[]
): { originalStart: number; originalEnd: number; currentStart: number; currentEnd: number } {
  const firstOriginal = group.ois.length ? originals[group.ois[0]] : undefined;
  const lastOriginal = group.ois.length
    ? originals[group.ois[group.ois.length - 1]]
    : undefined;

  let currentStart = 0;
  let currentEnd = 0;

  if (group.cis.length) {
    currentStart = currents[group.cis[0]].start;
    currentEnd = currents[group.cis[group.cis.length - 1]].end;
  }

  return {
    originalStart: firstOriginal?.start ?? 0,
    originalEnd: lastOriginal?.end ?? 0,
    currentStart,
    currentEnd,
  };
}

/**
 * Align original and current text at sentence level, returning pairs with
 * exact spans. Inserted sentences get `original === ""`; restoring them removes
 * the span. Deleted originals are attached to the nearest restorable group.
 */
export function buildSentencePairs(
  originalText: string,
  currentText: string
): SentencePair[] {
  if (!currentText.trim()) return [];

  const originals = splitSentences(originalText);
  const currents = splitSentences(currentText);

  let groups = buildGroups(align(originals, currents));

  if (!groups.length) {
    if (!currents.length) return [];
    groups = [{ ois: [], cis: currents.map((_, index) => index) }];
  }

  const resolved = groups.map((group) => {
    const span = spanForGroup(group, originals, currents);
    const hasCurrent = group.cis.length > 0;
    const currentStart = hasCurrent ? span.currentStart : currentText.length;
    const currentEnd = hasCurrent ? span.currentEnd : currentText.length;
    const original = group.ois.length
      ? originalText.slice(span.originalStart, span.originalEnd)
      : "";
    const current = hasCurrent
      ? currentText.slice(currentStart, currentEnd)
      : "";

    return {
      original,
      current,
      originalStart: span.originalStart,
      originalEnd: span.originalEnd,
      currentStart,
      currentEnd,
    };
  });

  const pairs: SentencePair[] = [];
  for (let index = 0; index < resolved.length; index += 1) {
    const item = resolved[index];
    if (!item.original && !item.current) continue;

    const key = `${item.original}\u0000${item.current}\u0000${index}`;
    pairs.push({
      id: `p-${hashText(key)}-${index}`,
      original: item.original,
      current: item.current,
      changed: item.original !== item.current,
      originalStart: item.originalStart,
      originalEnd: item.originalEnd,
      currentStart: item.currentStart,
      currentEnd: item.currentEnd,
    });
  }

  return pairs;
}

/* ------------------------------------------------------------------ */
/* Character-level diff                                                */
/* ------------------------------------------------------------------ */

const DIFF_TOKEN_RE =
  /[\u3400-\u4dbf\u4e00-\u9fff]|[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*|\s+|[^\s]/g;

function diffTokens(text: string): string[] {
  const tokens = text.match(DIFF_TOKEN_RE);
  return tokens ?? (text ? [text] : []);
}

/**
 * Token-level LCS diff. Input is capped at 2000 visible chars by the API, so the
 * O(n·m) table stays small. Returns plain text segments only; callers must never
 * inject AI output as HTML.
 */
export function computeDiff(original: string, revised: string): DiffSegment[] {
  if (original === revised) {
    return original ? [{ type: "equal", text: original }] : [];
  }

  const a = diffTokens(original);
  const b = diffTokens(revised);
  const n = a.length;
  const m = b.length;

  const table: Uint32Array[] = Array.from(
    { length: n + 1 },
    () => new Uint32Array(m + 1)
  );

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      table[i][j] =
        a[i - 1] === b[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }

  const reverse: DiffSegment[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      reverse.push({ type: "equal", text: a[i - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      reverse.push({ type: "insert", text: b[j - 1] });
      j -= 1;
    } else {
      reverse.push({ type: "delete", text: a[i - 1] });
      i -= 1;
    }
  }

  reverse.reverse();

  const segments: DiffSegment[] = [];
  for (const segment of reverse) {
    const last = segments[segments.length - 1];
    if (last && last.type === segment.type) {
      last.text += segment.text;
    } else {
      segments.push({ ...segment });
    }
  }

  return segments;
}

export type DiffRange = { start: number; end: number };

/** Ranges of the current text that changed (used to mark sentences). */
export function changedRanges(pairs: SentencePair[]): DiffRange[] {
  return pairs
    .filter((pair) => pair.changed && pair.current)
    .map((pair) => ({ start: pair.currentStart, end: pair.currentEnd }));
}