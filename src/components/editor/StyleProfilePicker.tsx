"use client";

import Link from "next/link";
import { Icon } from "@/components/common/Icon";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { StyleProfileSummary } from "@/types";

type Props = {
  profiles: StyleProfileSummary[];
  value: string | null;
  onChange: (id: string | null) => void;
  loading?: boolean;
  onRefresh?: () => void;
  disabled?: boolean;
};

export function StyleProfilePicker({
  profiles,
  value,
  onChange,
  loading,
  onRefresh,
  disabled,
}: Props) {
  const { uiLocale } = useLocale();
  const en = uiLocale === "en";

  return (
    <div className="border-t border-[var(--border)] pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="style-profile-select" className="field-label">
            {en ? "Writing style" : "写作风格"}
          </label>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            {en
              ? "Default uses no profile. A saved profile adjusts tone, wording and rhythm without changing facts."
              : "默认样式不调用画像；选择已保存画像后，AI 会参考其语气、用词和句式，但不会改变事实与观点。"}
          </p>
          <select
            id="style-profile-select"
            data-testid="style-profile-select"
            className="select mt-2 w-full max-w-md"
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value || null)}
            disabled={disabled || loading}
          >
            <option value="">
              {en
                ? "Default Style (no personal profile)"
                : "Default Style（默认 AI 润色，不调用画像）"}
            </option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onRefresh ? (
            <button
              type="button"
              className="btn btn-ghost !min-h-[40px] !px-2.5"
              onClick={onRefresh}
              disabled={loading}
              aria-label={en ? "Refresh profiles" : "刷新风格画像"}
              title={en ? "Refresh profiles" : "刷新风格画像"}
            >
              <Icon name="refresh" size={16} />
            </button>
          ) : null}
          <Link
            href="/tools/style-profile"
            className="btn btn-secondary !min-h-[40px] text-xs"
          >
            <Icon name="spark" size={15} />
            {en ? "Manage profiles" : "管理风格画像"}
          </Link>
        </div>
      </div>

      {!loading && profiles.length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          {en
            ? "No saved profiles yet. Create one from your own reference writing."
            : "还没有保存的画像。可以先导入自己的参考文本，生成一个风格画像。"}
        </p>
      ) : null}

      {value ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--primary-strong)]">
          <Icon name="check" size={13} />
          {en
            ? "This polish will reference the selected profile."
            : "本次润色会参考所选风格画像。"}
        </p>
      ) : null}
    </div>
  );
}