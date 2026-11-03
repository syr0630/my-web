"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Props = {
  onRun: () => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCancel: () => void;
  canUndo: boolean;
  canRedo: boolean;
  copyText: string;
  primaryLabel: string;
  loading?: boolean;
  disabled?: boolean;
};

export function EditorToolbar({
  onRun,
  onClear,
  onUndo,
  onRedo,
  onCancel,
  canUndo,
  canRedo,
  copyText,
  primaryLabel,
  loading,
  disabled,
}: Props) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const clearTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
    };
  }, []);

  async function handleCopy() {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setCopyError(false);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopyError(false), 2600);
    }
  }

  function handleClear() {
    if (!confirmClear) {
      setConfirmClear(true);
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
      clearTimer.current = window.setTimeout(
        () => setConfirmClear(false),
        3200
      );
      return;
    }
    setConfirmClear(false);
    onClear();
  }

  const primaryText = loading ? t.common.processing : primaryLabel;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn btn-primary min-w-[116px]"
        data-testid="run-button"
        disabled={loading || disabled}
        onClick={onRun}
      >
        <Icon
          name={loading ? "loader" : "sparkles"}
          size={17}
          className={loading ? "spin" : undefined}
        />
        <span>{primaryText}</span>
      </button>

      {loading ? (
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          <Icon name="close" size={15} />
          {t.common.cancel}
        </button>
      ) : null}

      <span
        className="mx-0.5 hidden h-6 w-px bg-[var(--border)] sm:inline-block"
        aria-hidden="true"
      />

      <button
        type="button"
        className="btn btn-secondary"
        data-testid="copy-button"
        onClick={handleCopy}
        disabled={!copyText || loading}
      >
        <Icon name="copy" size={15} />
        {copyError
          ? t.common.copyFailed
          : copied
            ? t.common.copied
            : t.common.copy}
      </button>

      <button
        type="button"
        className="btn btn-secondary !px-2.5"
        data-testid="undo-button"
        onClick={onUndo}
        disabled={!canUndo || loading}
        aria-label={t.common.undo}
        title={t.common.undo}
      >
        <Icon name="undo" size={16} />
        <span className="hidden sm:inline">{t.common.undo}</span>
      </button>

      <button
        type="button"
        className="btn btn-secondary !px-2.5"
        data-testid="redo-button"
        onClick={onRedo}
        disabled={!canRedo || loading}
        aria-label={t.common.redo}
        title={t.common.redo}
      >
        <Icon name="redo" size={16} />
        <span className="hidden sm:inline">{t.common.redo}</span>
      </button>

      <button
        type="button"
        className={`btn !px-2.5 ${
          confirmClear
            ? "border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]"
            : "btn-danger"
        }`}
        data-testid="clear-button"
        onClick={handleClear}
        disabled={loading}
        aria-label={confirmClear ? t.common.clearConfirm : t.common.clear}
        title={confirmClear ? t.common.clearConfirm : t.common.clear}
      >
        <Icon name="trash" size={16} />
        <span className="text-xs">
          {confirmClear ? t.common.clearConfirm : t.common.clear}
        </span>
      </button>

      <span className="sr-only" role="status" aria-live="polite">
        {copied ? t.common.copiedToClipboard : ""}
      </span>
    </div>
  );
}
