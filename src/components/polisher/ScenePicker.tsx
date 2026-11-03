"use client";

import { WRITING_SCENES, type WritingScene } from "@/lib/constants";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Props = {
  value: WritingScene | "";
  onChange: (value: WritingScene | "") => void;
  disabled?: boolean;
};

export function ScenePicker({ value, onChange, disabled }: Props) {
  const { t } = useLocale();

  return (
    <div className="w-full space-y-1.5 sm:w-[220px]">
      <label htmlFor="scene-select" className="field-label">
        {t.polisher.scene}
      </label>
      <select
        id="scene-select"
        className="select"
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value as WritingScene | "")
        }
      >
        <option value="">{t.polisher.scenePlaceholder}</option>
        {WRITING_SCENES.map((scene) => (
          <option key={scene} value={scene}>
            {t.polisher.scenes[scene]}
          </option>
        ))}
      </select>
    </div>
  );
}