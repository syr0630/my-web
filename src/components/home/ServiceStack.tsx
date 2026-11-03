"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import { Icon } from "@/components/common/Icon";
import { TOOL_ITEMS, toneStyle } from "@/components/layout/nav-items";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function ServiceStack() {
  const { t, uiLocale } = useLocale();
  const en = uiLocale === "en";
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = stackRef.current;
    if (!root) return;
    if (!window.matchMedia("(min-width: 641px)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const shells = Array.from(
        root.querySelectorAll<HTMLElement>(".service-card-shell")
      );
      shells.forEach((shell) => {
        const card = shell.querySelector<HTMLElement>(".service-card");
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const index = Number(shell.dataset.index ?? 0);
        const expectedTop = 94 + index * 12;
        shell.dataset.stuck = rect.top <= expectedTop + 2 ? "true" : "false";
      });
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="service-stack" ref={stackRef} data-testid="service-stack">
      {TOOL_ITEMS.map((item, index) => {
        const description = en ? item.descriptionEn : item.descriptionZh;
        return (
          <div
            key={item.href}
            className="service-card-shell"
            data-index={index}
            data-testid={`tool-${item.key}`}
            style={
              {
                "--i": index,
                ...toneStyle(item.tone),
              } as CSSProperties
            }
          >
            <Link href={item.href} className="service-card">
              <span className="service-index">
                {String(index + 1).padStart(2, "0")} / 07
              </span>
              <span className="service-icon">
                <Icon name={item.icon} size={20} />
              </span>
              <span className="service-copy">
                <h3>{t.nav[item.key]}</h3>
                <p>{description}</p>
              </span>
              <Icon name="arrowRight" size={18} className="service-arrow" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}