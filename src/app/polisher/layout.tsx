import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "文本润色",
  description:
    "使用 Draftly 对中文或英文草稿进行润色：九种标准、三种强度，真实差异高亮与逐句恢复。",
};

export default function PolisherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}