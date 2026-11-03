import { notEnabledResponse } from "@/lib/errors";

export const runtime = "nodejs";

/** Reserved for phase 2 (DOCX / TXT export). */
export async function POST() {
  return notEnabledResponse("文档导出");
}