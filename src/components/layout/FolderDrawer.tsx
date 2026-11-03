"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/common/Icon";
import { Logo } from "@/components/layout/Logo";
import {
  NAV_ITEMS,
  isActivePath,
  toneStyle,
} from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function FolderDrawer({ open, onClose }: Props) {
  const pathname = usePathname();
  const { t, uiLocale, setUiLocale } = useLocale();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 30);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select, input, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => node.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const home = NAV_ITEMS.find((item) => item.key === "home");
  const tools = NAV_ITEMS.filter(
    (item) => !["home", "settings", "feedback"].includes(item.key)
  );
  const footerItems = NAV_ITEMS.filter((item) =>
    ["feedback", "settings"].includes(item.key)
  );

  return (
    <>
      <button
        type="button"
        className="drawer-backdrop"
        aria-label={t.common.closeMenu}
        tabIndex={-1}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        id="folder-drawer"
        className="folder-drawer"
        data-open="true"
        data-testid="folder-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t.brand}
      >
        <div className="drawer-head">
          <Logo showTagline />
          <button
            ref={closeRef}
            type="button"
            className="app-icon-link"
            onClick={onClose}
            aria-label={t.common.closeMenu}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="drawer-body">
          {home ? (
            <Link
              href={home.href}
              onClick={onClose}
              className="drawer-link"
              aria-current={isActivePath(pathname, home.href) ? "page" : undefined}
              style={toneStyle(home.tone)}
            >
              <span className="drawer-tone">
                <Icon name={home.icon} size={18} />
              </span>
              <span className="drawer-link-label">{t.nav.home}</span>
              <Icon name="arrowRight" size={14} className="text-[var(--muted)]" />
            </Link>
          ) : null}

          <p className="drawer-section-label">WRITING TOOLS / 07</p>
          <nav className="drawer-nav" aria-label={t.brand}>
            {tools.map((item, index) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className="drawer-link"
                  style={toneStyle(item.tone)}
                >
                  <span className="drawer-tone">
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span className="drawer-link-label">{t.nav[item.key]}</span>
                  <span className="drawer-link-meta">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </Link>
              );
            })}
          </nav>

          <p className="drawer-section-label">MORE</p>
          <nav className="drawer-nav" aria-label={t.nav.feedback}>
            {footerItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className="drawer-link"
                  style={toneStyle(item.tone)}
                >
                  <span className="drawer-tone">
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span className="drawer-link-label">{t.nav[item.key]}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="drawer-foot">
          <div className="drawer-foot-row">
            <span className="drawer-foot-label">
              <Icon name="globe" size={14} />
              {t.settings.uiLocale}
            </span>
            <div className="segmented !w-auto" role="group" aria-label={t.settings.uiLocale}>
              <button
                type="button"
                className="segmented-item !w-auto !px-2.5"
                aria-pressed={uiLocale === "zh-CN"}
                onClick={() => setUiLocale("zh-CN")}
              >
                中文
              </button>
              <button
                type="button"
                className="segmented-item !w-auto !px-2.5"
                aria-pressed={uiLocale === "en"}
                onClick={() => setUiLocale("en")}
              >
                EN
              </button>
            </div>
          </div>
          <div className="drawer-foot-row">
            <span className="drawer-foot-label">
              <Icon name="shield" size={14} />
              {t.footer.privacy}
            </span>
            <ThemeToggle withLabel />
          </div>
          <p className="text-[10px] leading-relaxed text-muted">
            {t.common.aiNotice}
          </p>
        </div>
      </aside>
    </>
  );
}