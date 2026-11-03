import { strFromU8, unzipSync } from "fflate";
import { ACADEMIC_MAX_CHARS, ACADEMIC_MAX_FILE_BYTES } from "@/lib/constants";
import { AppError, errorResponse, jsonHeaders, makeRequestId } from "@/lib/errors";
import { assertRateLimit, getClientKey } from "@/lib/rate-limit";
import { countVisibleChars } from "@/lib/text/char-count";
import type { DocumentExtractResponse } from "@/types";

export const runtime = "nodejs";

const TEXT_EXTENSIONS = [".txt", ".md", ".markdown"];
const DOCX_EXTENSION = ".docx";
const BLOCKED_EXTENSIONS = [".pdf", ".doc", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10))
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * DOCX is a ZIP with word/document.xml. Extract visible text only; never render
 * or interpret the XML. Headers, footnotes and tracked-change metadata are out
 * of scope, so the user can review the imported body before running the skill.
 */
function extractDocxText(xml: string): string {
  const normalized = xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n");

  const paragraphs: string[] = [];
  for (const block of normalized.split(/<\/w:p>/)) {
    const parts: string[] = [];
    const pattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(block))) {
      parts.push(decodeXml(match[1]));
    }
    const paragraph = parts.join("").replace(/\s+$/g, "");
    if (paragraph.trim()) paragraphs.push(paragraph);
  }

  return paragraphs.join("\n\n").trim();
}

export async function POST(request: Request) {
  const request_id = makeRequestId();

  try {
    assertRateLimit(getClientKey(request), 12);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError({
        message: "请选择要上传的文档。",
        error_code: "MISSING_FILE",
        status: 400,
      });
    }

    const filename = file.name.slice(0, 200);
    const extension = extensionOf(filename);
    const mime = (file.type || "").toLowerCase();

    if (mime.startsWith("image/") || BLOCKED_EXTENSIONS.includes(extension)) {
      const reason = extension === ".pdf" || mime === "application/pdf"
        ? "PDF"
        : extension === ".doc"
          ? "旧版 .doc"
          : "图片或扫描件";
      throw new AppError({
        message: `不支持${reason}文件。请上传 DOCX、TXT 或 Markdown；图片类论文请先转成可编辑文本。`,
        error_code: "UNSUPPORTED_FILE_TYPE",
        status: 415,
      });
    }

    if (!TEXT_EXTENSIONS.includes(extension) && extension !== DOCX_EXTENSION) {
      throw new AppError({
        message: "仅支持 DOCX、TXT 和 Markdown 文件。",
        error_code: "UNSUPPORTED_FILE_TYPE",
        status: 415,
      });
    }

    if (file.size > ACADEMIC_MAX_FILE_BYTES) {
      throw new AppError({
        message: `文件超过 ${Math.round(ACADEMIC_MAX_FILE_BYTES / 1024 / 1024)} MB 限制。`,
        error_code: "FILE_TOO_LARGE",
        status: 413,
      });
    }

    let text: string;
    const buffer = new Uint8Array(await file.arrayBuffer());
    const magic = Array.from(buffer.slice(0, 8));
    const looksLikePdf =
      magic[0] === 0x25 &&
      magic[1] === 0x50 &&
      magic[2] === 0x44 &&
      magic[3] === 0x46;
    const looksLikeImage =
      (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47) ||
      (magic[0] === 0xff && magic[1] === 0xd8) ||
      (magic[0] === 0x47 && magic[1] === 0x49 && magic[2] === 0x46);
    if (looksLikePdf || looksLikeImage) {
      throw new AppError({
        message: "不支持 PDF 或图片文件。请上传 DOCX、TXT 或 Markdown 的可编辑文本。",
        error_code: "UNSUPPORTED_FILE_TYPE",
        status: 415,
      });
    }

    if (extension === DOCX_EXTENSION) {
      let xml: string;
      try {
        const zip = unzipSync(buffer, {
          filter: (entry) => entry.name === "word/document.xml",
        });
        const documentXml = zip["word/document.xml"];
        if (!documentXml) throw new Error("word/document.xml is missing");
        xml = strFromU8(documentXml);
      } catch {
        throw new AppError({
          message: "无法读取这个 DOCX 文件，请确认文件没有损坏或加密。",
          error_code: "INVALID_DOCX",
          status: 400,
        });
      }
      text = extractDocxText(xml);
    } else {
      text = new TextDecoder("utf-8", { fatal: false })
        .decode(buffer)
        .replace(/^\uFEFF/, "");
    }

    text = text.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
    if (!text) {
      throw new AppError({
        message: "文档中没有可读取的文字。",
        error_code: "EMPTY_DOCUMENT",
        status: 400,
      });
    }

    const chars = countVisibleChars(text);
    if (chars > ACADEMIC_MAX_CHARS) {
      throw new AppError({
        message: `文档有 ${chars} 个字符，超过单次 ${ACADEMIC_MAX_CHARS} 字符限制。请按章节拆分后再上传。`,
        error_code: "DOCUMENT_TOO_LONG",
        status: 400,
      });
    }

    const payload: DocumentExtractResponse = {
      request_id,
      text,
      filename,
      chars,
    };

    return Response.json(payload, { headers: jsonHeaders(request_id) });
  } catch (error) {
    return errorResponse(error, request_id);
  }
}