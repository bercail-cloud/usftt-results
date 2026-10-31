import { describe, it, expect } from "vitest";
import { computeTopPercent } from "../../lib/top-percent.js";

const p = (licence: string, points: number | null, nb_matchs: number | null) => ({
  licence,
  points_mensuels: points,
  nb_matchs,
});

describe("computeTopPercent", () => {
  it("ranks only players with at least one match", () => {
    const result = computeTopPercent([p("a", 1500, 3), p("b", 1200, 1), p("c", 1800, 0), p("d", 900, 5), p("e", 1000, 2)]);
    expect(result.get("a")).toBe(25);
    expect(result.get("e")).toBe(75);
    expect(result.get("b")).toBe(50);
    expect(result.get("d")).toBe(100);
    expect(result.has("c")).toBe(false);
  });

  it("gives tied players the same rank", () => {
    const result = computeTopPercent([p("a", 1000, 1), p("b", 1000, 1), p("c", 900, 1), p("d", 800, 1)]);
    expect(result.get("a")).toBe(25);
    expect(result.get("b")).toBe(25);
    expect(result.get("c")).toBe(75);
  });

  it("ignores players without points and returns an empty map when nobody played", () => {
    expect(computeTopPercent([p("a", null, 2), p("b", 1000, 0)]).size).toBe(0);
  });
});
