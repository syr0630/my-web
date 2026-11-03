"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { IntensityPicker } from "@/components/common/IntensityPicker";
import { LanguageSelect } from "@/components/common/LanguageSelect";
import { Notice } from "@/components/common/Notice";
import { PageHeader } from "@/components/common/PageHeader";
import { DualPaneEditor } from "@/components/editor/DualPaneEditor";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { SentencePanel } from "@/components/editor/SentencePanel";
import { StyleConsistencyPanel } from "@/components/editor/StyleConsistencyPanel";
import { StyleProfilePicker } from "@/components/editor/StyleProfilePicker";
import { ScenePicker } from "@/components/polisher/ScenePicker";
import { StandardPicker } from "@/components/polisher/StandardPicker";
import { useEditorState } from "@/hooks/useEditorState";
import { apiGet, apiPost } from "@/lib/api/client";
import {
  isAbortError,
  toDisplayError,
  type DisplayError,
} from "@/lib/api/display-error";
import { MAX_VISIBLE_CHARS, type WritingScene } from "@/lib/constants";
import { takeHandoff } from "@/lib/handoff";
import { isLanguageReliable } from "@/lib/language/detect";
import { countVisibleChars } from "@/lib/text/char-count";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  beginWorkspaceTask,
  cancelWorkspaceTask,
  finishWorkspaceTask,
  isWorkspaceTaskCurrent,
} from "@/lib/workspace/tasks";
import { useWorkspaceState } from "@/lib/workspace/state";
import type {
  AiTransformResponse,
  ContentLanguage,
  Intensity,
  PolishStandard,
  StyleProfileListResponse,
  StyleProfileSummary,
} from "@/types";

type Mode = "polish" | "humanize";

type Props = {
  mode: Mode;
};

const EXAMPLE_ZH =
  "随着科技的不断发展，人们的生活水平得到了显著的提高，但是在另一方面，也带来了一些不可忽视的问题。";
const EXAMPLE_EN =
  "With the rapid development of technology, people's living standards have improved a lot, but on the other hand, it also brings some problems that cannot be ignored.";

export function TransformWorkspace({ mode }: Props) {
  const { t, uiLocale, contentLanguage: defaultLanguage } = useLocale();
  const editor = useEditorState(mode);

  const [contentLanguage, setContentLanguage] =
    useState<ContentLanguage>(defaultLanguage);
  const [intensity, setIntensity] = useWorkspaceState<Intensity>(
    `${mode}.intensity`,
    "moderate"
  );
  const [standard, setStandard] = useWorkspaceState<PolishStandard>(
    `${mode}.standard`,
    "standard"
  );
  const [scene, setScene] = useWorkspaceState<WritingScene | "">(
    `${mode}.scene`,
    ""
  );
  const [loading, setLoading] = useWorkspaceState<boolean>(
    `${mode}.loading`,
    false,
    { persist: false }
  );
  const [error, setError] = useWorkspaceState<DisplayError | null>(
    `${mode}.error`,
    null,
    { persist: false }
  );
  const [info, setInfo] = useWorkspaceState<string | null>(
    `${mode}.info`,
    null,
    { persist: false }
  );
  const [styleProfiles, setStyleProfiles] = useState<StyleProfileSummary[]>([]);
  const [styleProfilesLoading, setStyleProfilesLoading] = useState(true);
  const [styleProfilesReady, setStyleProfilesReady] = useState(false);
  const [styleProfileId, setStyleProfileId] = useState<string | null>(null);
  const [styleAnalysisToken, setStyleAnalysisToken] = useState(0);

  const languageTouched = useRef(false);
  const styleAbortRef = useRef<AbortController | null>(null);

  const loadStyleProfiles = useCallback(async () => {
    styleAbortRef.current?.abort();
    const controller = new AbortController();
    styleAbortRef.current = controller;
    setStyleProfilesLoading(true);
    try {
      const data = await apiGet<StyleProfileListResponse>("/api/style-profile", {
        signal: controller.signal,
      });
      setStyleProfiles(data.profiles);
      setStyleProfilesReady(true);
    } catch {
      // Style profiles are optional; polish still works with the default style.
    } finally {
      if (styleAbortRef.current === controller) {
        setStyleProfilesLoading(false);
        styleAbortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void loadStyleProfiles();
    try {
      const handoff = sessionStorage.getItem("draftly.styleProfileId");
      if (handoff) {
        setStyleProfileId(handoff);
        sessionStorage.removeItem("draftly.styleProfileId");
      }
    } catch {
      // Ignore unavailable sessionStorage.
    }
    return () => styleAbortRef.current?.abort();
  }, [loadStyleProfiles]);

  useEffect(() => {
    if (
      styleProfilesReady &&
      styleProfileId &&
      !styleProfiles.some((profile) => profile.id === styleProfileId)
    ) {
      setStyleProfileId(null);
      setStyleAnalysisToken(0);
    }
  }, [styleProfiles, styleProfilesReady, styleProfileId]);

  useEffect(() => {
    if (!languageTouched.current) {
      setContentLanguage(defaultLanguage);
    }
  }, [defaultLanguage]);

  useEffect(() => {
    const handoff = takeHandoff(mode === "polish" ? "polisher" : "humanize");
    if (handoff) {
      editor.setOriginalText(handoff.slice(0, MAX_VISIBLE_CHARS));
      setContentLanguage("auto");
    }
    // The handoff is consumed once per page entry; editor callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const charCount = countVisibleChars(editor.originalText);
  const overLimit = charCount > MAX_VISIBLE_CHARS;
  const unreliable =
    contentLanguage === "auto" &&
    editor.originalText.trim().length > 0 &&
    !isLanguageReliable(editor.originalText);

  const title = mode === "polish" ? t.polisher.title : t.humanize.title;
  const subtitle =
    mode === "polish" ? t.polisher.subtitle : t.humanize.subtitle;
  const runLabel = mode === "polish" ? t.polisher.run : t.humanize.run;
  const rerunLabel = mode === "polish" ? t.polisher.rerun : t.humanize.rerun;
  const endpoint = mode === "polish" ? "/api/v1/polish" : "/api/v1/humanize";

  const taskKey = mode;
  async function run() {
    setError(null);
    setInfo(null);

    if (!editor.originalText.trim()) {
      setError({ message: t.common.required });
      return;
    }
    if (overLimit) {
      setError({ message: t.common.overLimit });
      return;
    }

    const task = beginWorkspaceTask(taskKey);
    const request = editor.beginRequest();
    setLoading(true);

    try {
      const payload =
        mode === "polish"
          ? {
              text: editor.originalText,
              standard,
              intensity,
              contentLanguage,
              scene: scene || undefined,
              sourceVersion: request.version,
              ...(styleProfileId ? { styleProfileId } : {}),
            }
          : {
              text: editor.originalText,
              intensity,
              contentLanguage,
              sourceVersion: request.version,
            };

      const data = await apiPost<AiTransformResponse>(endpoint, payload, {
        signal: task.controller.signal,
      });

      if (!isWorkspaceTaskCurrent(taskKey, task.epoch)) return;

      const status = editor.applyAiResult({
        text: data.text,
        sourceVersion: data.sourceVersion,
        language: data.detectedLanguage,
        seq: request.seq,
      });

      if (status === "stale") {
        setInfo(t.common.versionConflict);
      } else if (mode === "polish" && styleProfileId) {
        setStyleAnalysisToken((current) => current + 1);
      }
    } catch (caught) {
      if (!isWorkspaceTaskCurrent(taskKey, task.epoch)) return;
      if (isAbortError(caught)) {
        setInfo(t.common.cancelled);
      } else {
        setError(toDisplayError(caught, t, t.common.failedKeepInput));
      }
    } finally {
      if (isWorkspaceTaskCurrent(taskKey, task.epoch)) {
        setLoading(false);
        finishWorkspaceTask(taskKey, task.epoch);
      }
    }
  }

  function cancel() {
    cancelWorkspaceTask(taskKey);
    setLoading(false);
    setInfo(t.common.cancelled);
  }

  function clearAll() {
    cancelWorkspaceTask(taskKey);
    setLoading(false);
    setError(null);
    setInfo(null);
    editor.clearAll();
  }

  function fillExample() {
    if (loading) return;
    if (editor.currentText) editor.setCurrentText("");
    editor.setOriginalText(uiLocale === "en" ? EXAMPLE_EN : EXAMPLE_ZH);
    setError(null);
    setInfo(null);
  }

  function handleLanguageChange(language: ContentLanguage) {
    languageTouched.current = true;
    setContentLanguage(language);
  }

  function handleStyleProfileChange(id: string | null) {
    setStyleProfileId(id);
    setStyleAnalysisToken(0);
  }

  function handleStyleApply(text: string) {
    editor.applyFullText(text);
    setStyleAnalysisToken((current) => current + 1);
  }

  function handleStyleReplace(
    start: number,
    end: number,
    replacement: string,
    expected: string
  ): boolean {
    const applied = editor.replaceRange(start, end, replacement, expected);
    if (applied) setStyleAnalysisToken((current) => current + 1);
    return applied;
  }

  const selectedStyleProfile = styleProfiles.find(
    (profile) => profile.id === styleProfileId
  );

  const hasResult = Boolean(editor.currentText);

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle={subtitle}
        meta={
          <>
            <span className="chip">
              <Icon name="text" size={12} />
              {MAX_VISIBLE_CHARS} {t.common.chars}
            </span>
            <span className="chip">
              <Icon name="shield" size={12} />
              {t.common.serverAi}
            </span>
            {mode === "humanize" ? (
              <span className="chip !border-[var(--warning-border)] !bg-[var(--warning-bg)] !text-[var(--text)]">
                <Icon name="alert" size={12} />
                {t.humanize.disclaimer}
              </span>
            ) : null}
          </>
        }
      />

      <section className="app-card p-4 sm:p-5">
        <div className="space-y-4">
          {mode === "polish" ? (
            <StandardPicker value={standard} onChange={setStandard} />
          ) : null}

          <div
            className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
              mode === "polish"
                ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_220px] lg:items-end"
                : ""
            }`}
          >
            <IntensityPicker value={intensity} onChange={setIntensity} />
            <LanguageSelect
              value={contentLanguage}
              onChange={handleLanguageChange}
              showUnreliableHint={unreliable}
            />
            {mode === "polish" ? (
              <ScenePicker value={scene} onChange={setScene} />
            ) : null}
          </div>

          {mode === "polish" ? (
            <StyleProfilePicker
              profiles={styleProfiles}
              value={styleProfileId}
              onChange={handleStyleProfileChange}
              loading={styleProfilesLoading}
              onRefresh={loadStyleProfiles}
              disabled={loading}
            />
          ) : null}

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <Icon name="info" size={13} className="mt-0.5 shrink-0" />
            {mode === "polish" ? t.polisher.tip : t.humanize.tip}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <EditorToolbar
            onRun={run}
            onClear={clearAll}
            onUndo={editor.undo}
            onRedo={editor.redo}
            onCancel={cancel}
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            copyText={editor.currentText}
            primaryLabel={hasResult ? rerunLabel : runLabel}
            loading={loading}
            disabled={!editor.originalText.trim() || overLimit}
          />
          {loading ? (
            <p className="text-[11px] text-muted">
              {t.common.editingDuringRequest}
            </p>
          ) : (
            <p className="text-[11px] tabular-nums text-muted">
              {charCount} / {MAX_VISIBLE_CHARS} {t.common.chars}
            </p>
          )}
        </div>
      </section>

      {error ? (
        <Notice
          tone="error"
          testId="error-notice"
          onRetry={error.retryable === false ? undefined : run}
          retryLabel={t.common.retry}
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
      ) : null}

      {info ? (
        <Notice tone="warning" testId="info-notice">
          {info}
        </Notice>
      ) : null}

      <DualPaneEditor
        originalText={editor.originalText}
        onOriginalChange={editor.setOriginalText}
        currentText={editor.currentText}
        onCurrentChange={editor.setCurrentText}
        pairs={editor.pairs}
        generatedText={editor.generatedText}
        loading={loading}
        onTryExample={fillExample}
        interactive={mode === "polish"}
        polishStyle={standard}
        contentLanguage={contentLanguage}
        onReplaceRange={editor.replaceRange}
      />

      {mode === "polish" &&
      styleProfileId &&
      styleAnalysisToken > 0 ? (
        <StyleConsistencyPanel
          originalText={editor.originalText}
          currentText={editor.currentText}
          sourceVersion={editor.sourceVersion}
          styleProfileId={styleProfileId}
          styleProfileName={selectedStyleProfile?.name ?? "Style profile"}
          standard={standard}
          analysisToken={styleAnalysisToken}
          onApplyText={handleStyleApply}
          onReplaceDifference={handleStyleReplace}
        />
      ) : null}

      <SentencePanel
        pairs={editor.pairs}
        contentLanguage={contentLanguage}
        busy={loading}
        onRestore={editor.restoreSentence}
        onApplyAlternative={editor.applyAlternative}
        onAlternatives={editor.setSentenceAlternatives}
        onExplanation={editor.setSentenceExplanation}
      />
    </div>
  );
}
