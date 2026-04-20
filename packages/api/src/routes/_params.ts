import type { Context } from "hono";

export function parseIntParam(c: Context, name: string): number | null {
  const raw = c.req.param(name);
  if (raw === undefined) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}
