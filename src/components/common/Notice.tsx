"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/common/Icon";

export type NoticeTone = "info" | "success" | "warning" | "error";

type Props = {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  meta?: string;
  testId?: string;
};

const TONE_STYLES: Record<
  NoticeTone,
  { box: string; icon: IconName; iconColor: string }
> = {
  info: {
    box: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)]",
    icon: "info",
    iconColor: "text-[var(--primary)]",
  },
  success: {
    box: "border-[var(--primary)] bg-[var(--primary-softer)] text-[var(--text)]",
    icon: "checkBadge",
    iconColor: "text-[var(--primary)]",
  },
  warning: {
    box: "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--text)]",
    icon: "alert",
    iconColor: "text-[var(--warning)]",
  },
  error: {
    box: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--text)]",
    icon: "alert",
    iconColor: "text-[var(--danger)]",
  },
};

export function Notice({
  tone = "info",
  title,
  children,
  onRetry,
  retryLabel,
  meta,
  testId,
}: Props) {
  const style = TONE_STYLES[tone];

  return (
    <div
      className={`flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${style.box}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      data-testid={testId}
    >
      <Icon
        name={style.icon}
        size={18}
        className={`mt-0.5 shrink-0 ${style.iconColor}`}
      />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={title ? "mt-0.5" : undefined}>{children}</div>
        {meta ? (
          <p className="mt-1 font-mono text-[11px] opacity-70">{meta}</p>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          className="shrink-0 self-start rounded-lg border border-current/20 px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface)]"
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}