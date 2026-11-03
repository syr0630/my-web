"use client";


import { useRouter } from "next/navigation";
import { CharCounter } from "@/components/common/CharCounter";
import { Icon } from "@/components/common/Icon";
import { LanguageSelect } from "@/components/common/LanguageSelect";
import { Notice } from "@/components/common/Notice";
import { PageHeader } from "@/components/common/PageHeader";
import { apiPost } from "@/lib/api/client";
import {
  isAbortError,
  toDisplayError,
  type DisplayError,
} from "@/lib/api/display-error";
import { MAX_VISIBLE_CHARS } from "@/lib/constants";
import { setHandoff } from "@/lib/handoff";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { countVisibleChars } from "@/lib/text/char-count";
import {
  beginWorkspaceTask,
  cancelWorkspaceTask,
  finishWorkspaceTask,
  isWorkspaceTaskCurrent,
} from "@/lib/workspace/tasks";
import { useWorkspaceState } from "@/lib/workspace/state";
import type {
  ContentLanguage,
  DetectorResponse,
  DetectorSignal,
} from "@/types";

const COPY = {
  "zh-CN": {
    eyebrow: "AI detector",
    title: "AI 文本检测",
    subtitle: "从语言特征估计文本的 AI 写作倾向，并明确标出不确定性。",
    badge: "概率性辅助信号",
    input: "待分析文本",
    placeholder: "粘贴一段中文或英文，最多 2000 个可见字符。",
    run: "分析文本",
    rerun: "重新分析",
    example: "填入示例",
    empty: "分析后，这里会显示倾向估计与语言特征。",
    score: "AI 写作特征估计",
    outOf: "满分 100",
    confidence: "置信度",
    summary: "分析摘要",
    signals: "观察到的语言信号",
    noSignals: "没有提取到足够可靠的语言信号。",
    bands: {
      human: "更像人类写作",
      uncertain: "信号不明确",
      ai: "AI 写作特征较多",
    },
    confidences: {
      low: "低",
      medium: "中",
      high: "高",
    },
    disclaimer: "这不是作者身份证明",
    disclaimerBody:
      "检测结果是概率性辅助信号，可能误判。请结合写作过程、引用、版本记录与上下文判断，不要仅凭分数作出学术、人事或法律决定。",
    required: "请先输入文本。",
    limit: "已超出 2000 可见字符上限，请删减后再提交。",
    failed: "分析失败，已保留你的文本。",
    send: "用改写降低模板感",
    short: "文本较短，结果可靠性会明显下降。",
    scoreLabel: "AI 特征分数",
  },
  en: {
    eyebrow: "AI detector",
    title: "AI text detector",
    subtitle:
      "Estimate AI-like writing signals with explicit uncertainty, not an authorship verdict.",
    badge: "Probabilistic signal",
    input: "Text to analyze",
    placeholder: "Paste Chinese or English text, up to 2000 visible characters.",
    run: "Analyze text",
    rerun: "Analyze again",
    example: "Use example",
    empty: "An estimate and language signals will appear here.",
    score: "AI-writing signal estimate",
    outOf: "out of 100",
    confidence: "Confidence",
    summary: "Summary",
    signals: "Observed language signals",
    noSignals: "No sufficiently reliable language signals were extracted.",
    bands: {
      human: "More human-like",
      uncertain: "Uncertain",
      ai: "More AI-like signals",
    },
    confidences: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    disclaimer: "This is not proof of authorship",
    disclaimerBody:
      "The result is a probabilistic signal and can be wrong. Consider the writing process, citations, revision history and context. Do not make academic, employment or legal decisions from this score alone.",
    required: "Please enter some text first.",
    limit: "The 2000-character limit has been exceeded.",
    failed: "The analysis failed and your text was kept.",
    send: "Humanize the template feel",
    short: "Short text makes this estimate much less reliable.",
    scoreLabel: "AI signal score",
  },
} as const;

const EXAMPLE_ZH =
  "在当今快速发展的数字化时代，人工智能技术正以前所未有的速度改变着我们的生活。首先，它提升了工作效率；其次，它拓展了信息获取的边界；最后，它也带来了新的挑战。综上所述，我们应当以开放而审慎的态度拥抱这一变化。";
const EXAMPLE_EN =
  "In today's rapidly evolving digital landscape, artificial intelligence is transforming our lives at an unprecedented pace. Firstly, it improves efficiency. Secondly, it expands access to information. Finally, it introduces new challenges. In conclusion, we should embrace this change with an open and prudent mindset.";

function confidenceTone(confidence: DetectorResponse["confidence"]): string {
  if (confidence === "high") return "text-[var(--primary-strong)]";
  if (confidence === "medium") return "text-[var(--warning)]";
  return "text-muted";
}

function ScoreRing({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score > 65
      ? "var(--danger)"
      : score >= 35
        ? "var(--warning)"
        : "var(--primary)";

  return (
    <div
      className="relative h-36 w-36 shrink-0"
      role="img"
      aria-label={`${label}: ${score}/100`}
      data-testid="detector-score"
    >
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="8"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="detector-ring"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl leading-none tracking-tight text-[var(--text)]">
          {score}
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">
          / 100
        </span>
      </div>
    </div>
  );
}

export function DetectorWorkspace() {
  const { uiLocale, t } = useLocale();
  const c = COPY[uiLocale];
  const router = useRouter();

  const [text, setText] = useWorkspaceState("detector.text", "");
  const [contentLanguage, setContentLanguage] =
    useWorkspaceState<ContentLanguage>("detector.contentLanguage", "auto");
  const [result, setResult] = useWorkspaceState<DetectorResponse | null>(
    "detector.result",
    null
  );
  const [loading, setLoading] = useWorkspaceState<boolean>(
    "detector.loading",
    false,
    { persist: false }
  );
  const [error, setError] = useWorkspaceState<DisplayError | null>(
    "detector.error",
    null,
    { persist: false }
  );

  const count = countVisibleChars(text);
  const overLimit = count > MAX_VISIBLE_CHARS;
  const tooShort = count > 0 && count < 80;

  function updateText(value: string) {
    cancelWorkspaceTask("detector");
    setLoading(false);
    setText(value);
    setResult(null);
  }

  function fillExample() {
    updateText(uiLocale === "en" ? EXAMPLE_EN : EXAMPLE_ZH);
  }

  async function run() {
    setError(null);
    if (!text.trim()) {
      setError({ message: c.required });
      return;
    }
    if (overLimit) {
      setError({ message: c.limit });
      return;
    }

    const task = beginWorkspaceTask("detector");
    setLoading(true);

    try {
      const data = await apiPost<DetectorResponse>(
        "/api/v1/detector/analyze",
        { text, contentLanguage },
        { signal: task.controller.signal }
      );
      if (!isWorkspaceTaskCurrent("detector", task.epoch)) return;
      setResult(data);
    } catch (caught) {
      if (
        isWorkspaceTaskCurrent("detector", task.epoch) &&
        !isAbortError(caught)
      ) {
        setError(toDisplayError(caught, t, c.failed));
      }
    } finally {
      if (isWorkspaceTaskCurrent("detector", task.epoch)) {
        setLoading(false);
        finishWorkspaceTask("detector", task.epoch);
      }
    }
  }

  function sendToHumanize() {
    if (!text.trim()) return;
    setHandoff({ text, from: "detector" });
    router.push("/humanize?handoff=1");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={c.eyebrow}
        icon="scan"
        title={c.title}
        subtitle={c.subtitle}
        badge={<span className="chip">{c.badge}</span>}
      />

      <section className="app-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <LanguageSelect
              value={contentLanguage}
              onChange={setContentLanguage}
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fillExample}
              disabled={loading}
            >
              {c.example}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void run()}
              disabled={loading || !text.trim() || overLimit}
              data-testid="detector-run"
            >
              <Icon
                name={loading ? "loader" : "scan"}
                size={17}
                className={loading ? "animate-spin" : undefined}
              />
              {loading ? "…" : result ? c.rerun : c.run}
            </button>
          </div>
        </div>

        <label htmlFor="detector-input" className="field-label">
          {c.input}
        </label>
        <textarea
          id="detector-input"
          data-testid="detector-input"
          className={`textarea mt-1.5 min-h-[220px] ${
            overLimit ? "!border-[var(--danger-border)]" : ""
          }`}
          value={text}
          onChange={(event) => updateText(event.target.value)}
          placeholder={c.placeholder}
          aria-invalid={overLimit}
          aria-describedby="detector-hint"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p
            id="detector-hint"
            className={`text-[11px] ${
              overLimit ? "text-[var(--danger)]" : "text-muted"
            }`}
          >
            {overLimit ? c.limit : tooShort ? c.short : `${MAX_VISIBLE_CHARS} ${uiLocale === "en" ? "visible characters" : "可见字符"}`}
          </p>
          <CharCounter text={text} />
        </div>
      </section>

      {error ? (
        <Notice tone="error" testId="detector-error">
          {error.message}
        </Notice>
      ) : null}

      <section className="app-card min-h-[280px] p-4 sm:p-5">
        {result ? (
          <div data-testid="detector-result">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <ScoreRing score={result.score} label={c.scoreLabel} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`chip ${
                      result.band === "ai"
                        ? "!border-[var(--danger-border)] !bg-[var(--danger-bg)] !text-[var(--text)]"
                        : result.band === "human"
                          ? "!border-[var(--success-border)] !bg-[var(--success-bg)] !text-[var(--text)]"
                          : "!border-[var(--warning-border)] !bg-[var(--warning-bg)] !text-[var(--text)]"
                    }`}
                  >
                    {c.bands[result.band]}
                  </span>
                  <span className="text-[11px] text-muted">
                    {c.confidence}:{" "}
                    <span className={confidenceTone(result.confidence)}>
                      {c.confidences[result.confidence]}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted">
                    {c.outOf}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">
                  {result.summary}
                </p>
                <p className="mt-1 text-[10px] text-muted">
                  {result.model} · {result.detectedLanguage}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <h2 className="text-sm font-semibold text-[var(--text)]">
                {c.signals}
              </h2>
              {result.signals.length ? (
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {result.signals.map(
                    (signal: DetectorSignal, index: number) => (
                      <li
                        key={`${signal.type}-${index}`}
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--primary)]">
                          {signal.type}
                        </p>
                        <p className="mt-1.5 text-xs leading-6 text-[var(--text)]">
                          “{signal.excerpt}”
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-muted">
                          {signal.explanation}
                        </p>
                      </li>
                    )
                  )}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">{c.noSignals}</p>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3.5 text-xs leading-6 text-[var(--text)]">
              <p className="flex items-center gap-1.5 font-semibold">
                <Icon name="alert" size={14} />
                {c.disclaimer}
              </p>
              <p className="mt-1">{c.disclaimerBody}</p>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="btn btn-secondary !min-h-[36px] !text-xs"
                onClick={sendToHumanize}
              >
                {c.send}
                <Icon name="arrowRight" size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]">
              <Icon name="scan" size={22} />
            </span>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              {c.empty}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

