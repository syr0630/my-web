import { unzipSync, strFromU8 } from "fflate";
import { AppError } from "@/lib/errors";
import { countVisibleChars } from "@/lib/text/char-count";
import { MAX_STYLE_SAMPLE_CHARS } from "@/lib/style-profile/validate";

export type ExtractedStyleFile = {
  text: string;
  sourceType: "txt" | "docx" | "pdf";
};

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10))
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodePlainText(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer.subarray(2));
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer.subarray(2));
  }

  const bytes = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
    ? buffer.subarray(3)
    : buffer;

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Many Chinese TXT files are GBK/GB18030 rather than UTF-8.
    return new TextDecoder("gb18030").decode(bytes);
  }
}

function extractDocx(buffer: Buffer): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new AppError({
      message: "这个 DOCX 文件无法解压，可能已损坏或并不是 Word 文档。",
      error_code: "DOCX_INVALID",
      status: 422,
    });
  }

  const documentFile = files["word/document.xml"];
  if (!documentFile) {
    throw new AppError({
      message: "DOCX 中找不到正文，请确认文件未加密且可正常打开。",
      error_code: "DOCX_NO_TEXT",
      status: 422,
    });
  }

  const xml = strFromU8(documentFile)
    .replace(/<w:del\b[\s\S]*?<\/w:del>/g, "")
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "");

  return normalizeExtractedText(decodeXml(xml));
}

async function extractPdf(buffer: Buffer): Promise<string> {
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new AppError({
      message: "这个文件不是有效的 PDF。",
      error_code: "PDF_INVALID",
      status: 422,
    });
  }

  let text = "";
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
  } catch {
    throw new AppError({
      message: "PDF 文本提取失败，文件可能已加密或损坏。",
      error_code: "PDF_EXTRACT_FAILED",
      status: 422,
    });
  }

  const normalized = normalizeExtractedText(text);
  if (normalized.replace(/\s/g, "").length < 20) {
    throw new AppError({
      message:
        "这个 PDF 没有可提取的文字，可能是扫描件。当前版本不支持 OCR，因此不会假装完成分析。",
      error_code: "PDF_NO_TEXT",
      status: 422,
    });
  }
  return normalized;
}

export async function extractStyleFile(input: {
  name: string;
  mime: string;
  buffer: Buffer;
}): Promise<ExtractedStyleFile> {
  const lower = input.name.toLowerCase();
  const mime = input.mime.toLowerCase();
  let sourceType: ExtractedStyleFile["sourceType"];
  let text: string;

  if (lower.endsWith(".pdf") || mime === "application/pdf") {
    sourceType = "pdf";
    text = await extractPdf(input.buffer);
  } else if (
    lower.endsWith(".docx") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    sourceType = "docx";
    text = extractDocx(input.buffer);
  } else if (
    lower.endsWith(".txt") ||
    mime === "text/plain" ||
    mime === "text/markdown"
  ) {
    sourceType = "txt";
    text = normalizeExtractedText(decodePlainText(input.buffer));
  } else if (lower.endsWith(".doc")) {
    throw new AppError({
      message: "暂不支持旧版 .doc，请另存为 .docx 或粘贴文本。",
      error_code: "STYLE_FILE_TYPE",
      status: 415,
    });
  } else {
    throw new AppError({
      message: "仅支持 TXT、DOCX 和 PDF 文件。",
      error_code: "STYLE_FILE_TYPE",
      status: 415,
    });
  }

  if (!text.trim()) {
    throw new AppError({
      message: "没有从文件中提取到可用文字。",
      error_code: "STYLE_NO_TEXT",
      status: 422,
    });
  }

  const chars = countVisibleChars(text);
  if (chars > MAX_STYLE_SAMPLE_CHARS) {
    throw new AppError({
      message: `提取到 ${chars} 个可见字符，超过单份 ${MAX_STYLE_SAMPLE_CHARS} 字上限，请截取后再导入。`,
      error_code: "STYLE_SAMPLE_TOO_LONG",
      status: 422,
    });
  }

  return { text, sourceType };
}