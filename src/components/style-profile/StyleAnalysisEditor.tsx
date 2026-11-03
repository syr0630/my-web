"use client";

import { Icon } from "@/components/common/Icon";
import {
  RATING_LABELS,
  STYLE_COPY,
  STYLE_DIMENSIONS,
} from "@/components/style-profile/copy";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { StyleAnalysis, StyleRating } from "@/types";

type Props = {
  name: string;
  onNameChange: (value: string) => void;
  analysis: StyleAnalysis;
  onChange: (next: StyleAnalysis) => void;
  activeProfile: boolean;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  sampleCount: number;
  totalChars: number;
};

const RATINGS: StyleRating[] = ["low", "medium", "high"];

export function StyleAnalysisEditor({
  name,
  onNameChange,
  analysis,
  onChange,
  activeProfile,
  saving,
  canSave,
  onSave,
  onAnalyze,
  analyzing,
  sampleCount,
  totalChars,
}: Props) {
  const { uiLocale } = useLocale();
  const c = STYLE_COPY[uiLocale];

  function patch(patchValue: Partial<StyleAnalysis>) {
    onChange({ ...analysis, ...patchValue });
  }

  function patchDimension(
    key: (typeof STYLE_DIMENSIONS)[number]["key"],
    value: string
  ) {
    onChange({
      ...analysis,
      dimensions: {
        ...analysis.dimensions,
        [key]: { description: value },
      },
    });
  }

  return (
    <section className="app-card p-4 sm:p-5" data-testid="style-analysis-editor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title text-base">{c.analysisTitle}</h2>
          <p className="mt-1 text-xs text-muted">
            {sampleCount} {c.samples} · {totalChars} {c.chars}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onAnalyze}
          disabled={analyzing || saving || sampleCount === 0}
        >
          <Icon name={analyzing ? "loader" : "refresh"} size={16} />
          {analyzing ? c.analyzing : c.reanalyze}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="style-name" className="field-label">
            {c.name}
          </label>
          <input
            id="style-name"
            data-testid="style-name"
            className="textarea mt-1.5 !min-h-[44px] !py-2.5"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={c.namePlaceholder}
            maxLength={60}
            disabled={saving}
          />
        </div>

        <div>
          <label htmlFor="style-summary" className="field-label">
            {c.summary}
          </label>
          <textarea
            id="style-summary"
            className="textarea textarea-auto mt-1.5"
            value={analysis.summary}
            onChange={(event) => patch({ summary: event.target.value })}
            disabled={saving}
          />
        </div>

        <div>
          <p className="field-label">{c.confidence}</p>
          <div className="segmented mt-1.5 max-w-md" role="group" aria-label={c.confidence}>
            {RATINGS.map((rating) => (
              <button
                key={rating}
                type="button"
                className="segmented-item"
                aria-pressed={analysis.confidence === rating}
                onClick={() => patch({ confidence: rating })}
                disabled={saving}
              >
                {RATING_LABELS[rating][uiLocale === "en" ? "en" : "zh"]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {STYLE_DIMENSIONS.map((dimension) => (
            <div key={dimension.key}>
              <label
                htmlFor={`style-dimension-${dimension.key}`}
                className="field-label"
              >
                {uiLocale === "en" ? dimension.en : dimension.zh}
              </label>
              <textarea
                id={`style-dimension-${dimension.key}`}
                className="textarea textarea-auto mt-1.5 text-sm"
                value={analysis.dimensions[dimension.key].description}
                onChange={(event) =>
                  patchDimension(dimension.key, event.target.value)
                }
                disabled={saving}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="style-recommended" className="field-label">
              {c.recommended}
            </label>
            <textarea
              id="style-recommended"
              className="textarea textarea-auto mt-1.5 text-sm"
              value={analysis.recommendedInstructions.join("\n")}
              onChange={(event) =>
                patch({
                  recommendedInstructions: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 8),
                })
              }
              disabled={saving}
            />
            <p className="mt-1 text-[11px] text-muted">{c.recommendedHint}</p>
          </div>
          <div>
            <label htmlFor="style-avoid" className="field-label">
              {c.avoid}
            </label>
            <textarea
              id="style-avoid"
              className="textarea textarea-auto mt-1.5 text-sm"
              value={analysis.avoid.join("\n")}
              onChange={(event) =>
                patch({
                  avoid: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 8),
                })
              }
              disabled={saving}
            />
            <p className="mt-1 text-[11px] text-muted">{c.avoidHint}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="style-sample-assessment" className="field-label">
              {c.sampleAssessment}
            </label>
            <textarea
              id="style-sample-assessment"
              className="textarea textarea-auto mt-1.5 text-sm"
              value={analysis.sampleAssessment}
              onChange={(event) =>
                patch({ sampleAssessment: event.target.value })
              }
              disabled={saving}
            />
          </div>
          <div>
            <label htmlFor="style-limitations" className="field-label">
              {c.limitations}
            </label>
            <textarea
              id="style-limitations"
              className="textarea textarea-auto mt-1.5 text-sm"
              value={analysis.limitations}
              onChange={(event) =>
                patch({ limitations: event.target.value })
              }
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="max-w-xl text-[11px] leading-relaxed text-muted">
            {c.limitation}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving || analyzing || !canSave}
            data-testid="style-save"
          >
            <Icon name={saving ? "loader" : "check"} size={16} />
            {saving ? c.saving : activeProfile ? c.update : c.save}
          </button>
        </div>
      </div>
    </section>
  );
}