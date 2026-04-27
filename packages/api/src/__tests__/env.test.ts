import { describe, it, expect } from "vitest";
import { envSchema } from "../env-schema.js";

const baseProd = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u:p@h:5432/d",
  ALLOWED_ORIGINS: "https://example.com",
  SYNC_TRIGGER_TOKEN: "secret",
};

describe("envSchema (production refinements)", () => {
  it("accepts a fully configured production environment", () => {
    const parsed = envSchema.safeParse(baseProd);
    expect(parsed.success).toBe(true);
  });

  it("rejects production when ALLOWED_ORIGINS is unset", () => {
    const { ALLOWED_ORIGINS: _omit, ...env } = baseProd;
    void _omit;
    const parsed = envSchema.safeParse(env);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === "ALLOWED_ORIGINS")).toBe(true);
    }
  });

  it("rejects production when SYNC_TRIGGER_TOKEN is unset", () => {
    const { SYNC_TRIGGER_TOKEN: _omit, ...env } = baseProd;
    void _omit;
    const parsed = envSchema.safeParse(env);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === "SYNC_TRIGGER_TOKEN")).toBe(
        true
      );
    }
  });

  it("does not require ALLOWED_ORIGINS or SYNC_TRIGGER_TOKEN outside production", () => {
    const parsed = envSchema.safeParse({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://u:p@h:5432/d",
    });
    expect(parsed.success).toBe(true);
  });

  it("defaults NODE_ENV to development", () => {
    const parsed = envSchema.safeParse({ DATABASE_URL: "postgresql://u:p@h:5432/d" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.NODE_ENV).toBe("development");
  });

  it("rejects malformed FFTT_SERIE (must be exactly 15 chars when set)", () => {
    const parsed = envSchema.safeParse({
      ...baseProd,
      FFTT_SERIE: "tooshort",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an invalid DATABASE_URL", () => {
    const parsed = envSchema.safeParse({ ...baseProd, DATABASE_URL: "not a url" });
    expect(parsed.success).toBe(false);
  });
});
