import type { CSSProperties } from "react";
import type { IconName } from "@/components/common/Icon";

export type NavKey =
  | "home"
  | "humanize"
  | "polisher"
  | "translate"
  | "grammar"
  | "detector"
  | "style"
  | "academic"
  | "feedback"
  | "settings";

export type ToolTone =
  | "humanize"
  | "translate"
  | "polisher"
  | "grammar"
  | "detector"
  | "style"
  | "academic"
  | "feedback";

export type NavItem = {
  href: string;
  key: NavKey;
  icon: IconName;
  tone: ToolTone;
  descriptionZh?: string;
  descriptionEn?: string;
  stage?: 2 | 3;
};

export const TOOL_ITEMS: readonly NavItem[] = [
  {
    href: "/humanize",
    key: "humanize",
    icon: "sparkles",
    tone: "humanize",
    descriptionZh: "改善生硬、重复与模板化表达，保留你的观点与事实。",
    descriptionEn:
      "Loosen stiff, repetitive, templated prose without changing your point.",
  },
  {
    href: "/translate",
    key: "translate",
    icon: "globe",
    tone: "translate",
    descriptionZh: "在中文与英文之间自然转换，保留事实、术语与段落结构。",
    descriptionEn:
      "Move naturally between Chinese and English while keeping facts and structure.",
  },
  {
    href: "/polisher",
    key: "polisher",
    icon: "pen",
    tone: "polisher",
    descriptionZh: "选择标准与强度，改善表达；每一处改动都会高亮显示。",
    descriptionEn:
      "Choose a standard and strength. Every edit is highlighted for review.",
  },
  {
    href: "/grammar",
    key: "grammar",
    icon: "checkBadge",
    tone: "grammar",
    descriptionZh: "逐句检查语法、拼写、标点与搭配，修改前先看清每一处。",
    descriptionEn:
      "Check grammar, spelling, punctuation and collocation sentence by sentence.",
  },
  {
    href: "/ai-detector",
    key: "detector",
    icon: "scan",
    tone: "detector",
    descriptionZh: "从语言特征估计文本的 AI 写作倾向，并明确标出不确定性。",
    descriptionEn:
      "Estimate AI-writing tendencies from language features, with uncertainty stated.",
  },
  {
    href: "/tools/style-profile",
    key: "style",
    icon: "spark",
    tone: "style",
    descriptionZh: "导入你喜欢的文本，分析语气、用词、句式和节奏，保存成可复用的风格画像。",
    descriptionEn:
      "Analyse the voice, diction and rhythm of writing you like, then reuse it.",
  },
  {
    href: "/academic",
    key: "academic",
    icon: "book",
    tone: "academic",
    descriptionZh: "面向社会科学与人文学科，提供学术审阅、结构分析和语言润色。",
    descriptionEn:
      "Academic review, structural analysis and language polish for the humanities.",
  },
];

export const FEEDBACK_ITEM: NavItem = {
  href: "/feedback",
  key: "feedback",
  icon: "message",
  tone: "feedback",
  descriptionZh: "提交使用意见、功能建议和问题反馈。",
  descriptionEn: "Send a usage note, a feature request, or a problem report.",
};

export const HOME_TABS: readonly NavItem[] = [...TOOL_ITEMS, FEEDBACK_ITEM];

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", key: "home", icon: "home", tone: "feedback" },
  ...TOOL_ITEMS,
  FEEDBACK_ITEM,
  { href: "/settings", key: "settings", icon: "sliders", tone: "feedback" },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function toneStyle(tone: ToolTone): CSSProperties {
  return {
    "--tab-bg": `var(--tone-${tone})`,
    "--tab-ink": `var(--tone-${tone}-ink)`,
    "--tone-bg": `var(--tone-${tone})`,
    "--tone-ink": `var(--tone-${tone}-ink)`,
    "--tone-accent": `var(--tone-${tone}-accent)`,
  } as CSSProperties;
}