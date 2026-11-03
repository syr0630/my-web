"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getMessages,
  isUiLocale,
  type Messages,
} from "@/lib/i18n/messages";
import type { ContentLanguage, UiLocale } from "@/types";

type LocaleContextValue = {
  uiLocale: UiLocale;
  setUiLocale: (locale: UiLocale) => void;
  contentLanguage: ContentLanguage;
  setContentLanguage: (lang: ContentLanguage) => void;
  clearLocalPreferences: () => void;
  ready: boolean;
  t: Messages;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const UI_KEY = "draftly.uiLocale";
const CONTENT_KEY = "draftly.contentLanguage";

const CONTENT_LANGUAGES: ContentLanguage[] = ["auto", "zh-CN", "en", "mixed"];

function isContentLanguage(value: unknown): value is ContentLanguage {
  return CONTENT_LANGUAGES.includes(value as ContentLanguage);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [uiLocale, setUiLocaleState] = useState<UiLocale>("zh-CN");
  const [contentLanguage, setContentLanguageState] =
    useState<ContentLanguage>("auto");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const storedUi = localStorage.getItem(UI_KEY);
      const storedContent = localStorage.getItem(CONTENT_KEY);
      if (isUiLocale(storedUi)) setUiLocaleState(storedUi);
      if (isContentLanguage(storedContent)) {
        setContentLanguageState(storedContent);
      }
    } catch {
      /* localStorage can be unavailable in private contexts */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = uiLocale === "zh-CN" ? "zh-CN" : "en";
  }, [uiLocale, ready]);

  const setUiLocale = useCallback((locale: UiLocale) => {
    setUiLocaleState(locale);
    try {
      localStorage.setItem(UI_KEY, locale);
    } catch {
      /* ignore */
    }
  }, []);

  const setContentLanguage = useCallback((lang: ContentLanguage) => {
    setContentLanguageState(lang);
    try {
      localStorage.setItem(CONTENT_KEY, lang);
    } catch {
      /* ignore */
    }
  }, []);

  const clearLocalPreferences = useCallback(() => {
    try {
      localStorage.removeItem(UI_KEY);
      localStorage.removeItem(CONTENT_KEY);
    } catch {
      /* ignore */
    }
    setUiLocaleState("zh-CN");
    setContentLanguageState("auto");
  }, []);

  const value = useMemo(
    () => ({
      uiLocale,
      setUiLocale,
      contentLanguage,
      setContentLanguage,
      clearLocalPreferences,
      ready,
      t: getMessages(uiLocale),
    }),
    [
      uiLocale,
      setUiLocale,
      contentLanguage,
      setContentLanguage,
      clearLocalPreferences,
      ready,
    ]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}