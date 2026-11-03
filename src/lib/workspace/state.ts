"use client";

import {
  useCallback,
  useRef,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";

type Entry = { value: unknown };
type Listener = () => void;

const STORAGE_PREFIX = "draftly.workspace.v1.";
const memory = new Map<string, Entry>();
const listeners = new Map<string, Set<Listener>>();

function initialValue<T>(initial: T | (() => T)): T {
  return typeof initial === "function" ? (initial as () => T)() : initial;
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(
      STORAGE_PREFIX + key,
      JSON.stringify(value)
    );
  } catch {
    // Storage can be unavailable or full; the in-memory copy still works.
  }
}

function ensureEntry<T>(
  key: string,
  initial: T | (() => T),
  persist: boolean
): Entry {
  const existing = memory.get(key);
  if (existing) return existing;
  const fallback = initialValue(initial);
  const value = persist ? readStored(key, fallback) : fallback;
  const entry: Entry = { value };
  memory.set(key, entry);
  return entry;
}

function emit(key: string): void {
  const set = listeners.get(key);
  if (!set) return;
  for (const listener of set) listener();
}

/**
 * Reads the current value without subscribing. Used by request callbacks that
 * may outlive the component that started them.
 */
export function getWorkspaceValue<T>(key: string): T | undefined {
  return memory.get(key)?.value as T | undefined;
}

export function setWorkspaceValue<T>(
  key: string,
  update: SetStateAction<T>,
  persist = true
): void {
  const entry = memory.get(key);
  if (!entry) return;
  const current = entry.value as T;
  const next =
    typeof update === "function"
      ? (update as (value: T) => T)(current)
      : update;
  if (Object.is(current, next)) return;
  entry.value = next;
  if (persist) writeStored(key, next);
  emit(key);
}

/**
 * Session-scoped workspace state.
 *
 * - Navigation between client routes keeps values in a module-level store.
 * - sessionStorage restores content after a full reload, but clears when the
 *   tab or browser closes.
 * - `persist: false` keeps progress flags and request errors in memory only, so
 *   a reload never leaves a page stuck on "processing".
 */
export function useWorkspaceState<T>(
  key: string,
  initial: T | (() => T),
  options: { persist?: boolean } = {}
): [T, Dispatch<SetStateAction<T>>] {
  const persist = options.persist ?? true;
  const initialRef = useRef<T | null>(null);
  if (initialRef.current === null) {
    initialRef.current = initialValue(initial);
  }
  const fallback = initialRef.current as T;

  const subscribe = useCallback(
    (listener: Listener) => {
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
      };
    },
    [key]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return fallback;
    return ensureEntry(key, fallback, persist).value as T;
  }, [fallback, key, persist]);

  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  const value = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setValue = useCallback(
    (update: SetStateAction<T>) => {
      if (typeof window === "undefined") return;
      ensureEntry(key, fallback, persist);
      setWorkspaceValue(key, update, persist);
    },
    [fallback, key, persist]
  );

  return [value, setValue];
}

export function clearWorkspaceKey(key: string): void {
  memory.delete(key);
  try {
    window.sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // Ignore unavailable storage.
  }
  emit(key);
}