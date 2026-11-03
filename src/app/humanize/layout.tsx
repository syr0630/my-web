import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "人性化改写",
  description:
    "Draftly 人性化改写：改善生硬与模板化表达，保留观点与事实，逐句查看与恢复修改。",
};

export default function HumanizeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}