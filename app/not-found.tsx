"use client";

import Link from "next/link";
import { Icon } from "@/components/common/Icon";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function NotFound() {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon name="scan" size={26} />
      </span>
      <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
        404
      </p>
      <h1 className="text-2xl font-semibold text-[var(--text)]">
        {t.common.notFoundTitle}
      </h1>
      <p className="text-sm leading-relaxed text-muted">
        {t.common.notFoundBody}
      </p>
      <Link href="/" className="btn btn-primary">
        {t.common.backHome}
        <Icon name="arrowRight" size={16} />
      </Link>
    </div>
  );
}