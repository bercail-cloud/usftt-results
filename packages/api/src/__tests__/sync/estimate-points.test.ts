import { describe, it, expect } from "vitest";
import { estimatePoints, parseSpidClassement } from "../../sync/sync-parties.js";

describe("estimatePoints", () => {
  it("returns 0 for forfaits regardless of other inputs", () => {
    expect(estimatePoints(1500, 1500, true, 1.0, true)).toBe(0);
    expect(estimatePoints(1500, 1000, false, 2.0, true)).toBe(0);
  });

  describe("normal results (expected outcome)", () => {
    it("awards +6 for a win with ecart 0-24 (stronger player)", () => {
      expect(estimatePoints(1500, 1490, true, 1.0)).toBe(6);
    });

    it("awards -5 for a loss with ecart 0-24 (weaker player, normal)", () => {
      expect(estimatePoints(1490, 1500, false, 1.0)).toBe(-5);
    });

    it("awards +5 for a win with ecart 50-99 (stronger player)", () => {
      expect(estimatePoints(1600, 1525, true, 1.0)).toBe(5);
    });

    it("awards +0.5 for a win with ecart 400-499 (stronger player)", () => {
      expect(estimatePoints(1900, 1450, true, 1.0)).toBe(0.5);
    });

    it("awards 0 for a win with ecart 500+ (stronger player)", () => {
      expect(estimatePoints(2000, 1400, true, 1.0)).toBe(0);
    });
  });

  describe("upset results (unexpected outcome)", () => {
    it("awards +40 for a win with ecart 500+ (massive upset)", () => {
      expect(estimatePoints(1400, 2000, true, 1.0)).toBe(40);
    });

    it("awards -29 for a loss with ecart 500+ (heavy favourite loses)", () => {
      expect(estimatePoints(2000, 1400, false, 1.0)).toBe(-29);
    });

    it("awards +10 for a win with ecart 100-149 (upset)", () => {
      expect(estimatePoints(1500, 1620, true, 1.0)).toBe(10);
    });

    it("awards -12.5 for a loss with ecart 200-299 (upset on favourite)", () => {
      expect(estimatePoints(1800, 1550, false, 1.0)).toBe(-12.5);
    });
  });

  describe("coefficient scaling", () => {
    it("multiplies base points by coefficient", () => {
      expect(estimatePoints(1500, 1490, true, 2.0)).toBe(12);
      expect(estimatePoints(1500, 1490, true, 0.5)).toBe(3);
    });

    it("rounds to 1 decimal place", () => {
      // +5.5 * 0.33 = 1.815 -> rounds to 1.8
      expect(estimatePoints(1500, 1470, true, 0.33)).toBe(1.8);
    });
  });

  describe("classement below 50 (rank code, multiplied by 100)", () => {
    it("treats values <50 as ranks and multiplies by 100 before ecart", () => {
      // player 15 -> 1500, adversary 14 -> 1400, ecart 100, player stronger, +4
      expect(estimatePoints(15, 14, true, 1.0)).toBe(4);
    });

    it("mixes low (rank) and high (points) values correctly", () => {
      // player 15 -> 1500, adversary 1490, ecart 10, player stronger, +6
      expect(estimatePoints(15, 1490, true, 1.0)).toBe(6);
    });
  });

  it("handles boundary ecarts correctly", () => {
    // ecart exactly 24 -> first row
    expect(estimatePoints(1524, 1500, true, 1.0)).toBe(6);
    // ecart exactly 25 -> second row
    expect(estimatePoints(1525, 1500, true, 1.0)).toBe(5.5);
    // ecart exactly 49 -> second row
    expect(estimatePoints(1549, 1500, true, 1.0)).toBe(5.5);
    // ecart exactly 50 -> third row
    expect(estimatePoints(1550, 1500, true, 1.0)).toBe(5);
  });

  it("treats equal classements as the player being stronger (>=)", () => {
    // ecart 0, both same -> normal win +6, normal loss -5
    expect(estimatePoints(1500, 1500, true, 1.0)).toBe(6);
    expect(estimatePoints(1500, 1500, false, 1.0)).toBe(-5);
  });
});

describe("parseSpidClassement", () => {
  it("returns 0 points and null rang for empty input", () => {
    expect(parseSpidClassement("")).toEqual({ points: 0, rang: null });
  });

  it('parses "N718 - 2130" into rang + points', () => {
    expect(parseSpidClassement("N718 - 2130")).toEqual({
      points: 2130,
      rang: "N718",
    });
  });

  it('parses plain number "1999" into points only', () => {
    expect(parseSpidClassement("1999")).toEqual({ points: 1999, rang: null });
  });

  it("returns points=0 for unparseable number without dash", () => {
    expect(parseSpidClassement("abc")).toEqual({ points: 0, rang: null });
  });

  it("returns points=0 for unparseable number after dash, but keeps rang", () => {
    expect(parseSpidClassement("N1 - xyz")).toEqual({ points: 0, rang: "N1" });
  });

  it("uses the last ' - ' occurrence when multiple are present", () => {
    // Defensive: FFTT field is structured, but parser uses lastIndexOf
    expect(parseSpidClassement("Foo - Bar - 1500")).toEqual({
      points: 1500,
      rang: "Foo - Bar",
    });
  });

  it("returns rang=null when the part before dash is empty/whitespace", () => {
    expect(parseSpidClassement(" - 1500")).toEqual({ points: 1500, rang: null });
  });
});
