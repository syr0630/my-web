import { AppError } from "@/lib/errors";
import { countVisibleChars } from "@/lib/text/char-count";
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
} from "@/lib/feedback/types";

export const FEEDBACK_MESSAGE_MIN = 5;
export const FEEDBACK_MESSAGE_MAX = 5000;
export const FEEDBACK_EMAIL_MAX = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type FeedbackInput = {
  email: string | null;
  category: FeedbackCategory;
  message: string;
  consent: true;
};

function invalid(message: string): never {
  throw new AppError({
    message,
    error_code: "INVALID_FEEDBACK",
    status: 400,
    retryable: false,
  });
}

/**
 * Server-side validation. The browser performs the same checks for friendly
 * inline errors, but this function is the source of truth.
 */
export function parseFeedbackInput(
  body: Record<string, unknown>
): FeedbackInput {
  // Honeypot: real users never fill this visually hidden field.
  if (typeof body.website === "string" && body.website.trim()) {
    invalid("无法提交，请刷新页面后重试。");
  }

  const category = body.category;
  if (!FEEDBACK_CATEGORIES.includes(category as FeedbackCategory)) {
    invalid("请选择有效的反馈类别。");
  }

  if (body.consent !== true) {
    invalid("请先阅读隐私说明并勾选同意。");
  }

  const rawEmail = body.email;
  if (rawEmail !== undefined && rawEmail !== null && typeof rawEmail !== "string") {
    invalid("邮箱格式不正确，请检查后重试。");
  }

  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  if (email.length > FEEDBACK_EMAIL_MAX || (email && !EMAIL_PATTERN.test(email))) {
    invalid("邮箱格式不正确，请检查后重试。");
  }

  const rawMessage = body.message;
  if (typeof rawMessage !== "string") {
    invalid("请填写反馈内容。");
  }

  const message = rawMessage.replace(/\r\n?/g, "\n").trim();
  const length = countVisibleChars(message);

  if (length < FEEDBACK_MESSAGE_MIN) {
    invalid(`反馈内容至少需要 ${FEEDBACK_MESSAGE_MIN} 个字符。`);
  }
  if (length > FEEDBACK_MESSAGE_MAX) {
    invalid(`反馈内容不能超过 ${FEEDBACK_MESSAGE_MAX} 个字符。`);
  }

  return {
    email: email || null,
    category: category as FeedbackCategory,
    message,
    consent: true,
  };
}

export function parseAdminNote(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new AppError({
      message: "内部备注格式不正确。",
      error_code: "INVALID_ADMIN_NOTE",
      status: 400,
    });
  }
  const note = value.trim();
  if (countVisibleChars(note) > 2000) {
    throw new AppError({
      message: "内部备注不能超过 2000 个字符。",
      error_code: "INVALID_ADMIN_NOTE",
      status: 400,
    });
  }
  return note || null;
}