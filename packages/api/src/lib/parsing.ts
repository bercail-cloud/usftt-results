/**
 * Shared helpers for parsing noisy FFTT XML values.
 *
 * The FFTT API returns everything as strings, often with empty-string sentinels,
 * and sometimes with mixed formats (e.g. "N718 - 2130" vs "1999"). These helpers
 * centralise the tolerant parsing logic that used to be duplicated across
 * sync-parties.ts, sync-joueurs.ts, sync-rencontres.ts and sync-criterium.ts.
 */

/** Parse an integer, returning 0 for empty/invalid input. Floors non-integer values. */
export function toIntOrZero(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : Math.floor(n);
}

/** Parse an integer, returning null for empty/invalid input. */
export function toIntOrNull(value: string | undefined | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Parse an integer, returning 0 for empty/invalid input. */
export function toIntOrDefault(value: string | undefined | null, fallback = 0): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

/** Parse a float, returning null for empty/invalid input. */
export function toFloatOrNull(value: string | undefined | null): number | null {
  if (!value) return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

/** Parse a float, returning 0 for empty/invalid input. */
export function toFloatOrZero(value: string | undefined | null): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Extract a classement (ELO-like score) from the "clt" field of the FFTT criterium API.
 * Accepts plain scores ("1999") and prefixed scores ("N718 - 2130" → 2130).
 */
export function parseClassementFromClt(clt: string): number {
  if (!clt) return 0;
  const parts = clt.split(" - ");
  const numStr = parts.length > 1 ? parts[parts.length - 1] : clt;
  return toIntOrDefault(numStr);
}

/**
 * Parse SPID classement field, which may be "N718 - 2130" (rank - points) or "1999".
 * Returns the numeric points and the rank string when present.
 */
export function parseSpidClassement(raw: string): { points: number; rang: string | null } {
  if (!raw) return { points: 0, rang: null };
  const dashIdx = raw.lastIndexOf(" - ");
  if (dashIdx >= 0) {
    const rangPart = raw.slice(0, dashIdx).trim();
    return {
      points: toIntOrDefault(raw.slice(dashIdx + 3)),
      rang: rangPart || null,
    };
  }
  return { points: toIntOrDefault(raw), rang: null };
}
