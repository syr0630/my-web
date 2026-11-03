"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { FolderDrawer } from "@/components/layout/FolderDrawer";
import { Logo } from "@/components/layout/Logo";
import { NAV_ITEMS, isActivePath } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, ready } = useLocale();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const isHome = pathname === "/";
  const isAdmin = pathname.startsWith("/admin");
  const isLegal = pathname === "/privacy" || pathname === "/terms";

  if (isHome || isAdmin) {
    return (
      <div data-app-ready={ready ? "true" : "false"}>
        <a className="skip-link" href="#main">
          {t.common.skipToContent}
        </a>
        {children}
      </div>
    );
  }

  if (isLegal) {
    return (
      <div className="app-frame" data-app-ready={ready ? "true" : "false"}>
        <a className="skip-link" href="#main">
          {t.common.skipToContent}
        </a>
        <header className="app-topbar">
          <div className="app-topbar-left">
            <Link href="/" className="app-icon-link" aria-label={t.nav.home}>
              <Icon name="arrowRight" size={18} className="rotate-180" />
            </Link>
            <Logo />
          </div>
          <div className="app-topbar-right">
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="app-main">
          <div className="page-container fade-up">{children}</div>
        </main>
      </div>
    );
  }

  const active = NAV_ITEMS.find((item) => isActivePath(pathname, item.href));
  const activeLabel = active ? t.nav[active.key] : t.nav.home;

  return (
    <div className="app-frame" data-app-ready={ready ? "true" : "false"}>
      <a className="skip-link" href="#main">
        {t.common.skipToContent}
      </a>

      <header className="app-topbar">
        <div className="app-topbar-left">
          <button
            type="button"
            className="app-menu-button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="folder-drawer"
            aria-label={t.common.menu}
          >
            <Icon name="menu" size={18} />
            <span>{t.common.menu}</span>
          </button>
          <Logo />
          <span className="app-crumb" aria-hidden="true">
            <span className="crumb-slash">/</span>
            <strong>{activeLabel}</strong>
          </span>
        </div>

        <div className="app-topbar-right">
          <ThemeToggle />
          <Link
            href="/settings"
            className="app-icon-link"
            aria-label={t.nav.settings}
            title={t.nav.settings}
          >
            <Icon name="sliders" size={18} />
          </Link>
          <Link
            href="/"
            className="app-icon-link hidden sm:inline-flex"
            aria-label={t.nav.home}
            title={t.nav.home}
          >
            <Icon name="folder" size={18} />
          </Link>
        </div>
      </header>

      <main id="main" className="app-main">
        <div key={pathname} className="page-container fade-up">
          {children}
        </div>
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <span>
            Draftly · {t.footer.note}
          </span>
          <div className="flex items-center gap-3">
            <Link href="/feedback">{t.nav.feedback}</Link>
            <span aria-hidden="true">·</span>
            <Link href="/privacy">{t.footer.privacy}</Link>
            <span aria-hidden="true">·</span>
            <span>{t.tagline}</span>
          </div>
        </div>
      </footer>

      <FolderDrawer open={drawerOpen} onClose={closeDrawer} />
    </div>
  );
}