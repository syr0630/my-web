import type {
  StyleConsistencyDimensionKey,
  StyleDimensionKey,
  StyleRating,
  StyleSampleSource,
} from "@/types";

export const STYLE_LIMITS = {
  maxSamples: 8,
  maxSampleChars: 12_000,
  maxTotalChars: 40_000,
  maxProfiles: 20,
} as const;

export const STYLE_DIMENSIONS: {
  key: StyleDimensionKey;
  zh: string;
  en: string;
}[] = [
  { key: "tone", zh: "语气特征", en: "Tone" },
  { key: "wording", zh: "用词习惯", en: "Wording" },
  { key: "sentence", zh: "句式特征", en: "Sentence structure" },
  { key: "expression", zh: "表达方式", en: "Expression" },
  { key: "paragraph", zh: "段落结构", en: "Paragraph structure" },
  { key: "rhetoric", zh: "修辞特征", en: "Rhetoric" },
];

export const CONSISTENCY_DIMENSIONS: {
  key: StyleConsistencyDimensionKey;
  zh: string;
  en: string;
}[] = [
  { key: "tone", zh: "语气一致性", en: "Tone consistency" },
  { key: "wording", zh: "用词一致性", en: "Wording consistency" },
  { key: "sentence", zh: "句式一致性", en: "Sentence consistency" },
  { key: "expression", zh: "表达方式一致性", en: "Expression consistency" },
  { key: "rhetoric", zh: "修辞与节奏一致性", en: "Rhetoric and rhythm" },
];

export const RATING_LABELS: Record<StyleRating, { zh: string; en: string }> = {
  high: { zh: "较高", en: "High" },
  medium: { zh: "一般", en: "Medium" },
  low: { zh: "有待调整", en: "Needs work" },
};

export const SOURCE_LABELS: Record<StyleSampleSource, string> = {
  paste: "粘贴",
  txt: "TXT",
  docx: "DOCX",
  pdf: "PDF",
};

export const STYLE_COPY = {
  "zh-CN": {
    eyebrow: "Style Profile",
    title: "写作风格画像",
    subtitle:
      "导入你喜欢的文本，分析它的语气、用词、句式和节奏，保存成可复用的风格画像。",
    badge: "真实 AI 分析",
    importTitle: "1. 导入参考文本",
    importHint:
      "支持直接粘贴，或上传 TXT、DOCX、PDF。可导入多份，但请尽量保持同一文体。",
    pasteLabel: "粘贴一段文字",
    pastePlaceholder:
      "粘贴你希望参考的文本，例如自己的旧文章、喜欢的作者段落或正式邮件。",
    addPaste: "添加这段文本",
    upload: "上传文件",
    uploading: "正在提取文字…",
    fileHint: "TXT / DOCX / PDF，单份不超过 12,000 字，最多 8 份。",
    sampleList: "已导入样本",
    noSamples: "还没有样本。先粘贴一段，或上传一个文件。",
    removeSample: "删除样本",
    chars: "字",
    total: "样本合计",
    sampleEnough: "样本量较充足，适合生成初版画像。",
    sampleLimited:
      "样本偏少，AI 只能给出有限判断；建议再添加 1–2 份同文体文本。",
    sampleTooShort:
      "样本太短，暂时不足以形成稳定画像。至少添加约 200 字。",
    sampleMixed:
      "当前样本来自不同文体。AI 会指出差异，但不会未经确认把它们合并。",
    analyze: "分析写作风格",
    reanalyze: "重新分析风格",
    analyzing: "AI 正在分析样本，通常需要 10–30 秒…",
    analysisTitle: "2. 检查并编辑画像",
    analysisEmpty: "完成分析后，画像会显示在这里，你可以逐项修改。",
    summary: "风格概述",
    recommended: "推荐写作指令",
    recommendedHint: "每行一条，最多 8 条。",
    avoid: "不建议使用的表达",
    avoidHint: "每行一条，用于描述风格禁区，不是内容审查。",
    sampleAssessment: "样本充分性评估",
    limitations: "分析局限",
    confidence: "分析可信程度",
    name: "画像名称",
    namePlaceholder: "例如：我的学术写作风格",
    save: "保存风格画像",
    update: "更新画像",
    saving: "正在保存…",
    retry: "重试",
    loadingProfiles: "正在读取画像…",
    newProfile: "新建画像",
    savedTitle: "已保存的风格画像",
    savedEmpty: "还没有保存的画像。分析并命名后即可保存。",
    open: "打开",
    rename: "重命名",
    renameSave: "保存名称",
    cancel: "取消",
    delete: "删除",
    deleteConfirm: "确认删除",
    deleting: "删除中…",
    useInPolisher: "在文本润色中使用",
    updated: "更新于",
    samples: "份样本",
    noAnalysis: "请先在左侧完成风格分析。",
    saved: "风格画像已保存。",
    updatedNotice: "风格画像已更新。",
    deletedNotice: "风格画像已删除。",
    analysisReady:
      "分析完成。请检查并编辑结果，确认后保存为画像。",
    failed: "操作失败，请重试。",
    loadFailed: "无法读取已保存的画像。",
    privacy:
      "样本和画像默认保存在本地 SQLite，仅当前浏览器身份可访问；删除画像会同时删除其样本。",
    limitation:
      "这是对语言表面特征的估计，不是对作者身份、写作水平或事实正确性的判断。",
    tipsTitle: "让分析更可靠",
    tip1: "尽量选择同一文体的 2–3 份样本。",
    tip2: "样本合计 600 字以上时，画像更稳定。",
    tip3: "画像描述表达习惯，不代表写作水平。",
    source: "来源",
    untitledSample: "粘贴样本",
    fileErrors: "部分文件未能导入",
    maxSamples: "最多 8 份样本。",
    maxChars: "样本合计超过 40,000 字，请删除或缩短部分样本。",
    pasteEmpty: "请先粘贴文本。",
    nameRequired: "保存前请填写画像名称。",
    review: "逐项查看差异",
    hideReview: "收起差异",
  },
  en: {
    eyebrow: "Style Profile",
    title: "Writing style profiles",
    subtitle:
      "Import writing you want to reference, analyze its tone, wording, sentences and rhythm, then save it as a reusable profile.",
    badge: "Real AI analysis",
    importTitle: "1. Import reference text",
    importHint:
      "Paste text directly or upload TXT, DOCX or PDF. Multiple samples are allowed, but keep them in the same genre when possible.",
    pasteLabel: "Paste some text",
    pastePlaceholder:
      "Paste writing you want to reference — an old article, a writer you like, or a formal email.",
    addPaste: "Add this text",
    upload: "Upload files",
    uploading: "Extracting text…",
    fileHint: "TXT / DOCX / PDF, up to 12,000 characters each, 8 samples max.",
    sampleList: "Imported samples",
    noSamples: "No samples yet. Paste a passage or upload a file.",
    removeSample: "Remove sample",
    chars: "chars",
    total: "Total",
    sampleEnough: "There is enough text for a useful first profile.",
    sampleLimited:
      "The samples are short, so the analysis will be limited. Add one or two more texts in the same genre.",
    sampleTooShort:
      "The samples are too short to form a stable profile. Add at least about 200 characters.",
    sampleMixed:
      "The samples may come from different genres. The AI will note the differences rather than merging them without confirmation.",
    analyze: "Analyze style",
    reanalyze: "Analyze again",
    analyzing: "The AI is analyzing your samples. This usually takes 10–30 seconds…",
    analysisTitle: "2. Review and edit the profile",
    analysisEmpty:
      "The profile will appear here after analysis. Every field is editable.",
    summary: "Style summary",
    recommended: "Recommended instructions",
    recommendedHint: "One per line, up to 8.",
    avoid: "Expressions to avoid",
    avoidHint: "One per line. These are style boundaries, not content review.",
    sampleAssessment: "Sample sufficiency",
    limitations: "Limitations",
    confidence: "Confidence",
    name: "Profile name",
    namePlaceholder: "e.g. My academic writing",
    save: "Save profile",
    update: "Update profile",
    saving: "Saving…",
    retry: "Retry",
    loadingProfiles: "Loading profiles…",
    newProfile: "New profile",
    savedTitle: "Saved style profiles",
    savedEmpty: "No saved profiles yet. Analyze and name one to save it.",
    open: "Open",
    rename: "Rename",
    renameSave: "Save name",
    cancel: "Cancel",
    delete: "Delete",
    deleteConfirm: "Confirm delete",
    deleting: "Deleting…",
    useInPolisher: "Use in Text Polisher",
    updated: "Updated",
    samples: "samples",
    noAnalysis: "Analyze the samples on the left first.",
    saved: "Style profile saved.",
    updatedNotice: "Style profile updated.",
    deletedNotice: "Style profile deleted.",
    analysisReady:
      "Analysis ready. Review and edit it, then save it as a profile.",
    failed: "The action failed. Please retry.",
    loadFailed: "Could not load saved profiles.",
    privacy:
      "Samples and profiles are stored in local SQLite and scoped to this browser identity. Deleting a profile also deletes its samples.",
    limitation:
      "This is an estimate of surface language features, not a judgment of authorship, writing ability or factual accuracy.",
    tipsTitle: "Make the analysis more reliable",
    tip1: "Use two or three samples from the same genre.",
    tip2: "Aim for at least 600 characters in total.",
    tip3: "A profile describes habits, not writing ability.",
    source: "Source",
    untitledSample: "Pasted sample",
    fileErrors: "Some files could not be imported",
    maxSamples: "Up to 8 samples.",
    maxChars: "Samples exceed 40,000 characters. Remove or shorten some.",
    pasteEmpty: "Please paste some text first.",
    nameRequired: "Give the profile a name before saving.",
    review: "Review differences",
    hideReview: "Hide differences",
  },
} as const;

export type StyleCopy = (typeof STYLE_COPY)["zh-CN"];