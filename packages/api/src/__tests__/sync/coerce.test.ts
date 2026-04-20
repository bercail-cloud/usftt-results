import { describe, it, expect } from "vitest";
import {
  safeInt,
  safeFloat,
  safeIntOrNull,
  safeFloatOrNull,
  dedupeBy,
} from "../../sync/coerce.js";

describe("safeInt", () => {
  it("returns 0 for empty/null/undefined", () => {
    expect(safeInt("")).toBe(0);
    expect(safeInt(null)).toBe(0);
    expect(safeInt(undefined)).toBe(0);
  });

  it("parses numeric strings", () => {
    expect(safeInt("42")).toBe(42);
    expect(safeInt("-7")).toBe(-7);
    expect(safeInt("3.9")).toBe(3);
  });

  it("returns 0 for non-numeric", () => {
    expect(safeInt("abc")).toBe(0);
    expect(safeInt("N/A")).toBe(0);
  });
});

describe("safeFloat", () => {
  it("returns 0 for empty/null/undefined", () => {
    expect(safeFloat("")).toBe(0);
    expect(safeFloat(null)).toBe(0);
  });

  it("parses floats", () => {
    expect(safeFloat("3.14")).toBe(3.14);
    expect(safeFloat("-0.5")).toBe(-0.5);
  });
});

describe("safeIntOrNull / safeFloatOrNull", () => {
  it("returns null for missing or invalid values", () => {
    expect(safeIntOrNull("")).toBeNull();
    expect(safeIntOrNull(undefined)).toBeNull();
    expect(safeIntOrNull("abc")).toBeNull();
    expect(safeFloatOrNull("")).toBeNull();
    expect(safeFloatOrNull("xyz")).toBeNull();
  });

  it("parses valid numbers", () => {
    expect(safeIntOrNull("1500")).toBe(1500);
    expect(safeFloatOrNull("1500.5")).toBe(1500.5);
  });
});

describe("dedupeBy", () => {
  it("keeps first occurrence of each key", () => {
    const items = [
      { id: "a", n: 1 },
      { id: "b", n: 2 },
      { id: "a", n: 3 },
    ];
    expect(dedupeBy(items, (i) => i.id)).toEqual([
      { id: "a", n: 1 },
      { id: "b", n: 2 },
    ]);
  });

  it("returns empty for empty input", () => {
    expect(dedupeBy<string>([], (s) => s)).toEqual([]);
  });

  it("preserves ordering", () => {
    const items = ["x", "y", "z", "y", "x"];
    expect(dedupeBy(items, (s) => s)).toEqual(["x", "y", "z"]);
  });
});
