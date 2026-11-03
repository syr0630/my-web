"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { Notice } from "@/components/common/Notice";
import { STYLE_COPY, STYLE_LIMITS, SOURCE_LABELS } from "@/components/style-profile/copy";
import { apiUpload } from "@/lib/api/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { countVisibleChars } from "@/lib/text/char-count";
import type { StyleSample } from "@/types";

type ExtractResponse = {
  samples: StyleSample[];
  errors: { name: string; message: string }[];
};

type Props = {
  samples: StyleSample[];
  onAdd: (samples: StyleSample[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function StyleSampleImporter({
  samples,
  onAdd,
  onRemove,
  disabled,
}: Props) {
  const { uiLocale } = useLocale();
  const c = STYLE_COPY[uiLocale];
  const [pasteText, setPasteText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<{ name: string; message: string }[]>(
    []
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const totalChars = samples.reduce((sum, sample) => sum + sample.chars, 0);
  const enough = totalChars >= 200;
  const limited = totalChars >= 200 && (totalChars < 600 || samples.length === 1);

  function add(sample: StyleSample): boolean {
    if (samples.length >= STYLE_LIMITS.maxSamples) {
      setError(c.maxSamples);
      return false;
    }
    if (totalChars + sample.chars > STYLE_LIMITS.maxTotalChars) {
      setError(c.maxChars);
      return false;
    }
    return true;
  }

  function addPaste() {
    setError(null);
    const text = pasteText.trim();
    if (!text) {
      setError(c.pasteEmpty);
      return;
    }
    const chars = countVisibleChars(text);
    if (chars > STYLE_LIMITS.maxSampleChars) {
      setError(
        uiLocale === "zh-CN"
          ? `单份样本超过 ${STYLE_LIMITS.maxSampleChars} 字，请截取后再添加。`
          : `A sample is limited to ${STYLE_LIMITS.maxSampleChars} characters.`
      );
      return;
    }
    const sample: StyleSample = {
      id: newId(),
      name:
        uiLocale === "zh-CN"
          ? `${c.untitledSample} ${samples.length + 1}`
          : `Pasted sample ${samples.length + 1}`,
      text,
      chars,
      sourceType: "paste",
    };
    if (!add(sample)) return;
    onAdd([sample]);
    setPasteText("");
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setFileErrors([]);
    setUploading(true);
    try {
      const form = new FormData();
      for (const file of Array.from(files).slice(0, 5)) {
        form.append("files", file);
      }
      const result = await apiUpload<ExtractResponse>(
        "/api/style-profile/extract",
        form
      );
      if (result.samples.length) {
        const accepted: StyleSample[] = [];
        let nextCount = samples.length;
        let nextTotal = totalChars;
        for (const sample of result.samples) {
          if (nextCount >= STYLE_LIMITS.maxSamples) {
            setError(c.maxSamples);
            break;
          }
          if (nextTotal + sample.chars > STYLE_LIMITS.maxTotalChars) {
            setError(c.maxChars);
            break;
          }
          accepted.push(sample);
          nextCount += 1;
          nextTotal += sample.chars;
        }
        if (accepted.length) onAdd(accepted);
      }
      if (result.errors.length) setFileErrors(result.errors);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : c.failed);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="app-card p-4 sm:p-5" data-testid="style-importer">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title text-base">{c.importTitle}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            {c.importHint}
          </p>
        </div>
        <span className="chip">
          <Icon name="text" size={12} />
          {totalChars} {c.chars}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <label htmlFor="style-paste" className="field-label">
            {c.pasteLabel}
          </label>
          <textarea
            id="style-paste"
            data-testid="style-paste"
            className="textarea mt-1.5 min-h-[150px]"
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={c.pastePlaceholder}
            disabled={disabled}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addPaste}
              disabled={disabled || !pasteText.trim()}
            >
              <Icon name="spark" size={16} />
              {c.addPaste}
            </button>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              onChange={(event) => void uploadFiles(event.target.files)}
              disabled={disabled || uploading}
              data-testid="style-file-input"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || uploading}
            >
              <Icon name={uploading ? "loader" : "upload"} size={16} />
              {uploading ? c.uploading : c.upload}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            {c.fileHint}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
          <p className="text-xs font-medium text-slate-700">{c.sampleList}</p>
          {samples.length === 0 ? (
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {c.noSamples}
            </p>
          ) : (
            <ul className="mt-2 space-y-2" data-testid="style-sample-list">
              {samples.map((sample) => (
                <li
                  key={sample.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-700">
                        {sample.name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {SOURCE_LABELS[sample.sourceType]} · {sample.chars}{" "}
                        {c.chars}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost !min-h-[32px] !px-1.5"
                      onClick={() => onRemove(sample.id)}
                      aria-label={c.removeSample}
                      title={c.removeSample}
                      disabled={disabled}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                    {sample.text.slice(0, 180)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 border-t border-[var(--border)] pt-2 text-[11px] tabular-nums text-muted">
            {c.total}: {samples.length}/8 · {totalChars}/{STYLE_LIMITS.maxTotalChars}{" "}
            {c.chars}
          </p>
        </div>
      </div>

      {!enough && samples.length > 0 ? (
        <div className="mt-3">
          <Notice tone="warning">{c.sampleTooShort}</Notice>
        </div>
      ) : limited ? (
        <div className="mt-3">
          <Notice tone="warning">{c.sampleLimited}</Notice>
        </div>
      ) : samples.length >= 2 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">{c.sampleMixed}</p>
      ) : null}

      {error ? (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      {fileErrors.length ? (
        <div className="mt-3 space-y-2">
          <Notice tone="warning" title={c.fileErrors}>
            <ul className="space-y-1">
              {fileErrors.map((item) => (
                <li key={`${item.name}-${item.message}`}>
                  <span className="font-medium">{item.name}</span>：{item.message}
                </li>
              ))}
            </ul>
          </Notice>
        </div>
      ) : null}
    </section>
  );
}
