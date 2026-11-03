/**
 * One visible-character rule shared by the browser and the API.
 *
 * - Normalize to NFC so composed / decomposed forms count the same.
 * - Count Unicode code points (Array.from), so an emoji counts as one.
 * - Ignore CR only; spaces, newlines, punctuation and ZWJ sequences all count.
 * - Never use string.length (UTF-16 units) for validation.
 */
export function countVisibleChars(text: string): number {
  const normalized = text.normalize("NFC").replace(/\r/g, "");
  return Array.from(normalized).length;
}

export function truncateToVisibleChars(text: string, max: number): string {
  const normalized = text.normalize("NFC").replace(/\r/g, "");
  const chars = Array.from(normalized);
  if (chars.length <= max) return normalized;
  return chars.slice(0, max).join("");
}

export function isOverVisibleLimit(text: string, max: number): boolean {
  return countVisibleChars(text) > max;
}