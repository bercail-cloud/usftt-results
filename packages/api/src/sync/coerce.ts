/**
 * Shared coercion helpers for FFTT XML-derived values.
 * FFTT responses are strings with empty "" for missing numeric fields;
 * these helpers return a sensible default when the value is absent or NaN.
 */

export function safeInt(val: string | undefined | null): number {
  if (!val) return 0;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? 0 : n;
}

export function safeFloat(val: string | undefined | null): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return Number.isNaN(n) ? 0 : n;
}

export function safeIntOrNull(val: string | undefined | null): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

export function safeFloatOrNull(val: string | undefined | null): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

export function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
