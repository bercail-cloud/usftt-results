import type { Context } from "hono";

export type IntParamResult =
  | { ok: true; value: number }
  | { ok: false; response: Response };

export function parseIntParam(c: Context, name: string): IntParamResult {
  const raw = c.req.param(name);
  if (raw === undefined) {
    return { ok: false, response: c.json({ error: `Missing ${name}` }, 400) };
  }
  if (!/^-?\d+$/.test(raw)) {
    return {
      ok: false,
      response: c.json({ error: `Invalid ${name}: must be an integer` }, 400),
    };
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value)) {
    return {
      ok: false,
      response: c.json({ error: `Invalid ${name}: out of range` }, 400),
    };
  }
  return { ok: true, value };
}

export function parseIntQuery(c: Context, name: string): IntParamResult | null {
  const raw = c.req.query(name);
  if (raw === undefined) return null;
  if (!/^-?\d+$/.test(raw)) {
    return {
      ok: false,
      response: c.json({ error: `Invalid ${name}: must be an integer` }, 400),
    };
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value)) {
    return {
      ok: false,
      response: c.json({ error: `Invalid ${name}: out of range` }, 400),
    };
  }
  return { ok: true, value };
}
