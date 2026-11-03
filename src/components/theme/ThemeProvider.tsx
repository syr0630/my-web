"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";
export type ThemeOrigin = { x: number; y: number };

type Wipe = {
  theme: Theme;
  x: number;
  y: number;
  shape: "circle" | "star";
  active: boolean;
};

type ThemeContextValue = {
  theme: Theme;
  mounted: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: (origin?: ThemeOrigin) => void;
};

const STORAGE_KEY = "draftly-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function preferredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable in private browsing.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#1a2030" : "#faf8f3");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const [wipe, setWipe] = useState<Wipe | null>(null);
  const timers = useRef<number[]>([]);
  const wipeRef = useRef<Wipe | null>(null);

  useEffect(() => {
    const initial = preferredTheme();
    setThemeState(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors.
    }
  }, [theme, mounted]);

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(
    (origin?: ThemeOrigin) => {
      const next: Theme = theme === "light" ? "dark" : "light";
      const reduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (reduced || typeof window === "undefined") {
        setThemeState(next);
        return;
      }

      if (wipeRef.current) {
        // A second click during the wipe should settle immediately instead of
        // being swallowed by the 700ms transition.
        timers.current.forEach((timer) => window.clearTimeout(timer));
        timers.current = [];
        const target =
          wipeRef.current.theme === theme ? next : theme;
        setThemeState(target);
        setWipe(null);
        wipeRef.current = null;
        return;
      }

      const point = origin ?? {
        x: window.innerWidth - 74,
        y: 34,
      };

      const nextWipe: Wipe = {
        theme: next,
        x: point.x,
        y: point.y,
        shape: theme === "light" ? "circle" : "star",
        active: false,
      };
      wipeRef.current = nextWipe;
      setWipe(nextWipe);

      // Two frames let the browser paint scale(0) before the grow transition.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const active = { ...nextWipe, active: true };
          wipeRef.current = active;
          setWipe(active);
        });
      });

      timers.current.push(
        window.setTimeout(() => {
          setThemeState(next);
        }, 700)
      );
      timers.current.push(
        window.setTimeout(() => {
          setWipe(null);
          wipeRef.current = null;
        }, 820)
      );
    },
    [theme]
  );

  const value = useMemo(
    () => ({ theme, mounted, setTheme, toggleTheme }),
    [theme, mounted, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {wipe ? (
        <span
          aria-hidden="true"
          className={`theme-wipe ${wipe.shape}`}
          data-active={wipe.active ? "true" : "false"}
          style={
            {
              left: wipe.x,
              top: wipe.y,
              "--wipe-bg": wipe.theme === "dark" ? "#1a2030" : "#faf8f3",
            } as CSSProperties
          }
        />
      ) : null}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}

export const themeStorageKey = STORAGE_KEY;