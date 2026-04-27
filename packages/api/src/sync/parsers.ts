/**
 * Shared numeric coercion helpers used by sync modules.
 *
 * The FFTT XML feed represents every value as a string, so we systematically
 * coerce while staying defensive against missing or malformed inputs.
 */

/** Parse to int, falling back to 0 for empty / NaN. Used for counts and ranks. */
export function safeIntOrZero(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = typeof val === "number" ? val : parseInt(String(val), 10);
  return Number.isNaN(n) ? 0 : Math.floor(n);
}

/** Parse to int, falling back to null when the value is missing or invalid. */
export function safeIntOrNull(val: string | undefined | null): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

/** Parse to float, falling back to 0 for empty / NaN. */
export function safeFloatOrZero(val: string | undefined | null): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = parseFloat(val);
  return Number.isNaN(n) ? 0 : n;
}

/** Parse to float, falling back to null when the value is missing or invalid. */
export function safeFloatOrNull(val: string | undefined | null): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}
