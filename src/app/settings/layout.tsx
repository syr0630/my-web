import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "设置",
  description:
    "Draftly 设置：界面语言、默认文本处理语言、输入限制、隐私说明与 AI 服务状态。",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}