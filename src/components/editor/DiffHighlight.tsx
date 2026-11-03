"use client";

import { useMemo } from "react";
import { computeDiff, type DiffRange } from "@/lib/diff/text-diff";

type Props = {
  original: string;
  current: string;
  showDeletes?: boolean;
  altRanges?: DiffRange[];
};

type Piece = { text: string; marked: boolean };

function splitByRanges(
  text: string,
  start: number,
  ranges: DiffRange[]
): Piece[] {
  if (!text) return [];
  if (!ranges.length) return [{ text, marked: false }];

  const cuts = new Set<number>([0, text.length]);
  for (const range of ranges) {
    if (range.start > start && range.start < start + text.length) {
      cuts.add(range.start - start);
    }
    if (range.end > start && range.end < start + text.length) {
      cuts.add(range.end - start);
    }
  }

  const points = [...cuts].sort((a, b) => a - b);
  const pieces: Piece[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    if (to <= from) continue;
    const absolute = start + from;
    const marked = ranges.some(
      (range) => absolute >= range.start && absolute < range.end
    );
    pieces.push({ text: text.slice(from, to), marked });
  }

  return pieces;
}

/**
 * Renders a real diff of the two strings. Output is always React text nodes —
 * AI responses are never interpreted as HTML.
 */
export function DiffHighlight({
  original,
  current,
  showDeletes = false,
  altRanges = [],
}: Props) {
  const segments = useMemo(
    () => computeDiff(original, current),
    [original, current]
  );

  let position = 0;

  return (
    <span>
      {segments.map((segment, index) => {
        if (segment.type === "delete") {
          if (!showDeletes) return null;
          return (
            <span key={`d-${index}`} className="diff-delete">
              {segment.text}
            </span>
          );
        }

        const start = position;
        position += segment.text.length;
        const pieces = splitByRanges(segment.text, start, altRanges);

        if (segment.type === "equal") {
          return (
            <span key={`e-${index}`}>
              {pieces.map((piece, pieceIndex) =>
                piece.marked ? (
                  <span
                    key={pieceIndex}
                    className="alt-underline"
                  >
                    {piece.text}
                  </span>
                ) : (
                  <span key={pieceIndex}>{piece.text}</span>
                )
              )}
            </span>
          );
        }

        return (
          <mark key={`i-${index}`} className="diff-insert">
            {pieces.map((piece, pieceIndex) =>
              piece.marked ? (
                <span key={pieceIndex} className="alt-underline">
                  {piece.text}
                </span>
              ) : (
                <span key={pieceIndex}>{piece.text}</span>
              )
            )}
          </mark>
        );
      })}
    </span>
  );
}