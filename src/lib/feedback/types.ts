export const FEEDBACK_CATEGORIES = [
  "feature_request",
  "bug_report",
  "translation_quality",
  "writing_experience",
  "other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES = [
  "new",
  "in_progress",
  "resolved",
  "archived",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export type FeedbackRecord = {
  id: string;
  email: string | null;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  admin_note: string | null;
  consent: number;
  consented_at: string;
  created_at: string;
  updated_at: string;
};

export const FEEDBACK_CATEGORY_LABELS: Record<
  FeedbackCategory,
  { en: string; zh: string }
> = {
  feature_request: { en: "Feature request", zh: "功能建议" },
  bug_report: { en: "Bug report", zh: "问题反馈" },
  translation_quality: { en: "Translation quality", zh: "翻译质量" },
  writing_experience: { en: "Writing experience", zh: "润色体验" },
  other: { en: "Other", zh: "其他意见" },
};

export const FEEDBACK_STATUS_LABELS: Record<
  FeedbackStatus,
  { en: string; zh: string }
> = {
  new: { en: "New", zh: "新反馈" },
  in_progress: { en: "In progress", zh: "处理中" },
  resolved: { en: "Resolved", zh: "已解决" },
  archived: { en: "Archived", zh: "已归档" },
};

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return FEEDBACK_CATEGORIES.includes(value as FeedbackCategory);
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return FEEDBACK_STATUSES.includes(value as FeedbackStatus);
}