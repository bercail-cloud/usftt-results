import { describe, it, expect } from "vitest";
import {
  toIntOrZero,
  toIntOrNull,
  toIntOrDefault,
  toFloatOrNull,
  toFloatOrZero,
  parseClassementFromClt,
  parseSpidClassement,
} from "../../lib/parsing.js";

describe("toIntOrZero", () => {
  it("returns 0 for empty, null, undefined", () => {
    expect(toIntOrZero("")).toBe(0);
    expect(toIntOrZero(null)).toBe(0);
    expect(toIntOrZero(undefined)).toBe(0);
  });

  it("parses integer strings", () => {
    expect(toIntOrZero("42")).toBe(42);
    expect(toIntOrZero("-7")).toBe(-7);
  });

  it("floors decimal values", () => {
    expect(toIntOrZero("3.9")).toBe(3);
    expect(toIntOrZero(3.9)).toBe(3);
  });

  it("returns 0 for non-numeric input", () => {
    expect(toIntOrZero("abc")).toBe(0);
    expect(toIntOrZero({})).toBe(0);
  });
});

describe("toIntOrNull", () => {
  it("returns null for empty/invalid input", () => {
    expect(toIntOrNull("")).toBeNull();
    expect(toIntOrNull(undefined)).toBeNull();
    expect(toIntOrNull("abc")).toBeNull();
  });

  it("parses integer strings", () => {
    expect(toIntOrNull("42")).toBe(42);
  });
});

describe("toIntOrDefault", () => {
  it("returns 0 by default for empty/invalid input", () => {
    expect(toIntOrDefault("")).toBe(0);
    expect(toIntOrDefault(undefined)).toBe(0);
    expect(toIntOrDefault("abc")).toBe(0);
  });

  it("honours the provided fallback", () => {
    expect(toIntOrDefault("", -1)).toBe(-1);
    expect(toIntOrDefault("xyz", 99)).toBe(99);
  });

  it("parses valid integers", () => {
    expect(toIntOrDefault("7")).toBe(7);
  });
});

describe("toFloatOrNull", () => {
  it("returns null for empty/invalid input", () => {
    expect(toFloatOrNull("")).toBeNull();
    expect(toFloatOrNull("abc")).toBeNull();
  });

  it("parses floats", () => {
    expect(toFloatOrNull("3.5")).toBe(3.5);
  });
});

describe("toFloatOrZero", () => {
  it("returns 0 for empty/invalid input", () => {
    expect(toFloatOrZero("")).toBe(0);
    expect(toFloatOrZero("abc")).toBe(0);
  });

  it("parses floats", () => {
    expect(toFloatOrZero("3.5")).toBe(3.5);
    expect(toFloatOrZero("-0.75")).toBe(-0.75);
  });
});

describe("parseClassementFromClt", () => {
  it("returns 0 for empty input", () => {
    expect(parseClassementFromClt("")).toBe(0);
  });

  it("parses plain numeric strings", () => {
    expect(parseClassementFromClt("1999")).toBe(1999);
  });

  it("extracts the last segment of 'rank - points' strings", () => {
    expect(parseClassementFromClt("N718 - 2130")).toBe(2130);
  });

  it("returns 0 when the last segment is non-numeric", () => {
    expect(parseClassementFromClt("N1 - xyz")).toBe(0);
  });
});

describe("parseSpidClassement", () => {
  it("returns zero points and null rang for empty input", () => {
    expect(parseSpidClassement("")).toEqual({ points: 0, rang: null });
  });

  it("splits 'rank - points' strings", () => {
    expect(parseSpidClassement("N718 - 2130")).toEqual({
      points: 2130,
      rang: "N718",
    });
  });

  it("parses plain points", () => {
    expect(parseSpidClassement("1500")).toEqual({ points: 1500, rang: null });
  });

  it("handles non-numeric gracefully", () => {
    expect(parseSpidClassement("abc")).toEqual({ points: 0, rang: null });
    expect(parseSpidClassement("N1 - xyz")).toEqual({ points: 0, rang: "N1" });
  });
});
