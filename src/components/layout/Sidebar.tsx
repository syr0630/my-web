"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/common/Icon";
import { Logo } from "@/components/layout/Logo";
import { NAV_ITEMS, isActivePath } from "@/components/layout/nav-items";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function Sidebar() {
  const pathname = usePathname();
  const { t, uiLocale, setUiLocale } = useLocale();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[268px] shrink-0 flex-col border-r border-[var(--border)] bg-white px-4 py-6 lg:flex">
      <div className="px-2">
        <Logo showTagline />
      </div>

      <nav className="mt-8 flex flex-col gap-1" aria-label={t.brand}>
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="nav-link group"
            >
              <Icon
                name={item.icon}
                size={19}
                className={active ? "text-[var(--primary)]" : "text-slate-400"}
              />
              <span className="flex-1">{t.nav[item.key]}</span>
              {item.stage ? (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  P{item.stage}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 pt-8">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            <Icon name="globe" size={14} />
            {t.settings.uiLocale}
          </p>
          <div className="segmented" role="group" aria-label={t.settings.uiLocale}>
            <button
              type="button"
              className="segmented-item"
              aria-pressed={uiLocale === "zh-CN"}
              onClick={() => setUiLocale("zh-CN")}
            >
              中文
            </button>
            <button
              type="button"
              className="segmented-item"
              aria-pressed={uiLocale === "en"}
              onClick={() => setUiLocale("en")}
            >
              English
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Icon name="shield" size={14} className="text-[var(--success)]" />
            {t.footer.privacy}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            {t.common.aiNotice}
          </p>
          <Link
            href="/settings"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--primary)]"
          >
            {t.settings.title}
            <Icon name="arrowRight" size={12} />
          </Link>
        </div>
      </div>
    </aside>
  );
}