"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/common/Icon";
import { Notice } from "@/components/common/Notice";
import { PageHeader } from "@/components/common/PageHeader";
import { StyleAnalysisEditor } from "@/components/style-profile/StyleAnalysisEditor";
import { StyleSampleImporter } from "@/components/style-profile/StyleSampleImporter";
import {
  RATING_LABELS,
  STYLE_COPY,
  STYLE_LIMITS,
} from "@/components/style-profile/copy";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useWorkspaceState } from "@/lib/workspace/state";
import {
  beginWorkspaceTask,
  cancelWorkspaceTask,
  finishWorkspaceTask,
  isWorkspaceTaskCurrent,
} from "@/lib/workspace/tasks";
import type {
  StyleAnalysis,
  StyleAnalysisResponse,
  StyleProfile,
  StyleProfileListResponse,
  StyleProfileResponse,
  StyleProfileSummary,
  StyleSample,
} from "@/types";

const USE_KEY = "draftly.styleProfileId";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function StyleProfileWorkspace() {
  const { uiLocale } = useLocale();
  const c = STYLE_COPY[uiLocale];
  const router = useRouter();

  const [profiles, setProfiles] = useState<StyleProfileSummary[]>([]);
  const [samples, setSamples] = useWorkspaceState<StyleSample[]>(
    "style.samples",
    []
  );
  const [analysis, setAnalysis] = useWorkspaceState<StyleAnalysis | null>(
    "style.analysis",
    null
  );
  const [name, setName] = useWorkspaceState("style.name", "");
  const [activeId, setActiveId] = useWorkspaceState<string | null>(
    "style.activeId",
    null
  );

  const [loadingList, setLoadingList] = useWorkspaceState<boolean>(
    "style.loadingList",
    true,
    { persist: false }
  );
  const [analyzing, setAnalyzing] = useWorkspaceState<boolean>(
    "style.analyzing",
    false,
    { persist: false }
  );
  const [saving, setSaving] = useWorkspaceState<boolean>(
    "style.saving",
    false,
    { persist: false }
  );
  const [deletingId, setDeletingId] = useWorkspaceState<string | null>(
    "style.deletingId",
    null,
    { persist: false }
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useWorkspaceState<string | null>(
    "style.error",
    null,
    { persist: false }
  );
  const [notice, setNotice] = useWorkspaceState<string | null>(
    "style.notice",
    null,
    { persist: false }
  );
  const listAbort = useRef<AbortController | null>(null);

  const totalChars = samples.reduce((sum, sample) => sum + sample.chars, 0);
  const activeProfile = profiles.find((profile) => profile.id === activeId);

  const loadProfiles = useCallback(async () => {
    listAbort.current?.abort();
    const controller = new AbortController();
    listAbort.current = controller;
    setLoadingList(true);
    try {
      const data = await apiGet<StyleProfileListResponse>("/api/style-profile", {
        signal: controller.signal,
      });
      setProfiles(data.profiles);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError(errorMessage(caught, c.loadFailed));
      }
    } finally {
      if (listAbort.current === controller) {
        setLoadingList(false);
        listAbort.current = null;
      }
    }
  }, [c.loadFailed, setError, setLoadingList]);

  useEffect(() => {
    void loadProfiles();
    return () => listAbort.current?.abort();
  }, [loadProfiles]);

  function resetEditor() {
    cancelWorkspaceTask("style.analyze");
    setAnalyzing(false);
    setActiveId(null);
    setSamples([]);
    setAnalysis(null);
    setName("");
    setError(null);
    setNotice(null);
    setConfirmDeleteId(null);
    setRenameId(null);
  }

  function addSamples(incoming: StyleSample[]) {
    cancelWorkspaceTask("style.analyze");
    setAnalyzing(false);
    setError(null);
    const merged = [...samples];
    let total = totalChars;
    for (const sample of incoming) {
      if (merged.length >= STYLE_LIMITS.maxSamples) {
        setError(c.maxSamples);
        break;
      }
      if (total + sample.chars > STYLE_LIMITS.maxTotalChars) {
        setError(c.maxChars);
        break;
      }
      merged.push(sample);
      total += sample.chars;
    }
    setSamples(merged);
  }

  async function analyze() {
    if (!samples.length || totalChars < 20) {
      setError(c.noAnalysis);
      return;
    }
    const task = beginWorkspaceTask("style.analyze");
    setAnalyzing(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiPost<StyleAnalysisResponse>(
        "/api/style-profile/analyze",
        { samples },
        { signal: task.controller.signal }
      );
      if (!isWorkspaceTaskCurrent("style.analyze", task.epoch)) return;
      setAnalysis(data.analysis);
      if (!name.trim()) {
        setName(
          samples[0]?.sourceType === "paste"
            ? c.untitledSample
            : samples[0]?.name.replace(/\.[^.]+$/, "") || c.title
        );
      }
      setNotice(c.analysisReady);
    } catch (caught) {
      if (
        isWorkspaceTaskCurrent("style.analyze", task.epoch) &&
        !(caught instanceof DOMException && caught.name === "AbortError")
      ) {
        setError(errorMessage(caught, c.failed));
      }
    } finally {
      if (isWorkspaceTaskCurrent("style.analyze", task.epoch)) {
        setAnalyzing(false);
        finishWorkspaceTask("style.analyze", task.epoch);
      }
    }
  }

  async function save() {
    if (!analysis) {
      setError(c.noAnalysis);
      return;
    }
    if (!name.trim()) {
      setError(c.nameRequired);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = activeId
        ? await apiPatch<StyleProfileResponse>(`/api/style-profile/${activeId}`, {
            name,
            analysis,
            samples,
          })
        : await apiPost<StyleProfileResponse>("/api/style-profile", {
            name,
            analysis,
            samples,
          });
      applyProfile(data.profile);
      setNotice(activeId ? c.updatedNotice : c.saved);
      await loadProfiles();
    } catch (caught) {
      setError(errorMessage(caught, c.failed));
    } finally {
      setSaving(false);
    }
  }

  function applyProfile(profile: StyleProfile) {
    cancelWorkspaceTask("style.analyze");
    setAnalyzing(false);
    setActiveId(profile.id);
    setName(profile.name);
    setAnalysis(profile.analysis);
    setSamples(profile.samples);
    setNotice(null);
  }

  async function openProfile(id: string) {
    setError(null);
    setNotice(null);
    try {
      const data = await apiGet<StyleProfileResponse>(`/api/style-profile/${id}`);
      applyProfile(data.profile);
    } catch (caught) {
      setError(errorMessage(caught, c.failed));
    }
  }

  async function removeProfile(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      await apiDelete(`/api/style-profile/${id}`);
      if (activeId === id) resetEditor();
      setProfiles((current) => current.filter((profile) => profile.id !== id));
      setNotice(c.deletedNotice);
      setConfirmDeleteId(null);
    } catch (caught) {
      setError(errorMessage(caught, c.failed));
    } finally {
      setDeletingId(null);
    }
  }

  async function saveRename(id: string) {
    if (!renameValue.trim()) return;
    setError(null);
    try {
      const data = await apiPatch<StyleProfileResponse>(
        `/api/style-profile/${id}`,
        { name: renameValue.trim() }
      );
      setProfiles((current) =>
        current.map((profile) =>
          profile.id === id
            ? { ...profile, name: data.profile.name, updatedAt: data.profile.updatedAt }
            : profile
        )
      );
      if (activeId === id) setName(data.profile.name);
      setRenameId(null);
      setRenameValue("");
    } catch (caught) {
      setError(errorMessage(caught, c.failed));
    }
  }

  function useInPolisher() {
    if (!activeId) return;
    try {
      sessionStorage.setItem(USE_KEY, activeId);
    } catch {
      // sessionStorage can be unavailable in hardened browsers.
    }
    router.push("/polisher");
  }

  const canSave = Boolean(analysis) && Boolean(name.trim()) && totalChars >= 20;

  return (
    <div className="space-y-5">
      <PageHeader
        title={c.title}
        subtitle={c.subtitle}
        icon="spark"
        eyebrow={c.eyebrow}
        badge={
          <span className="chip">
            <Icon name="shield" size={12} />
            {c.badge}
          </span>
        }
      />

      <Notice tone="info">
        <span className="text-xs leading-relaxed">{c.privacy}</span>
      </Notice>

      {error ? (
        <Notice tone="error" onRetry={loadProfiles} retryLabel={c.retry}>
          {error}
        </Notice>
      ) : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="style-layout grid gap-5">
        <div className="style-main space-y-5">
          <StyleSampleImporter
            samples={samples}
            onAdd={addSamples}
            onRemove={(id) => {
              cancelWorkspaceTask("style.analyze");
              setAnalyzing(false);
              setSamples((current) =>
                current.filter((sample) => sample.id !== id)
              );
            }}
            disabled={analyzing || saving}
          />

          {!analysis ? (
            <section className="app-card p-5">
              <h2 className="section-title text-base">{c.analysisTitle}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {c.analysisEmpty}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={analyze}
                  disabled={analyzing || samples.length === 0 || totalChars < 20}
                  data-testid="style-analyze"
                >
                  <Icon name={analyzing ? "loader" : "sparkles"} size={16} />
                  {analyzing ? c.analyzing : c.analyze}
                </button>
                <button type="button" className="btn btn-ghost" onClick={resetEditor}>
                  {c.newProfile}
                </button>
              </div>
              {analyzing ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />
                  {c.analyzing}
                </p>
              ) : null}
            </section>
          ) : (
            <StyleAnalysisEditor
              name={name}
              onNameChange={setName}
              analysis={analysis}
              onChange={setAnalysis}
              activeProfile={Boolean(activeId)}
              saving={saving}
              canSave={canSave}
              onSave={save}
              onAnalyze={analyze}
              analyzing={analyzing}
              sampleCount={samples.length}
              totalChars={totalChars}
            />
          )}

          {activeId ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--primary-softer)] px-4 py-3">
              <p className="text-xs text-[var(--primary-strong)]">
                {activeProfile ? activeProfile.name : name}
              </p>
              <button
                type="button"
                className="btn btn-secondary !min-h-[40px]"
                onClick={useInPolisher}
                data-testid="style-use-in-polisher"
              >
                <Icon name="arrowRight" size={16} />
                {c.useInPolisher}
              </button>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="app-card p-4" data-testid="style-profile-list">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-title text-base">{c.savedTitle}</h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="btn btn-secondary !min-h-[34px] !px-2.5 text-xs"
                  onClick={resetEditor}
                  title={c.newProfile}
                >
                  <Icon name="spark" size={13} />
                  {c.newProfile}
                </button>
                <span className="chip">
                  {profiles.length}/{STYLE_LIMITS.maxProfiles}
                </span>
              </div>
            </div>

            {loadingList ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                <Icon name="loader" size={14} />
                {c.loadingProfiles}
              </p>
            ) : profiles.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {c.savedEmpty}
              </p>
            ) : (
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {profiles.map((profile) => (
                  <li
                    key={profile.id}
                    className={`rounded-xl border p-3 ${
                      profile.id === activeId
                        ? "border-[var(--primary)] bg-[var(--primary-softer)]"
                        : "border-[var(--border)] bg-[var(--surface)]"
                    }`}
                  >
                    {renameId === profile.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className="textarea !min-h-[38px] !w-auto flex-1 !py-1.5 text-sm"
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          maxLength={60}
                          aria-label={c.rename}
                        />
                        <button
                          type="button"
                          className="btn btn-primary !min-h-[36px] !px-2.5"
                          onClick={() => void saveRename(profile.id)}
                        >
                          {c.renameSave}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost !min-h-[36px] !px-2"
                          onClick={() => setRenameId(null)}
                        >
                          {c.cancel}
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => void openProfile(profile.id)}
                        >
                          <span className="block truncate text-sm font-semibold text-slate-800">
                            {profile.name}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-muted">
                            {profile.summary}
                          </span>
                        </button>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                          <span className="chip !px-2 !py-0.5">
                            {RATING_LABELS[profile.confidence][
                              uiLocale === "en" ? "en" : "zh"
                            ]}
                          </span>
                          <span>
                            {profile.sampleCount} {c.samples} · {profile.sampleChars}{" "}
                            {c.chars}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost !min-h-[34px] !px-2 text-xs"
                            onClick={() => {
                              setRenameId(profile.id);
                              setRenameValue(profile.name);
                            }}
                          >
                            {c.rename}
                          </button>
                          <button
                            type="button"
                            className={`btn !min-h-[34px] !px-2 text-xs ${
                              confirmDeleteId === profile.id
                                ? "btn-danger"
                                : "btn-ghost"
                            }`}
                            onClick={() => void removeProfile(profile.id)}
                            disabled={deletingId === profile.id}
                          >
                            {deletingId === profile.id
                              ? c.deleting
                              : confirmDeleteId === profile.id
                                ? c.deleteConfirm
                                : c.delete}
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="app-card-flat p-4" data-testid="style-tips">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Icon name="spark" size={16} className="text-[var(--primary)]" />
              {c.tipsTitle}
            </h2>
            <ul className="mt-2 space-y-2 text-[11px] leading-relaxed text-muted">
              {[c.tip1, c.tip2, c.tip3].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <Icon
                    name="check"
                    size={13}
                    className="mt-0.5 shrink-0 text-[var(--success)]"
                  />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-[var(--border)] pt-2 text-[11px] leading-relaxed text-muted">
              {c.limitation}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
