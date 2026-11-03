import type { Metadata } from "next";
import { AcademicWorkspace } from "@/components/academic/AcademicWorkspace";

export const metadata: Metadata = {
  title: "学术写作",
  description:
    "Draftly 学术写作：面向社会科学与人文学科的学术审阅、结构分析与语言润色。",
};

export default function AcademicPage() {
  return <AcademicWorkspace />;
}