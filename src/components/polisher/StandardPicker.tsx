"use client";

import { POLISH_STANDARDS } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { PolishStandard } from "@/types";

type Props = {
  value: PolishStandard;
  onChange: (value: PolishStandard) => void;
  disabled?: boolean;
};

export function StandardPicker({ value, onChange, disabled }: Props) {
  const { t } = useLocale();

  return (
    <div className="space-y-1.5">
      <span className="field-label">{t.polisher.standardLabel}</span>
      <div
        className="flex flex-wrap gap-1.5 lg:flex-nowrap"
        role="group"
        aria-label={t.polisher.standardLabel}
      >
        {POLISH_STANDARDS.map((standard) => (
          <button
            key={standard}
            type="button"
            className="capsule !px-3 text-[13px]"
            aria-pressed={value === standard}
            disabled={disabled}
            onClick={() => onChange(standard)}
          >
            {t.polisher.standards[standard]}
          </button>
        ))}
      </div>
    </div>
  );
}