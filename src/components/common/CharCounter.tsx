"use client";

import { MAX_VISIBLE_CHARS } from "@/lib/constants";
import { countVisibleChars } from "@/lib/text/char-count";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Props = {
  text: string;
  limit?: boolean;
  id?: string;
};

export function CharCounter({ text, limit = true, id }: Props) {
  const { t } = useLocale();
  const count = countVisibleChars(text);
  const over = limit && count > MAX_VISIBLE_CHARS;

  return (
    <span
      id={id}
      className={`tabular-nums text-xs ${
        over ? "font-semibold text-[var(--danger)]" : "text-muted"
      }`}
    >
      {limit ? `${count} / ${MAX_VISIBLE_CHARS}` : count}{" "}
      {limit ? t.common.chars : t.common.outputChars}
    </span>
  );
}