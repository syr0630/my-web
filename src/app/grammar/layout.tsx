import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "语法检查",
  description:
    "使用 Draftly 逐句检查中英文语法、拼写、标点与搭配，定位具体位置并逐条应用或忽略修改。",
};

export default function GrammarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}