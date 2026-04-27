import { describe, it, expect } from "vitest";
import {
  safeIntOrZero,
  safeIntOrNull,
  safeFloatOrZero,
  safeFloatOrNull,
} from "../../sync/parsers.js";

describe("safeIntOrZero", () => {
  it.each([
    ["", 0],
    [null, 0],
    [undefined, 0],
    ["abc", 0],
    ["12", 12],
    ["12.9", 12],
    [12.9, 12],
    ["  7  ", 7],
    ["-3", -3],
  ])("safeIntOrZero(%p) === %p", (input, expected) => {
    expect(safeIntOrZero(input)).toBe(expected);
  });
});

describe("safeIntOrNull", () => {
  it.each([
    ["", null],
    [null, null],
    [undefined, null],
    ["abc", null],
    ["12", 12],
    ["-3", -3],
  ])("safeIntOrNull(%p) === %p", (input, expected) => {
    expect(safeIntOrNull(input as string | null | undefined)).toBe(expected);
  });
});

describe("safeFloatOrZero", () => {
  it.each([
    ["", 0],
    [null, 0],
    [undefined, 0],
    ["abc", 0],
    ["1.5", 1.5],
    ["-2.25", -2.25],
  ])("safeFloatOrZero(%p) === %p", (input, expected) => {
    expect(safeFloatOrZero(input as string | null | undefined)).toBe(expected);
  });
});

describe("safeFloatOrNull", () => {
  it.each([
    ["", null],
    [null, null],
    [undefined, null],
    ["abc", null],
    ["1.5", 1.5],
  ])("safeFloatOrNull(%p) === %p", (input, expected) => {
    expect(safeFloatOrNull(input as string | null | undefined)).toBe(expected);
  });
});
