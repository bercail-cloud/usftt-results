import { describe, it, expect } from "vitest";
import { tryParseInt } from "../../lib/http.js";

describe("tryParseInt", () => {
  it("returns null for missing input", () => {
    expect(tryParseInt(undefined)).toBeNull();
    expect(tryParseInt(null)).toBeNull();
    expect(tryParseInt("")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(tryParseInt("abc")).toBeNull();
    expect(tryParseInt("12abc")).toBe(12); // parseInt permits trailing garbage
    expect(tryParseInt("abc12")).toBeNull();
  });

  it("parses positive and negative integers", () => {
    expect(tryParseInt("42")).toBe(42);
    expect(tryParseInt("-7")).toBe(-7);
    expect(tryParseInt("0")).toBe(0);
  });
});
