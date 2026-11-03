"use client";

import { INTENSITIES } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Intensity } from "@/types";

type Props = {
  value: Intensity;
  onChange: (value: Intensity) => void;
  disabled?: boolean;
};

export function IntensityPicker({ value, onChange, disabled }: Props) {
  const { t } = useLocale();
  const labels: Record<Intensity, string> = {
    light: t.common.light,
    moderate: t.common.moderate,
    strong: t.common.strong,
  };

  return (
    <div className="space-y-1.5">
      <span className="field-label">{t.common.intensity}</span>
      <div
        className="segmented"
        role="group"
        aria-label={t.common.intensity}
      >
        {INTENSITIES.map((item) => (
          <button
            key={item}
            type="button"
            className="segmented-item"
            aria-pressed={value === item}
            disabled={disabled}
            onClick={() => onChange(item)}
          >
            {labels[item]}
          </button>
        ))}
      </div>
    </div>
  );
}