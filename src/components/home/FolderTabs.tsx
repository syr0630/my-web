"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import {
  HOME_TABS,
  toneStyle,
  type NavItem,
} from "@/components/layout/nav-items";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function FolderTabs() {
  const { t, uiLocale } = useLocale();
  const en = uiLocale === "en";
  const router = useRouter();
  const [hoverCapable, setHoverCapable] = useState(true);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHoverCapable(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const open = (index: number) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpenIndex(index);
  };

  const scheduleClose = () => {
    if (!hoverCapable) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenIndex(null), 130);
  };

  return (
    <div className="folder-tabs-row" data-testid="folder-tabs">
      {HOME_TABS.map((item, index) => (
        <FolderTab
          key={item.href}
          item={item}
          index={index}
          label={t.nav[item.key]}
          en={en}
          open={openIndex === index}
          hoverCapable={hoverCapable}
          onOpen={() => open(index)}
          onLeave={scheduleClose}
          onNavigate={() => router.push(item.href)}
        />
      ))}
    </div>
  );
}

type TabProps = {
  item: NavItem;
  index: number;
  label: string;
  en: boolean;
  open: boolean;
  hoverCapable: boolean;
  onOpen: () => void;
  onLeave: () => void;
  onNavigate: () => void;
};

function FolderTab({
  item,
  index,
  label,
  en,
  open,
  hoverCapable,
  onOpen,
  onLeave,
  onNavigate,
}: TabProps) {
  const description = en ? item.descriptionEn : item.descriptionZh;
  const previewId = `tab-preview-${item.key}`;

  return (
    <div
      className="folder-tab-wrap"
      data-open={open ? "true" : "false"}
      style={toneStyle(item.tone)}
      onMouseEnter={onOpen}
      onMouseLeave={onLeave}
    >
      <Link
        href={item.href}
        className="folder-tab"
        data-testid={`tab-${item.key}`}
        aria-describedby={open ? previewId : undefined}
        onFocus={onOpen}
        onClick={(event) => {
          if (hoverCapable) return;
          if (!open) {
            event.preventDefault();
            onOpen();
            return;
          }
          event.preventDefault();
          onNavigate();
        }}
      >
        <Icon name={item.icon} size={15} className="tab-icon" />
        <span>{label}</span>
        <span
          className="absolute right-1.5 top-1.5 hidden h-1 w-1 rounded-full bg-current opacity-45 sm:block"
          aria-hidden="true"
        />
        <span className="sr-only">
          {String(index + 1).padStart(2, "0")}
        </span>
      </Link>

      <div className="tab-preview" id={previewId} role="status">
        <p className="tab-preview-kicker">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--tab-ink)" }}
            aria-hidden="true"
          />
          {String(index + 1).padStart(2, "0")} / {label}
        </p>
        <p>{description}</p>
        <Link className="tab-preview-link" href={item.href} onClick={onLeave}>
          {en ? "Open tool" : "打开工具"}
          <Icon name="arrowRight" size={12} />
        </Link>
      </div>
    </div>
  );
}