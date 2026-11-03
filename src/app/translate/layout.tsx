import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "中英翻译",
  description:
    "使用 Draftly 在中英文之间自然翻译，支持自动识别、语言交换、自然/正式/学术三种风格，译文可编辑并送到润色或语法检查。",
};

export default function TranslateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}