"use client";

import Link from "next/link";
import { Icon } from "@/components/common/Icon";
import { FolderTabs } from "@/components/home/FolderTabs";
import { ScrollIndicator } from "@/components/home/ScrollIndicator";
import { ServiceStack } from "@/components/home/ServiceStack";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function FolderHome() {
  const { t, uiLocale } = useLocale();
  const en = uiLocale === "en";

  return (
    <div className="home" data-app-ready="true">
      <header className="home-topbar">
        <div className="home-brand">
          <Logo />
          <span className="home-brand-sub">AI WRITING FOLDER</span>
        </div>
        <div className="home-topbar-right">
          <ThemeToggle withLabel />
          <Link href="/polisher" className="home-toplink">
            {en ? "Open the workbench" : "打开工作台"}
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="folder-hero" aria-labelledby="home-title">
          <FolderTabs />

          <div className="folder-stage">
            <div className="folder-back" aria-hidden="true" />

            <div className="folder-body">
              <span className="folder-sheet folder-sheet-a" aria-hidden="true" />
              <span className="folder-sheet folder-sheet-b" aria-hidden="true" />
              <span className="folder-sheet folder-sheet-c" aria-hidden="true" />

              <span
                className="folder-decor folder-decor-star"
                aria-hidden="true"
              >
                <StarGlyph />
              </span>
              <span
                className="folder-decor folder-decor-star small"
                aria-hidden="true"
              >
                <StarGlyph />
              </span>
              <span className="folder-decor folder-decor-line" aria-hidden="true" />

              <div className="folder-content">
                <p className="folder-eyebrow">
                  <span className="dot" aria-hidden="true" />
                  {en ? "A FOLDER FOR SEVEN WRITING TOOLS" : "一只文件袋 · 七种写作工具"}
                </p>

                <h1 className="home-title" id="home-title">
                  Draftly<span className="title-dot">.</span>
                </h1>

                <p className="home-tagline">Polish your draft in seconds.</p>

                <div className="home-cta-row">
                  <Link
                    href="/polisher"
                    className="home-cta"
                    data-testid="home-cta"
                  >
                    Meet your words
                    <Icon name="arrowRight" size={17} />
                  </Link>
                </div>
              </div>
            </div>

            <div className="folder-pocket" aria-hidden="true" />
            <ScrollIndicator />
          </div>
        </section>

        <section className="service-section" id="services">
          <header className="service-head">
            <h2>
              {en
                ? "Make every sentence closer to what you mean."
                : "让每一句话，更接近你想表达的样子。"}
            </h2>
          </header>

          <ServiceStack />
        </section>

        <section className="home-feedback" aria-labelledby="feedback-title">
          <div className="home-feedback-inner">
            <div>
              <span className="home-feedback-kicker">FEEDBACK / 08</span>
              <h2 id="feedback-title">
                {en ? "Something in the folder feels off?" : "文件袋里，还缺什么？"}
              </h2>
              <p>
                {en
                  ? "Tell us which tool you reached for, and what got in the way."
                  : "告诉我们你想用哪个工具、哪里不顺手。反馈会进入真实的后台。"}
              </p>
            </div>
            <Link href="/feedback" className="btn btn-secondary">
              {t.nav.feedback}
              <Icon name="arrowRight" size={15} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <span>
            Draftly · <span data-testid="footer-credit">一元硬币</span> · 一个关于文字与表达的小小尝试。
          </span>
          <div className="flex items-center gap-3">
            <Link href="/privacy">{t.footer.privacy}</Link>
            <span aria-hidden="true">·</span>
            <Link href="/feedback">{t.nav.feedback}</Link>
            <span aria-hidden="true">·</span>
            <span>{t.tagline}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StarGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path
        d="M12 2.5c.55 5.7 3.8 8.95 9.5 9.5-5.7.55-8.95 3.8-9.5 9.5-.55-5.7-3.8-8.95-9.5-9.5 5.7-.55 8.95-3.8 9.5-9.5Z"
        fill="currentColor"
      />
    </svg>
  );
}