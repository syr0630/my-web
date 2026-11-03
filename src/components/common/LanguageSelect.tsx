"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { ContentLanguage } from "@/types";

type Props = {
  value: ContentLanguage;
  onChange: (value: ContentLanguage) => void;
  showUnreliableHint?: boolean;
  disabled?: boolean;
};

export function LanguageSelect({
  value,
  onChange,
  showUnreliableHint,
  disabled,
}: Props) {
  const { t } = useLocale();

  const options: { value: ContentLanguage; label: string }[] = [
    { value: "auto", label: t.common.auto },
    { value: "zh-CN", label: t.common.zh },
    { value: "en", label: t.common.en },
    { value: "mixed", label: t.common.mixed },
  ];

  return (
    <div className="space-y-1.5">
      <span className="field-label">{t.common.language}</span>
      <div
        className="segmented"
        role="group"
        aria-label={t.common.language}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="segmented-item"
            aria-pressed={value === opt.value}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {showUnreliableHint ? (
        <p className="text-[11px] leading-relaxed text-[var(--warning)]">
          {t.common.unreliableLang}
        </p>
      ) : null}
    </div>
  );
}