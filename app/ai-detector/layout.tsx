import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI 文本检测",
  description:
    "Draftly 的 AI 文本检测提供基于语言特征的概率性辅助估计，并明确说明其局限，不将结果表述为作者身份证明。",
};

export default function DetectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}