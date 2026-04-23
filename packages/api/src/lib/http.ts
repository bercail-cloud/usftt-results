/**
 * Parse a numeric path or query parameter into an integer.
 * Returns `null` for missing or non-numeric input so the caller can return 400.
 */
export function tryParseInt(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}
