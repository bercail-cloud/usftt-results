import { describe, it, expect } from "vitest";
import {
  toIntOrZero,
  toIntOrNull,
  toFloatOrZero,
  toFloatOrNull,
} from "../../lib/parse.js";

describe("toIntOrZero", () => {
  it("returns 0 for null/undefined/empty", () => {
    expect(toIntOrZero(null)).toBe(0);
    expect(toIntOrZero(undefined)).toBe(0);
    expect(toIntOrZero("")).toBe(0);
  });

  it("floors fractional numbers", () => {
    expect(toIntOrZero("3.7")).toBe(3);
    expect(toIntOrZero(4.9)).toBe(4);
  });

  it("returns 0 for NaN-producing inputs", () => {
    expect(toIntOrZero("not a number")).toBe(0);
    expect(toIntOrZero("abc123")).toBe(0);
  });

  it("parses valid integer strings and numbers", () => {
    expect(toIntOrZero("42")).toBe(42);
    expect(toIntOrZero(42)).toBe(42);
    expect(toIntOrZero("-7")).toBe(-7);
  });
});

describe("toIntOrNull", () => {
  it("returns null for null/undefined/empty", () => {
    expect(toIntOrNull(null)).toBeNull();
    expect(toIntOrNull(undefined)).toBeNull();
    expect(toIntOrNull("")).toBeNull();
  });

  it("returns null for NaN-producing inputs", () => {
    expect(toIntOrNull("nope")).toBeNull();
  });

  it("floors fractional numbers", () => {
    expect(toIntOrNull("3.7")).toBe(3);
  });

  it("parses valid integers", () => {
    expect(toIntOrNull("100")).toBe(100);
    expect(toIntOrNull(-5)).toBe(-5);
  });
});

describe("toFloatOrZero", () => {
  it("returns 0 for null/undefined/empty", () => {
    expect(toFloatOrZero(null)).toBe(0);
    expect(toFloatOrZero(undefined)).toBe(0);
    expect(toFloatOrZero("")).toBe(0);
  });

  it("preserves fractional precision", () => {
    expect(toFloatOrZero("3.5")).toBe(3.5);
    expect(toFloatOrZero(1.25)).toBe(1.25);
  });

  it("returns 0 for NaN-producing inputs", () => {
    expect(toFloatOrZero("abc")).toBe(0);
  });
});

describe("toFloatOrNull", () => {
  it("returns null for null/undefined/empty", () => {
    expect(toFloatOrNull(null)).toBeNull();
    expect(toFloatOrNull(undefined)).toBeNull();
    expect(toFloatOrNull("")).toBeNull();
  });

  it("returns null for NaN-producing inputs", () => {
    expect(toFloatOrNull("nope")).toBeNull();
  });

  it("preserves fractional precision", () => {
    expect(toFloatOrNull("3.5")).toBe(3.5);
  });
});
