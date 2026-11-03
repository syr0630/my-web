import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "写作风格画像",
  description:
    "导入参考文本，用真实 AI 分析写作风格并保存为可复用画像，在文本润色中保持文风一致。",
};

export default function StyleProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}