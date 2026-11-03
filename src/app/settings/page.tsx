"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { PageHeader } from "@/components/common/PageHeader";
import { apiGet } from "@/lib/api/client";
import { isAbortError } from "@/lib/api/display-error";
import { MAX_VISIBLE_CHARS } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { ContentLanguage, HealthResponse, UiLocale } from "@/types";

const APP_VERSION = "0.1.0";

const CONTENT_OPTIONS: { value: ContentLanguage; labelKey: "auto" | "zh" | "en" | "mixed" }[] = [
  { value: "auto", labelKey: "auto" },
  { value: "zh-CN", labelKey: "zh" },
  { value: "en", labelKey: "en" },
  { value: "mixed", labelKey: "mixed" },
];

export default function SettingsPage() {
  const {
    t,
    uiLocale,
    setUiLocale,
    contentLanguage,
    setContentLanguage,
    clearLocalPreferences,
  } = useLocale();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [healthLoading, setHealthLoading] = useState(true);
  const [cleared, setCleared] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const clearTimer = useRef<number | null>(null);

  const loadHealth = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setHealthLoading(true);
    setHealthError(false);

    try {
      const data = await apiGet<HealthResponse>("/api/v1/health", {
        signal: controller.signal,
      });
      setHealth(data);
    } catch (error) {
      if (!isAbortError(error)) setHealthError(true);
    } finally {
      if (abortRef.current === controller) {
        setHealthLoading(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void loadHealth();
    return () => {
      abortRef.current?.abort();
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
    };
  }, [loadHealth]);

  function handleClear() {
    clearLocalPreferences();
    setCleared(true);
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => setCleared(false), 2800);
  }

  const localeOptions: { value: UiLocale; label: string }[] = [
    { value: "zh-CN", label: "简体中文" },
    { value: "en", label: "English" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.settings.title}
        subtitle={t.settings.subtitle}
        icon="sliders"
        eyebrow="Draftly"
        meta={
          <span className="chip">
            <Icon name="text" size={12} />
            {MAX_VISIBLE_CHARS} {t.common.chars}
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="app-card space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Icon name="globe" size={16} className="text-[var(--primary)]" />
              {t.settings.uiLocale}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {t.settings.uiLocaleHint}
            </p>
            <div className="segmented mt-3" role="group" aria-label={t.settings.uiLocale}>
              {localeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="segmented-item text-sm"
                  aria-pressed={uiLocale === option.value}
                  onClick={() => setUiLocale(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Icon name="text" size={16} className="text-[var(--primary)]" />
              {t.settings.contentLanguage}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {t.settings.contentLanguageHint}
            </p>
            <div className="segmented mt-3" role="group" aria-label={t.settings.contentLanguage}>
              {CONTENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="segmented-item"
                  aria-pressed={contentLanguage === option.value}
                  onClick={() => setContentLanguage(option.value)}
                >
                  {t.common[option.labelKey]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="app-card space-y-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Icon name="spark" size={16} className="text-[var(--primary)]" />
              {t.settings.aiStatusTitle}
            </h2>
            <button
              type="button"
              className="btn btn-secondary !min-h-[32px] !px-2.5 !py-1 !text-xs"
              onClick={() => {
                void loadHealth();
              }}
              disabled={healthLoading}
            >
              <Icon
                name={healthLoading ? "loader" : "refresh"}
                size={13}
                className={healthLoading ? "spin" : undefined}
              />
              {t.common.retry}
            </button>
          </div>

          {healthLoading && !health ? (
            <div className="space-y-2" aria-hidden="true">
              <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
            </div>
          ) : null}

          {health ? (
            <div className="space-y-2.5" data-testid="ai-status">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    health.aiConfigured
                      ? "bg-[var(--success)] shadow-[0_0_0_3px_var(--success-bg)]"
                      : "bg-[var(--danger)] shadow-[0_0_0_3px_var(--danger-bg)]"
                  }`}
                />
                {health.aiConfigured
                  ? t.settings.aiConfigured
                  : t.settings.aiNotConfigured}
              </p>
              {health.model ? (
                <p className="text-xs text-muted">
                  {t.settings.aiModel} ·{" "}
                  <span className="font-mono text-[11px] text-slate-600">
                    {health.model}
                  </span>
                </p>
              ) : null}
              {!health.aiConfigured ? (
                <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--text)]">
                  {t.errors.AI_NOT_CONFIGURED}
                </p>
              ) : null}
            </div>
          ) : null}

          {healthError ? (
            <p className="text-xs text-[var(--danger)]">
              {t.settings.aiStatusError}
            </p>
          ) : null}

          <p className="text-[11px] leading-relaxed text-slate-400">
            {t.settings.aiStatusHint}
          </p>
        </section>

        <section className="app-card space-y-3 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Icon name="text" size={16} className="text-[var(--primary)]" />
            {t.settings.limitTitle}
          </h2>
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-[var(--text)]">
              {MAX_VISIBLE_CHARS}
            </span>
            <span className="text-xs text-muted">{t.common.chars}</span>
          </p>
          <p className="text-xs leading-relaxed text-muted">
            {t.settings.limitBody}
          </p>
        </section>

        <section className="app-card space-y-3 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Icon name="shield" size={16} className="text-[var(--success)]" />
            {t.settings.privacyTitle}
          </h2>
          <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
            {[
              t.settings.privacy1,
              t.settings.privacy2,
              t.settings.privacy3,
              t.settings.privacy4,
              t.settings.privacy5,
              t.settings.privacy6,
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Icon
                  name="check"
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--success)]"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="app-card space-y-4 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Icon name="lock" size={16} className="text-[var(--primary)]" />
            {t.settings.localTitle}
          </h2>
          <p className="text-xs leading-relaxed text-muted">
            {t.settings.localBody}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary !min-h-[36px] !text-xs"
              onClick={handleClear}
            >
              <Icon name="trash" size={14} />
              {t.settings.clearLocal}
            </button>
            {cleared ? (
              <span
                className="inline-flex items-center gap-1 text-xs text-[var(--success)]"
                role="status"
              >
                <Icon name="check" size={13} />
                {t.settings.clearLocalDone}
              </span>
            ) : null}
          </div>
        </section>

        <section className="app-card space-y-3 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Icon name="info" size={16} className="text-[var(--primary)]" />
            {t.settings.aboutTitle}
          </h2>
          <p className="text-xs leading-relaxed text-muted">
            {t.settings.aboutBody}
          </p>
          <p className="text-xs text-slate-500">
            {t.settings.version} {APP_VERSION}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/polisher"
              className="chip hover:border-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              {t.nav.polisher}
            </Link>
            <Link
              href="/humanize"
              className="chip hover:border-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              {t.nav.humanize}
            </Link>
            <Link
              href="/translate"
              className="chip hover:border-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              {t.nav.translate}
            </Link>
            <Link
              href="/grammar"
              className="chip hover:border-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              {t.nav.grammar}
            </Link>
            <Link
              href="/ai-detector"
              className="chip hover:border-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              {t.nav.detector}
            </Link>
            <Link
              href="/tools/style-profile"
              className="chip hover:border-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              {t.nav.style}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}


