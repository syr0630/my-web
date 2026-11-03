import type { Metadata } from "next";
import { FolderHome } from "@/components/home/FolderHome";

export const metadata: Metadata = {
  title: "Draftly — Polish your draft in seconds.",
  description:
    "七种写作工具，装进一只文件袋：人性化改写、中英翻译、文本润色、语法检查、AI 文本检测、风格画像与学术写作。",
};

export default function HomePage() {
  return <FolderHome />;
}