"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/common/Icon";
import { PageHeader } from "@/components/common/PageHeader";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Props = {
  icon: IconName;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  plannedTitle: string;
  planned: string[];
  ctaHref: string;
  ctaLabel: string;
};

export function DisabledFeature({
  icon,
  title,
  subtitle,
  badge,
  description,
  plannedTitle,
  planned,
  ctaHref,
  ctaLabel,
}: Props) {
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        badge={
          <span className="chip !border-[var(--warning-border)] !bg-[var(--warning-bg)] !text-[var(--text)]">
            <Icon name="clock" size={12} />
            {badge}
          </span>
        }
      />

      <section className="app-card overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--muted)] shadow-sm">
              <Icon name={icon} size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--text)]">
                {badge}
              </h2>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--text-soft)]">
                {description}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            {plannedTitle}
          </h3>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {planned.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--text-soft)]"
              >
                <Icon
                  name="clock"
                  size={15}
                  className="mt-0.5 shrink-0 text-[var(--border-strong)]"
                />
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
            <Icon name="shield" size={13} className="mt-0.5 shrink-0" />
            {t.common.noFake}
          </p>

          <Link href={ctaHref} className="btn btn-primary mt-5">
            {ctaLabel}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

