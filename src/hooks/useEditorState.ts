"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  buildSentencePairs,
  explanationKey,
  pairKey,
} from "@/lib/diff/text-diff";
import {
  getWorkspaceValue,
  useWorkspaceState,
} from "@/lib/workspace/state";
import type { ResolvedLanguage, SentencePair } from "@/types";

const HISTORY_LIMIT = 50;
const TYPING_BURST_MS = 700;

function newVersion(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

type EditorState = {
  originalText: string;
  generatedText: string;
  currentText: string;
  sourceVersion: string;
  detectedLanguage: ResolvedLanguage;
  past: string[];
  future: string[];
  lastEditAt: number;
  altByKey: Record<string, string[]>;
  explainByKey: Record<string, string>;
};

type Action =
  | { type: "setOriginal"; text: string; version: string }
  | { type: "typeCurrent"; text: string; at: number }
  | { type: "commitCurrent"; text: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "applyAi"; text: string; language: ResolvedLanguage }
  | { type: "applyRevision"; text: string }
  | { type: "clear"; version: string }
  | { type: "setAlternatives"; key: string; alternatives: string[] }
  | { type: "setExplanation"; key: string; explanation: string };

function pushPast(past: string[], value: string): string[] {
  return [...past, value].slice(-HISTORY_LIMIT);
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "setOriginal": {
      if (action.text === state.originalText) return state;
      return {
        ...state,
        originalText: action.text,
        sourceVersion: action.version,
        lastEditAt: 0,
      };
    }

    case "typeCurrent": {
      if (action.text === state.currentText) return state;
      const startsBurst = action.at - state.lastEditAt > TYPING_BURST_MS;
      return {
        ...state,
        currentText: action.text,
        past: startsBurst
          ? pushPast(state.past, state.currentText)
          : state.past,
        future: startsBurst ? [] : state.future,
        lastEditAt: action.at,
      };
    }

    case "commitCurrent": {
      if (action.text === state.currentText) return state;
      return {
        ...state,
        currentText: action.text,
        past: pushPast(state.past, state.currentText),
        future: [],
        lastEditAt: 0,
      };
    }

    case "applyAi": {
      return {
        ...state,
        generatedText: action.text,
        currentText: action.text,
        detectedLanguage: action.language,
        past:
          action.text === state.currentText
            ? state.past
            : pushPast(state.past, state.currentText),
        future: [],
        lastEditAt: 0,
      };
    }

    case "applyRevision": {
      if (action.text === state.currentText) return state;
      return {
        ...state,
        generatedText: action.text,
        currentText: action.text,
        past: pushPast(state.past, state.currentText),
        future: [],
        lastEditAt: 0,
      };
    }

    case "undo": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        currentText: previous,
        past: state.past.slice(0, -1),
        future: [state.currentText, ...state.future].slice(0, HISTORY_LIMIT),
        lastEditAt: 0,
      };
    }

    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        currentText: next,
        past: pushPast(state.past, state.currentText),
        future: rest,
        lastEditAt: 0,
      };
    }

    case "clear": {
      return {
        originalText: "",
        generatedText: "",
        currentText: "",
        sourceVersion: action.version,
        detectedLanguage: "zh-CN",
        past: [],
        future: [],
        lastEditAt: 0,
        altByKey: {},
        explainByKey: {},
      };
    }

    case "setAlternatives": {
      return {
        ...state,
        altByKey: { ...state.altByKey, [action.key]: action.alternatives },
      };
    }

    case "setExplanation": {
      return {
        ...state,
        explainByKey: {
          ...state.explainByKey,
          [action.key]: action.explanation,
        },
      };
    }

    default:
      return state;
  }
}

function createInitialState(): EditorState {
  return {
    originalText: "",
    generatedText: "",
    currentText: "",
    sourceVersion: newVersion(),
    detectedLanguage: "zh-CN",
    past: [],
    future: [],
    lastEditAt: 0,
    altByKey: {},
    explainByKey: {},
  };
}

export type ApplyResult = "applied" | "stale";

/**
 * Shared editor state for both Polisher and Humanize.
 *
 * - originalText / generatedText / currentText / sourceVersion are kept apart.
 * - Sentence pairs are derived from original + current, so highlights always
 *   match real text; local restore replaces an exact span.
 * - Any edit to the original bumps sourceVersion. A response whose version no
 *   longer matches is discarded instead of overwriting newer edits.
 */
export function useEditorState(workspace = "default") {
  const storageKey = `editor.${workspace}`;
  const [state, setState] = useWorkspaceState<EditorState>(
    storageKey,
    createInitialState
  );

  const dispatch = useCallback(
    (action: Action) => {
      setState((current) => reducer(current, action));
    },
    [setState]
  );

  const sourceVersionRef = useRef(state.sourceVersion);
  const originalRef = useRef(state.originalText);
  const currentRef = useRef(state.currentText);
  const seqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const requestRef = useRef<{
    seq: number;
    version: string;
    original: string;
    currentAtStart: string;
  } | null>(null);

  // These refs are also used by request callbacks that outlive this component.
  // Keep them aligned with the shared state after a route remount.
  sourceVersionRef.current = state.sourceVersion;
  originalRef.current = state.originalText;
  currentRef.current = state.currentText;

  const pairs = useMemo<SentencePair[]>(() => {
    const base = buildSentencePairs(state.originalText, state.currentText);
    return base.map((pair) => {
      const alternatives = state.altByKey[pairKey(pair)];
      const explanation = state.explainByKey[explanationKey(pair)];
      return {
        ...pair,
        alternatives,
        explanation,
      };
    });
  }, [
    state.originalText,
    state.currentText,
    state.altByKey,
    state.explainByKey,
  ]);

  const setOriginalText = useCallback((text: string) => {
    const version = newVersion();
    sourceVersionRef.current = version;
    originalRef.current = text;
    dispatch({ type: "setOriginal", text, version });
  }, [dispatch]);

  const setCurrentText = useCallback((text: string) => {
    currentRef.current = text;
    dispatch({ type: "typeCurrent", text, at: Date.now() });
  }, [dispatch]);

  const beginRequest = useCallback(() => {
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    const request = {
      seq,
      version: sourceVersionRef.current,
      original: originalRef.current,
      currentAtStart: currentRef.current,
    };
    requestRef.current = request;
    return request;
  }, []);

  const applyAiResult = useCallback(
    (opts: {
      text: string;
      sourceVersion: string;
      language: ResolvedLanguage;
      seq: number;
    }): ApplyResult => {
      const request = requestRef.current;
      const latest =
        getWorkspaceValue<EditorState>(storageKey) ?? state;
      const stale =
        !request ||
        request.seq !== opts.seq ||
        opts.seq <= appliedSeqRef.current ||
        opts.sourceVersion !== request.version ||
        latest.sourceVersion !== opts.sourceVersion ||
        latest.originalText !== request.original ||
        latest.currentText !== request.currentAtStart;

      if (stale) return "stale";

      appliedSeqRef.current = opts.seq;
      dispatch({
        type: "applyAi",
        text: opts.text,
        language: opts.language,
      });
      return "applied";
    },
    [state, storageKey, dispatch]
  );

  const replaceSpan = useCallback(
    (pair: SentencePair, replacement: string) => {
      const current = currentRef.current;
      const next =
        current.slice(0, pair.currentStart) +
        replacement +
        current.slice(pair.currentEnd);
      currentRef.current = next;
      dispatch({ type: "commitCurrent", text: next });
    },
    [dispatch]
  );

  /**
   * Replace exactly one current-text span. Used by interactive word suggestions:
   * global string replacement is deliberately not offered, so another occurrence
   * of the same word is never touched. Returns false if the span went stale.
   */
  const replaceRange = useCallback(
    (
      start: number,
      end: number,
      replacement: string,
      expected?: string
    ): boolean => {
      const current = currentRef.current;
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end <= start ||
        end > current.length
      ) {
        return false;
      }
      if (expected !== undefined && current.slice(start, end) !== expected) {
        return false;
      }
      const next =
        current.slice(0, start) + replacement + current.slice(end);
      currentRef.current = next;
      dispatch({ type: "commitCurrent", text: next });
      return true;
    },
    [dispatch]
  );

  /**
   * Apply a full style revision while keeping one undo step. Used by the
   * Style Consistency panel, which is a second pass rather than a new polish.
   */
  const applyFullText = useCallback((text: string): boolean => {
    if (text === currentRef.current) return false;
    currentRef.current = text;
    dispatch({ type: "applyRevision", text });
    return true;
  }, [dispatch]);

  const restoreSentence = useCallback(
    (id: string) => {
      const pair = pairs.find((item) => item.id === id);
      if (!pair) return;
      replaceSpan(pair, pair.original);
    },
    [pairs, replaceSpan]
  );

  const applyAlternative = useCallback(
    (id: string, alternative: string) => {
      const pair = pairs.find((item) => item.id === id);
      if (!pair) return;
      replaceSpan(pair, alternative);
    },
    [pairs, replaceSpan]
  );

  const setSentenceAlternatives = useCallback(
    (id: string, alternatives: string[]) => {
      const pair = pairs.find((item) => item.id === id);
      if (!pair) return;
      dispatch({
        type: "setAlternatives",
        key: pairKey(pair),
        alternatives,
      });
    },
    [pairs, dispatch]
  );

  const setSentenceExplanation = useCallback(
    (id: string, explanation: string) => {
      const pair = pairs.find((item) => item.id === id);
      if (!pair) return;
      dispatch({
        type: "setExplanation",
        key: explanationKey(pair),
        explanation,
      });
    },
    [pairs, dispatch]
  );

  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);

  const clearAll = useCallback(() => {
    const version = newVersion();
    sourceVersionRef.current = version;
    originalRef.current = "";
    currentRef.current = "";
    requestRef.current = null;
    dispatch({ type: "clear", version });
  }, [dispatch]);

  const changedPairs = useMemo(
    () => pairs.filter((pair) => pair.changed && pair.current),
    [pairs]
  );

  return {
    originalText: state.originalText,
    generatedText: state.generatedText,
    currentText: state.currentText,
    sourceVersion: state.sourceVersion,
    detectedLanguage: state.detectedLanguage,
    pairs,
    changedPairs,
    setOriginalText,
    setCurrentText,
    beginRequest,
    applyAiResult,
    restoreSentence,
    applyAlternative,
    replaceRange,
    applyFullText,
    setSentenceAlternatives,
    setSentenceExplanation,
    undo,
    redo,
    clearAll,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}

export type EditorStateApi = ReturnType<typeof useEditorState>;