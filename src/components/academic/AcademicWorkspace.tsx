"use client";

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { Modal } from "@/components/common/Modal";
import { Notice } from "@/components/common/Notice";
import { PageHeader } from "@/components/common/PageHeader";
import { apiPost, apiUpload } from "@/lib/api/client";
import {
  ACADEMIC_MAX_CHARS,
  ACADEMIC_MAX_FILE_BYTES,
} from "@/lib/constants";
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
  AcademicMode,
  AcademicResponse,
  DocumentExtractResponse,
} from "@/types";

const MODES: {
  id: AcademicMode;
  label: string;
  zh: string;
  note: string;
}[] = [
  {
    id: "polish",
    label: "Manuscript polish",
    zh: "论文润色",
    note: "按 Skill 的论证推进与反模板规则逐段修改，保留你的材料、引用和术语。",
  },
  {
    id: "review",
    label: "Structure review",
    zh: "结构审阅",
    note: "先诊断问题意识、段落功能、段际接力和材料评述，不替你补材料。",
  },
  {
    id: "abstract",
    label: "Abstract rewrite",
    zh: "摘要改写",
    note: "按 C 刊摘要规则压缩出问题、材料、方法功能、发现和贡献。",
  },
];

const ACCEPTED_TYPES = ".docx,.txt,.md,.markdown";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function AcademicWorkspace() {
  const { uiLocale } = useLocale();
  const en = uiLocale === "en";
  const [mode, setMode] = useWorkspaceState<AcademicMode>(
    "academic.mode",
    "polish"
  );
  const [text, setText] = useWorkspaceState("academic.text", "");
  const [result, setResult] = useWorkspaceState<AcademicResponse | null>(
    "academic.result",
    null
  );
  const [error, setError] = useWorkspaceState<string | null>(
    "academic.error",
    null,
    { persist: false }
  );
  const [fileName, setFileName] = useWorkspaceState<string | null>(
    "academic.fileName",
    null
  );
  const [uploading, setUploading] = useWorkspaceState<boolean>(
    "academic.uploading",
    false,
    { persist: false }
  );
  const [running, setRunning] = useWorkspaceState<boolean>(
    "academic.running",
    false,
    { persist: false }
  );
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const chars = countVisibleChars(text);
  const tooLong = chars > ACADEMIC_MAX_CHARS;
  const canRun = Boolean(text.trim()) && !tooLong && !running && !uploading;
  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0];

  const charLabel = useMemo(
    () => `${chars.toLocaleString()} / ${ACADEMIC_MAX_CHARS.toLocaleString()}`,
    [chars]
  );

  function changeText(value: string) {
    cancelWorkspaceTask("academic");
    setRunning(false);
    setText(value);
    setResult(null);
    setError(null);
  }

  function chooseMode(next: AcademicMode) {
    cancelWorkspaceTask("academic");
    setRunning(false);
    setMode(next);
    setResult(null);
    setError(null);
  }

  async function handleFile(file: File) {
    if (fileInput.current) fileInput.current.value = "";
    cancelWorkspaceTask("academic");
    setRunning(false);
    setError(null);
    setResult(null);

    const extension = extensionOf(file.name);
    const isImage = file.type.startsWith("image/");
    if (isImage || [".pdf", ".doc", ".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)) {
      setError(
        en
          ? "PDF, images and legacy .doc files are not supported. Upload DOCX, TXT or Markdown."
          : "不支持 PDF、图片或旧版 .doc。请上传 DOCX、TXT 或 Markdown 文件。"
      );
      return;
    }
    if (![".docx", ".txt", ".md", ".markdown"].includes(extension)) {
      setError(
        en
          ? "Only DOCX, TXT and Markdown are supported."
          : "仅支持 DOCX、TXT 和 Markdown 文件。"
      );
      return;
    }
    if (file.size > ACADEMIC_MAX_FILE_BYTES) {
      setError(
        en
          ? `The file exceeds ${Math.round(ACADEMIC_MAX_FILE_BYTES / 1024 / 1024)} MB.`
          : `文件超过 ${Math.round(ACADEMIC_MAX_FILE_BYTES / 1024 / 1024)} MB 限制。`
      );
      return;
    }

    setUploading(true);
    try {
      let incoming = "";
      if (extension === ".docx") {
        const form = new FormData();
        form.append("file", file);
        const data = await apiUpload<DocumentExtractResponse>(
          "/api/v1/documents/extract",
          form
        );
        incoming = data.text;
      } else {
        incoming = (await file.text()).replace(/^\uFEFF/, "");
      }

      incoming = incoming.replace(/\r\n?/g, "\n").trim();
      if (!incoming) {
        setError(en ? "No readable text was found in this file." : "文档中没有可读取的文字。");
        return;
      }
      if (countVisibleChars(incoming) > ACADEMIC_MAX_CHARS) {
        setError(
          en
            ? `The document exceeds the ${ACADEMIC_MAX_CHARS.toLocaleString()}-character limit. Split it by section.`
            : `文档超过单次 ${ACADEMIC_MAX_CHARS.toLocaleString()} 字符限制，请按章节拆分后再上传。`
        );
        return;
      }

      setText(incoming);
      setFileName(file.name);
      setResult(null);
    } catch (caught) {
      setError(errorMessage(caught, en ? "Import failed." : "文档导入失败。"));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function run() {
    if (!canRun) return;
    const task = beginWorkspaceTask("academic");
    setRunning(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const data = await apiPost<AcademicResponse>(
        "/api/v1/academic",
        { text, mode },
        { signal: task.controller.signal }
      );
      if (!isWorkspaceTaskCurrent("academic", task.epoch)) return;
      setResult(data);
    } catch (caught) {
      if (
        isWorkspaceTaskCurrent("academic", task.epoch) &&
        !(caught instanceof DOMException && caught.name === "AbortError")
      ) {
        setError(
          errorMessage(
            caught,
            en ? "Academic writing failed." : "学术写作处理失败。"
          )
        );
      }
    } finally {
      if (isWorkspaceTaskCurrent("academic", task.epoch)) {
        setRunning(false);
        finishWorkspaceTask("academic", task.epoch);
      }
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(en ? "Could not copy the result." : "复制失败，请手动选择文本。");
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="ACADEMIC / 07"
        icon="book"
        title={en ? "Academic Writing" : "学术写作"}
        subtitle={
          en
            ? "Review argument, structure and academic language for social science and humanities writing."
            : "面向社会科学与人文学科的学术审阅、结构分析与语言润色。"
        }
        badge={
          <span className="chip">
            <Icon name="checkBadge" size={12} />
            {en ? "Skill connected" : "Skill 已接入"}
          </span>
        }
      />

      <Notice tone="info">
        <span className="text-xs leading-relaxed">
          {en
            ? "Text is sent only for this Skill run; Draftly does not keep a server-side copy."
            : "上传或粘贴的文本仅用于本次 Skill 处理，Draftly 不保存服务端副本。"}
        </span>
      </Notice>

      <div className="grid gap-4">
        <section className="app-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <label htmlFor="academic-input" className="field-label">
                {en ? "Manuscript" : "论文文本"}
              </label>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {en
                  ? "DOCX, TXT or Markdown. PDF, images and scanned papers are not supported."
                  : "支持 DOCX、TXT、Markdown；不支持 PDF、图片和扫描件。"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED_TYPES}
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              <button
                type="button"
                className="btn btn-secondary !min-h-[42px]"
                onClick={() => fileInput.current?.click()}
                disabled={uploading || running}
                data-testid="academic-upload"
              >
                <Icon name={uploading ? "loader" : "upload"} size={15} />
                {uploading ? (en ? "Reading..." : "读取中…") : en ? "Upload document" : "上传文档"}
              </button>
            </div>
          </div>

          <textarea
            id="academic-input"
            data-testid="academic-input"
            className="textarea mt-3 min-h-[300px]"
            value={text}
            onChange={(event) => changeText(event.target.value)}
            placeholder={
              en
                ? "Paste an abstract, a section, or a full argument. Keep citations, headings and paragraph structure."
                : "粘贴摘要、某一节或完整论证。请保留引用、标题与段落层级。"
            }
            aria-describedby="academic-input-hint"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-muted">
              {fileName ? (
                <span className="flex min-w-0 items-center gap-1.5">
                  <Icon name="text" size={13} className="shrink-0" />
                  <span className="max-w-[260px] truncate">{fileName}</span>
                </span>
              ) : null}
              <span id="academic-input-hint" className={tooLong ? "text-[var(--danger)]" : ""}>
                {charLabel} {en ? "characters" : "字符"}
              </span>
              {tooLong ? (
                <span className="text-[var(--danger)]">
                  {en ? "Split the manuscript by section." : "请按章节拆分后再处理。"}
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-muted">
              {en
                ? "The skill edits language and argument; it does not verify citations."
                : "Skill 处理语言与论证，不替代引用和材料核验。"}
            </p>
          </div>
        </section>

        <section className="app-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="field-label">{en ? "Task" : "处理方式"}</p>
            <span className="text-[10px] text-muted">
              {en ? "One section at a time" : "建议一次处理一个章节"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="capsule"
                aria-pressed={mode === item.id}
                onClick={() => chooseMode(item.id)}
                data-testid={`academic-mode-${item.id}`}
              >
                {en ? item.label : item.zh}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{activeMode.note}</p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmClear(true)}
                disabled={!text.trim() || running}
              >
                <Icon name="trash" size={15} />
                {en ? "Clear" : "清空"}
              </button>
              {result ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void copyResult()}
                  data-testid="academic-copy"
                >
                  <Icon name="copy" size={15} />
                  {copied ? (en ? "Copied" : "已复制") : en ? "Copy result" : "复制结果"}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void run()}
              disabled={!canRun}
              data-testid="academic-run"
              title={
                !text.trim()
                  ? en
                    ? "Paste or upload a manuscript first."
                    : "请先粘贴或上传论文文本"
                  : tooLong
                    ? en
                      ? "Split the manuscript by section."
                      : "请按章节拆分后再处理"
                    : undefined
              }
            >
              <Icon name={running ? "loader" : "sparkles"} size={16} />
              {running
                ? en
                  ? "Working with the skill..."
                  : "正在按 Skill 处理…"
                : en
                  ? "Run with the skill"
                  : "用 Skill 修改润色"}
            </button>
          </div>
        </section>

        {error ? <Notice tone="error">{error}</Notice> : null}

        <section className="app-card overflow-hidden" data-testid="academic-result">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <div>
              <p className="field-label">{en ? "Result" : "处理结果"}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {result
                  ? `${activeMode.zh} · ${result.inputChars.toLocaleString()} ${
                      en ? "characters in" : "字符输入"
                    }`
                  : en
                    ? "The revised manuscript or review will appear here."
                    : "修改后的论文或审阅报告会显示在这里。"}
              </p>
            </div>
            {result ? (
              <span className="chip">
                <Icon name="checkBadge" size={12} />
                {result.model}
              </span>
            ) : null}
          </div>

          {result ? (
            <pre className="academic-result-text" data-testid="academic-result-text">
              {result.text}
            </pre>
          ) : (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 px-6 py-8 text-center">
              <Icon name="book" size={24} className="text-[var(--muted)]" />
              <p className="text-sm text-muted">
                {running
                  ? en
                    ? "Applying the public-management C-journal skill..."
                    : "正在应用公共管理 C 刊写作 Skill…"
                  : en
                    ? "Paste a section or upload a document to begin."
                    : "粘贴一个章节，或上传文档后开始。"}
              </p>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={confirmClear}
        title={en ? "Clear this manuscript?" : "清空当前论文？"}
        description={
          en
            ? "The text and any generated result will be removed from this page. No server copy is stored."
            : "论文文本和已生成结果会从当前页面移除。服务端不会保存副本。"
        }
        confirmLabel={en ? "Clear text" : "清空文本"}
        cancelLabel={en ? "Keep it" : "保留"}
        tone="danger"
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          cancelWorkspaceTask("academic");
          setRunning(false);
          setText("");
          setResult(null);
          setFileName(null);
          setError(null);
          setConfirmClear(false);
        }}
      />
    </div>
  );
}