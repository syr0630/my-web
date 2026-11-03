"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CharCounter } from "@/components/common/CharCounter";
import { Icon } from "@/components/common/Icon";
import { Notice } from "@/components/common/Notice";
import { PageHeader } from "@/components/common/PageHeader";
import { apiPost } from "@/lib/api/client";
import {
  isAbortError,
  toDisplayError,
  type DisplayError,
} from "@/lib/api/display-error";
import { MAX_VISIBLE_CHARS, TRANSLATION_STYLES } from "@/lib/constants";
import { setHandoff, takeHandoff } from "@/lib/handoff";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { detectLanguage } from "@/lib/language/detect";
import { countVisibleChars } from "@/lib/text/char-count";
import {
  beginWorkspaceTask,
  cancelWorkspaceTask,
  finishWorkspaceTask,
  isWorkspaceTaskCurrent,
} from "@/lib/workspace/tasks";
import { useWorkspaceState } from "@/lib/workspace/state";
import type {
  TranslateResponse,
  TranslationSource,
  TranslationStyle,
  TranslationTarget,
} from "@/types";

const COPY = {
  "zh-CN": {
    eyebrow: "Translate",
    title: "中英翻译",
    subtitle: "在中文与英文之间自然转换，保留事实、术语与段落结构。",
    badge: "真实 AI 翻译",
    source: "源语言",
    target: "目标语言",
    auto: "自动识别",
    zh: "简体中文",
    en: "English",
    swap: "交换语言",
    style: "翻译风格",
    styles: {
      natural: "自然",
      formal: "正式",
      academic: "学术",
    } as Record<TranslationStyle, string>,
    input: "原文",
    output: "译文",
    inputPlaceholder: "输入要翻译的中文或英文，最多 2000 个可见字符。",
    run: "翻译",
    rerun: "重新翻译",
    example: "填入示例",
    copy: "复制译文",
    copied: "已复制",
    clear: "清空译文",
    sendPolish: "送到文本润色",
    sendGrammar: "送到语法检查",
    emptyResult: "译文会显示在这里，你可以直接编辑。",
    detected: "检测到",
    chars: "可见字符",
    required: "请先输入文本。",
    limit: "已超出 2000 可见字符上限，请删减后再提交。",
    same: "源语言与目标语言不能相同。",
    failed: "翻译失败，已保留原文。",
    editing: "译文可编辑；复制与转送都会使用你当前编辑后的版本。",
    note: "翻译由服务端 AI 完成；请核对专有名词、数字与引用。",
  },
  en: {
    eyebrow: "Translate",
    title: "Chinese ↔ English",
    subtitle:
      "Translate naturally between Chinese and English while preserving facts, terminology and structure.",
    badge: "Real AI translation",
    source: "From",
    target: "To",
    auto: "Auto-detect",
    zh: "Simplified Chinese",
    en: "English",
    swap: "Swap languages",
    style: "Style",
    styles: {
      natural: "Natural",
      formal: "Formal",
      academic: "Academic",
    } as Record<TranslationStyle, string>,
    input: "Source",
    output: "Translation",
    inputPlaceholder:
      "Enter Chinese or English text, up to 2000 visible characters.",
    run: "Translate",
    rerun: "Translate again",
    example: "Use example",
    copy: "Copy translation",
    copied: "Copied",
    clear: "Clear translation",
    sendPolish: "Send to polisher",
    sendGrammar: "Send to grammar",
    emptyResult: "The translation will appear here and can be edited.",
    detected: "Detected",
    chars: "visible characters",
    required: "Please enter some text first.",
    limit: "The 2000-character limit has been exceeded.",
    same: "Source and target languages must differ.",
    failed: "Translation failed and the source text was kept.",
    editing:
      "The translation is editable; copy and send actions use your current edited version.",
    note: "Translation runs on the server; verify names, numbers and citations.",
  },
} as const;

const EXAMPLE_ZH =
  "这家公司正在重新设计它的客户支持流程，希望在不增加人手的情况下，把平均响应时间缩短一半。";
const EXAMPLE_EN =
  "The research team found that short, regular breaks improved both focus and overall output, especially during long writing sessions.";

function newVersion(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function TranslateWorkspace() {
  const { uiLocale, t } = useLocale();
  const c = COPY[uiLocale];
  const router = useRouter();

  const [source, setSource] = useWorkspaceState<TranslationSource>(
    "translate.source",
    "auto"
  );
  const [target, setTarget] = useWorkspaceState<TranslationTarget>(
    "translate.target",
    "en"
  );
  const [style, setStyle] = useWorkspaceState<TranslationStyle>(
    "translate.style",
    "natural"
  );
  const [input, setInput] = useWorkspaceState("translate.input", "");
  const [translated, setTranslated] = useWorkspaceState(
    "translate.translated",
    ""
  );
  const [detected, setDetected] = useWorkspaceState<string | null>(
    "translate.detected",
    null
  );
  const [loading, setLoading] = useWorkspaceState<boolean>(
    "translate.loading",
    false,
    { persist: false }
  );
  const [error, setError] = useWorkspaceState<DisplayError | null>(
    "translate.error",
    null,
    { persist: false }
  );
  const [copied, setCopied] = useState(false);

  const versionRef = useRef(newVersion());

  useEffect(() => {
    const handoff = takeHandoff("translate");
    if (handoff) {
      setInput(handoff.slice(0, MAX_VISIBLE_CHARS));
      setDetected(detectLanguage(handoff));
      setTarget(detectLanguage(handoff) === "en" ? "zh-CN" : "en");
    }
  }, [setDetected, setInput, setTarget]);

  const count = countVisibleChars(input);
  const overLimit = count > MAX_VISIBLE_CHARS;

  function invalidatePending() {
    cancelWorkspaceTask("translate");
    setLoading(false);
  }

  function updateInput(value: string) {
    invalidatePending();
    setInput(value);
    setTranslated("");
    setDetected(null);
    versionRef.current = newVersion();

    // With auto-detect, flip the target if the writer pastes the target
    // language by mistake. An explicit source choice is left untouched.
    if (source === "auto" && value.trim().length >= 12) {
      const detectedInput = detectLanguage(value);
      if (detectedInput === "en" && target === "en") setTarget("zh-CN");
      else if (detectedInput === "zh-CN" && target === "zh-CN") setTarget("en");
    }
  }

  function chooseSource(next: TranslationSource) {
    invalidatePending();
    setSource(next);
    if (next !== "auto" && next === target) {
      setTarget(next === "zh-CN" ? "en" : "zh-CN");
    }
    setTranslated("");
  }

  function chooseTarget(next: TranslationTarget) {
    invalidatePending();
    setTarget(next);
    if (source !== "auto" && source === next) {
      setSource(next === "zh-CN" ? "en" : "zh-CN");
    }
    setTranslated("");
  }

  function swapLanguages() {
    invalidatePending();
    const nextTarget: TranslationTarget =
      source === "auto"
        ? detectLanguage(input) === "en"
          ? "en"
          : "zh-CN"
        : source;
    const nextSource: TranslationTarget = target;

    // Swap both the controls and the two text boxes, which is what the control
    // implies. With an empty result the source moves to the result pane.
    setInput(translated);
    setTranslated(input);
    setSource(nextSource);
    setTarget(nextTarget);
    setDetected(null);
    versionRef.current = newVersion();
  }

  function fillExample() {
    invalidatePending();
    const zh = uiLocale !== "en";
    setInput(zh ? EXAMPLE_ZH : EXAMPLE_EN);
    setTarget(zh ? "en" : "zh-CN");
    setSource("auto");
    setTranslated("");
    setDetected(null);
    versionRef.current = newVersion();
  }

  async function translate() {
    setError(null);
    if (!input.trim()) {
      setError({ message: c.required });
      return;
    }
    if (overLimit) {
      setError({ message: c.limit });
      return;
    }
    if (source !== "auto" && source === target) {
      setError({ message: c.same });
      return;
    }

    const task = beginWorkspaceTask("translate");
    setLoading(true);

    try {
      const data = await apiPost<TranslateResponse>(
        "/api/v1/translate",
        {
          text: input,
          sourceLanguage: source,
          targetLanguage: target,
          style,
          sourceVersion: versionRef.current,
        },
        { signal: task.controller.signal }
      );
      if (!isWorkspaceTaskCurrent("translate", task.epoch)) return;
      setTranslated(data.text);
      setDetected(data.detectedLanguage);
    } catch (caught) {
      if (
        isWorkspaceTaskCurrent("translate", task.epoch) &&
        !isAbortError(caught)
      ) {
        setError(toDisplayError(caught, t, c.failed));
      }
    } finally {
      if (isWorkspaceTaskCurrent("translate", task.epoch)) {
        setLoading(false);
        finishWorkspaceTask("translate", task.epoch);
      }
    }
  }

  async function copyTranslation() {
    if (!translated.trim()) return;
    try {
      await navigator.clipboard.writeText(translated);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError({ message: "复制失败，请手动选择文本。" });
    }
  }

  function sendTo(targetTool: "polisher" | "grammar") {
    if (!translated.trim()) return;
    setHandoff({ text: translated, from: "translate" });
    router.push(`/${targetTool}?handoff=1`);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={c.eyebrow}
        icon="globe"
        title={c.title}
        subtitle={c.subtitle}
        badge={<span className="chip">{c.badge}</span>}
      />

      <section className="app-card p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-end">
          <label className="block">
            <span className="field-label">{c.source}</span>
            <select
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--ring)]"
              value={source}
              data-testid="translate-source"
              onChange={(event) =>
                chooseSource(event.target.value as TranslationSource)
              }
              disabled={loading}
            >
              <option value="auto">{c.auto}</option>
              <option value="zh-CN">{c.zh}</option>
              <option value="en">{c.en}</option>
            </select>
          </label>

          <button
            type="button"
            className="btn btn-secondary !min-h-[44px] !w-11 !px-0"
            onClick={swapLanguages}
            aria-label={c.swap}
            title={c.swap}
            data-testid="translate-swap"
            disabled={loading}
          >
            <Icon name="refresh" size={18} />
          </button>

          <label className="block">
            <span className="field-label">{c.target}</span>
            <select
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--ring)]"
              value={target}
              data-testid="translate-target"
              onChange={(event) =>
                chooseTarget(event.target.value as TranslationTarget)
              }
              disabled={loading}
            >
              <option value="zh-CN">{c.zh}</option>
              <option value="en">{c.en}</option>
            </select>
          </label>

          <button
            type="button"
            className="btn btn-primary !min-h-[44px]"
            onClick={() => void translate()}
            disabled={loading || !input.trim() || overLimit}
            data-testid="translate-run"
          >
            <Icon
              name={loading ? "loader" : "globe"}
              size={17}
              className={loading ? "animate-spin" : undefined}
            />
            {loading ? "…" : translated ? c.rerun : c.run}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">{c.style}</span>
            <div className="segmented !w-auto" role="group" aria-label={c.style}>
              {TRANSLATION_STYLES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="segmented-item !w-auto !px-3"
                  aria-pressed={style === value}
                  onClick={() => setStyle(value)}
                  disabled={loading}
                  data-testid={`translate-style-${value}`}
                >
                  {c.styles[value]}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-[28px] items-center text-[11px] font-medium text-[var(--primary)] hover:underline"
            onClick={fillExample}
            disabled={loading}
          >
            {c.example}
          </button>
        </div>
      </section>

      {error ? (
        <Notice tone="error" testId="translate-error">
          {error.message}
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="app-card flex min-h-[340px] flex-col p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="translate-input" className="field-label">
              {c.input}
            </label>
            <CharCounter text={input} />
          </div>
          <textarea
            id="translate-input"
            data-testid="translate-input"
            className={`textarea min-h-[260px] flex-1 ${
              overLimit ? "!border-[var(--danger-border)]" : ""
            }`}
            value={input}
            onChange={(event) => updateInput(event.target.value)}
            placeholder={c.inputPlaceholder}
            aria-invalid={overLimit}
            aria-describedby="translate-limit"
            spellCheck
          />
          <p
            id="translate-limit"
            className={`mt-2 text-[11px] ${
              overLimit ? "text-[var(--danger)]" : "text-muted"
            }`}
          >
            {overLimit
              ? c.limit
              : detected
                ? `${c.detected}: ${detected}`
                : `${MAX_VISIBLE_CHARS} ${c.chars}`}
          </p>
        </section>

        <section className="app-card flex min-h-[340px] flex-col p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="field-label">{c.output}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary !min-h-[32px] !px-2.5 !text-[11px]"
                onClick={() => void copyTranslation()}
                disabled={!translated.trim()}
              >
                <Icon name="copy" size={13} />
                {copied ? c.copied : c.copy}
              </button>
              <button
                type="button"
                className="text-[11px] text-muted hover:text-[var(--text)]"
                onClick={() => setTranslated("")}
                disabled={!translated}
              >
                {c.clear}
              </button>
            </div>
          </div>
          <textarea
            data-testid="translate-result"
            className="textarea min-h-[260px] flex-1 bg-[var(--surface-muted)]"
            value={translated}
            onChange={(event) => setTranslated(event.target.value)}
            placeholder={c.emptyResult}
            aria-label={c.output}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] leading-relaxed text-muted">{c.editing}</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                className="btn btn-secondary !min-h-[32px] !px-2.5 !text-[11px]"
                onClick={() => sendTo("polisher")}
                disabled={!translated.trim()}
              >
                {c.sendPolish}
                <Icon name="arrowRight" size={13} />
              </button>
              <button
                type="button"
                className="btn btn-secondary !min-h-[32px] !px-2.5 !text-[11px]"
                onClick={() => sendTo("grammar")}
                disabled={!translated.trim()}
              >
                {c.sendGrammar}
                <Icon name="arrowRight" size={13} />
              </button>
            </div>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
            <Icon name="shield" size={12} className="mt-0.5 shrink-0" />
            {c.note}
          </p>
        </section>
      </div>
    </div>
  );
}


