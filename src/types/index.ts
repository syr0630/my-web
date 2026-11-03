export type UiLocale = "zh-CN" | "en";
export type ContentLanguage = "auto" | "zh-CN" | "en" | "mixed";
export type ResolvedLanguage = "zh-CN" | "en" | "mixed";

export type PolishStandard =
  | "standard"
  | "fluent"
  | "humanize"
  | "formal"
  | "academic"
  | "simple"
  | "creative"
  | "expand"
  | "shorten";

export type Intensity = "light" | "moderate" | "strong";

export type ApiErrorBody = {
  request_id: string;
  error_code: string;
  message: string;
  retryable: boolean;
};

export type DiffSegment = {
  type: "equal" | "insert" | "delete";
  text: string;
};

/**
 * A sentence-level pair between the original draft and the current result.
 *
 * `originalStart/originalEnd` and `currentStart/currentEnd` are offsets into the
 * two full texts, so a local restore can replace exactly one span instead of
 * rebuilding the whole document from joined sentences.
 */
export type SentencePair = {
  id: string;
  original: string;
  current: string;
  changed: boolean;
  originalStart: number;
  originalEnd: number;
  currentStart: number;
  currentEnd: number;
  alternatives?: string[];
  explanation?: string;
};

export type EditorSnapshot = {
  originalText: string;
  generatedText: string;
  currentText: string;
  sourceVersion: string;
};

export type PolishRequest = {
  text: string;
  standard: PolishStandard;
  intensity: Intensity;
  contentLanguage: ContentLanguage;
  scene?: string;
  styleProfileId?: string;
  sourceVersion: string;
};

export type HumanizeRequest = {
  text: string;
  intensity: Intensity;
  contentLanguage: ContentLanguage;
  sourceVersion: string;
};

export type AlternativesRequest = {
  originalSentence: string;
  currentSentence: string;
  contentLanguage: ContentLanguage;
  context?: string;
};

export type ExplainChangeRequest = {
  originalSentence: string;
  revisedSentence: string;
  contentLanguage: ContentLanguage;
};

export type AiTransformResponse = {
  request_id: string;
  text: string;
  detectedLanguage: ResolvedLanguage;
  sourceVersion: string;
  model: string;
  styleProfile?: { id: string; name: string };
};

export type AiTextResponse = {
  request_id: string;
  alternatives?: string[];
  explanation?: string;
  detectedLanguage: ResolvedLanguage;
  model: string;
};

export type AcademicMode = "polish" | "review" | "abstract";

export type AcademicResponse = {
  request_id: string;
  text: string;
  mode: AcademicMode;
  model: string;
  inputChars: number;
};

export type DocumentExtractResponse = {
  request_id: string;
  text: string;
  filename: string;
  chars: number;
};

/* ------------------------------------------------------------------------- */
/* Grammar / detector / translation / interactive word suggestions           */
/* ------------------------------------------------------------------------- */

export type GrammarIssueType =
  | "grammar"
  | "spelling"
  | "punctuation"
  | "word_choice"
  | "style";

export type GrammarSeverity = "error" | "warning" | "suggestion";

export type GrammarIssue = {
  id: string;
  type: GrammarIssueType;
  severity: GrammarSeverity;
  start: number;
  end: number;
  original: string;
  replacement: string;
  message: string;
};

export type GrammarResponse = {
  request_id: string;
  issues: GrammarIssue[];
  correctedText: string;
  detectedLanguage: ResolvedLanguage;
  sourceVersion: string;
  model: string;
};

export type DetectorConfidence = "low" | "medium" | "high";
export type DetectorBand = "human" | "uncertain" | "ai";

export type DetectorSignal = {
  type: string;
  excerpt: string;
  explanation: string;
};

export type DetectorResponse = {
  request_id: string;
  score: number;
  band: DetectorBand;
  confidence: DetectorConfidence;
  summary: string;
  signals: DetectorSignal[];
  detectedLanguage: ResolvedLanguage;
  model: string;
  disclaimer: string;
};

export type TranslationStyle = "natural" | "formal" | "academic";
export type TranslationSource = "auto" | "zh-CN" | "en";
export type TranslationTarget = "zh-CN" | "en";

export type TranslateResponse = {
  request_id: string;
  text: string;
  detectedLanguage: ResolvedLanguage;
  targetLanguage: TranslationTarget;
  style: TranslationStyle;
  sourceVersion: string;
  model: string;
};

export type WordSuggestionsResponse = {
  request_id: string;
  suggestions: string[];
  selectedText: string;
  status: "ok";
};

export type HealthResponse = {
  ok: boolean;
  aiConfigured: boolean;
  model: string | null;
};

/* ------------------------------------------------------------------------- */
/* Style Profile / Style Consistency                                          */
/* ------------------------------------------------------------------------- */

export type StyleRating = "high" | "medium" | "low";

export type StyleDimensionKey =
  | "tone"
  | "wording"
  | "sentence"
  | "expression"
  | "paragraph"
  | "rhetoric";

export type StyleDimension = {
  description: string;
};

export type StyleAnalysis = {
  summary: string;
  dimensions: Record<StyleDimensionKey, StyleDimension>;
  recommendedInstructions: string[];
  avoid: string[];
  confidence: StyleRating;
  sampleAssessment: string;
  limitations: string;
};

export type StyleSampleSource = "paste" | "txt" | "docx" | "pdf";

export type StyleSample = {
  id: string;
  name: string;
  text: string;
  chars: number;
  sourceType: StyleSampleSource;
};

export type StyleAnalysisResponse = {
  request_id: string;
  analysis: StyleAnalysis;
  model: string;
};

export type StyleProfileSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sampleCount: number;
  sampleChars: number;
  confidence: StyleRating;
  summary: string;
};

export type StyleProfile = StyleProfileSummary & {
  analysis: StyleAnalysis;
  samples: StyleSample[];
};

export type StyleProfileListResponse = {
  profiles: StyleProfileSummary[];
};

export type StyleProfileResponse = {
  profile: StyleProfile;
};

export type StyleConsistencyDimensionKey =
  | "tone"
  | "wording"
  | "sentence"
  | "expression"
  | "rhetoric";

export type StyleConsistencyDimension = {
  key: StyleConsistencyDimensionKey;
  rating: StyleRating;
  explanation: string;
};

export type StyleDifference = {
  id: string;
  type: StyleConsistencyDimensionKey;
  start: number;
  end: number;
  quote: string;
  reason: string;
  suggestion: string;
};

export type StyleConsistencyResponse = {
  request_id: string;
  overall: StyleRating;
  summary: string;
  dimensions: StyleConsistencyDimension[];
  differences: StyleDifference[];
  limitations: string;
  model: string;
};

export type StyleApplyResponse = {
  request_id: string;
  text: string;
  sourceVersion: string;
  appliedChanges: string[];
  model: string;
};