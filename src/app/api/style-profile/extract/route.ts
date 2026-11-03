import { randomUUID } from "node:crypto";
import { extractStyleFile } from "@/lib/style-profile/extract";
import { AppError, errorResponse, jsonHeaders, makeRequestId } from "@/lib/errors";
import { assertRateLimit, getClientKey } from "@/lib/rate-limit";
import { countVisibleChars } from "@/lib/text/char-count";

export const runtime = "nodejs";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

type ExtractedSample = {
  id: string;
  name: string;
  text: string;
  chars: number;
  sourceType: "txt" | "docx" | "pdf";
};

export async function POST(request: Request) {
  const request_id = makeRequestId();

  try {
    assertRateLimit(getClientKey(request));

    const declared = request.headers.get("content-length");
    if (declared && Number(declared) > MAX_REQUEST_BYTES) {
      throw new AppError({
        message: "上传内容过大，请一次上传少量、较小的文件。",
        error_code: "PAYLOAD_TOO_LARGE",
        status: 413,
      });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AppError({
        message: "无法读取上传文件，请重试。",
        error_code: "INVALID_BODY",
        status: 400,
      });
    }

    const files = form
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    if (!files.length) {
      throw new AppError({
        message: "请选择要导入的文件。",
        error_code: "STYLE_NO_FILES",
        status: 400,
      });
    }
    if (files.length > MAX_FILES) {
      throw new AppError({
        message: `一次最多上传 ${MAX_FILES} 个文件。`,
        error_code: "STYLE_FILE_LIMIT",
        status: 400,
      });
    }

    const samples: ExtractedSample[] = [];
    const errors: { name: string; message: string }[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        errors.push({
          name: file.name,
          message: "文件超过 10 MB 上限。",
        });
        continue;
      }
      if (file.size === 0) {
        errors.push({ name: file.name, message: "文件为空。" });
        continue;
      }

      try {
        const extracted = await extractStyleFile({
          name: file.name,
          mime: file.type,
          buffer: Buffer.from(await file.arrayBuffer()),
        });
        samples.push({
          id: randomUUID(),
          name: file.name.slice(0, 120),
          text: extracted.text,
          chars: countVisibleChars(extracted.text),
          sourceType: extracted.sourceType,
        });
      } catch (error) {
        errors.push({
          name: file.name,
          message:
            error instanceof AppError
              ? error.message
              : "文件解析失败，请确认文件未损坏。",
        });
      }
    }

    return Response.json(
      { request_id, samples, errors },
      { headers: jsonHeaders(request_id) }
    );
  } catch (error) {
    return errorResponse(error, request_id);
  }
}