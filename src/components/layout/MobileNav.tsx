"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { Logo } from "@/components/layout/Logo";
import { NAV_ITEMS, isActivePath } from "@/components/layout/nav-items";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function MobileNav() {
  const pathname = usePathname();
  const { t, uiLocale, setUiLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white lg:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <Logo size="sm" />

        <div className="flex items-center gap-2">
          <div
            className="hidden items-center rounded-full border border-[var(--border)] p-0.5 sm:flex"
            role="group"
            aria-label={t.settings.uiLocale}
          >
            <button
              type="button"
              className={`min-h-[32px] rounded-full px-2.5 text-xs font-medium ${
                uiLocale === "zh-CN"
                  ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]"
                  : "text-slate-500"
              }`}
              aria-pressed={uiLocale === "zh-CN"}
              onClick={() => setUiLocale("zh-CN")}
            >
              中文
            </button>
            <button
              type="button"
              className={`min-h-[32px] rounded-full px-2.5 text-xs font-medium ${
                uiLocale === "en"
                  ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]"
                  : "text-slate-500"
              }`}
              aria-pressed={uiLocale === "en"}
              onClick={() => setUiLocale("en")}
            >
              EN
            </button>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="btn btn-secondary !min-h-[40px] !px-2.5"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={t.common.menu}
          >
            <Icon name="menu" size={20} />
          </button>
        </div>
      </div>
      </header>

      {open ? (
        <div
          id="mobile-navigation"
          className="fixed inset-0 z-50 flex flex-col bg-white"
          role="dialog"
          aria-modal="true"
          aria-label={t.brand}
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
            <Logo size="sm" />
            <button
              ref={closeButtonRef}
              type="button"
              className="btn btn-secondary !min-h-[40px] !px-2.5"
              onClick={() => setOpen(false)}
              aria-label={t.common.closeMenu}
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3" aria-label={t.brand}>
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="nav-link !min-h-[48px] text-base"
                  >
                    <Icon
                      name={item.icon}
                      size={20}
                      className={
                        active ? "text-[var(--primary)]" : "text-slate-400"
                      }
                    />
                    <span className="flex-1">{t.nav[item.key]}</span>
                    {item.stage ? (
                      <span className="chip">P{item.stage}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="space-y-3 border-t border-[var(--border)] p-4">
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">
                {t.settings.uiLocale}
              </p>
              <div className="segmented" role="group">
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
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
              <Icon name="shield" size={14} className="mt-0.5 shrink-0" />
              {t.common.aiNotice}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}