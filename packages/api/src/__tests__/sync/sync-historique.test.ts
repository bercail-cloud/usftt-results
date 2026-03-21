import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../fftt/endpoints.js", () => ({
  getHistoClassement: vi.fn(),
}));

import { getHistoClassement } from "../../fftt/endpoints.js";
import { syncHistorique } from "../../sync/sync-historique.js";
import type { SyncDb } from "../../sync/sync-equipes.js";

const mockGetHistoClassement = vi.mocked(getHistoClassement);

const FFTT_CONFIG = {
  appId: "A001",
  serie: "ABC123",
  password: "FFTT",
  clubNumero: "99999",
};

function makeApiHisto(overrides: Record<string, string> = {}) {
  return {
    echelon: "R",
    place: "5",
    point: "1500",
    saison: "2024",
    phase: "1",
    ...overrides,
  };
}

describe("syncHistorique", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when no joueurs in DB", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([]),
      }),
    };

    const count = await syncHistorique(db as SyncDb, FFTT_CONFIG);
    expect(count).toBe(0);
    expect(mockGetHistoClassement).not.toHaveBeenCalled();
  });

  it("calls getHistoClassement for each joueur", async () => {
    const licences = ["11111111", "22222222"];
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue(licences.map((l) => ({ licence: l }))),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    mockGetHistoClassement.mockResolvedValue([]);

    await syncHistorique(db as SyncDb, FFTT_CONFIG);

    expect(mockGetHistoClassement).toHaveBeenCalledTimes(2);
    expect(mockGetHistoClassement).toHaveBeenCalledWith(
      "11111111",
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
    expect(mockGetHistoClassement).toHaveBeenCalledWith(
      "22222222",
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("maps API fields correctly to DB columns", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([{ licence: "12345678" }]),
      }),
      insert: vi.fn(),
    };

    mockGetHistoClassement.mockResolvedValue([makeApiHisto()]);

    const insertedValues: unknown[] = [];
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((vals: unknown[]) => {
        insertedValues.push(...vals);
        return {
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(insertedValues),
          }),
        };
      }),
    });

    await syncHistorique(db as SyncDb, FFTT_CONFIG);

    expect(insertedValues).toHaveLength(1);
    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.licence).toBe("12345678");
    expect(row.saison).toBe("2024");
    expect(row.phase).toBe(1);
    expect(row.points).toBe(1500);
  });

  it("parses phase and points as integers", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([{ licence: "12345678" }]),
      }),
      insert: vi.fn(),
    };

    mockGetHistoClassement.mockResolvedValue([
      makeApiHisto({ phase: "2", point: "1750" }),
    ]);

    const insertedValues: unknown[] = [];
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((vals: unknown[]) => {
        insertedValues.push(...vals);
        return {
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(insertedValues),
          }),
        };
      }),
    });

    await syncHistorique(db as SyncDb, FFTT_CONFIG);

    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.phase).toBe(2);
    expect(row.points).toBe(1750);
    expect(typeof row.phase).toBe("number");
    expect(typeof row.points).toBe("number");
  });

  it("uses onConflictDoNothing (append-only, no overwrite)", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([{ licence: "12345678" }]),
      }),
      insert: vi.fn(),
    };

    mockGetHistoClassement.mockResolvedValue([makeApiHisto()]);

    let usedOnConflictDoNothing = false;
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockImplementation(() => {
          usedOnConflictDoNothing = true;
          return {
            returning: vi.fn().mockResolvedValue([{}]),
          };
        }),
      }),
    });

    await syncHistorique(db as SyncDb, FFTT_CONFIG);
    expect(usedOnConflictDoNothing).toBe(true);
  });

  it("returns count of newly inserted rows", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([
          { licence: "11111111" },
          { licence: "22222222" },
        ]),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{}, {}]),
          }),
        }),
      }),
    };

    mockGetHistoClassement
      .mockResolvedValueOnce([makeApiHisto(), makeApiHisto({ saison: "2023" })])
      .mockResolvedValueOnce([makeApiHisto({ saison: "2022" })]);

    const count = await syncHistorique(db as SyncDb, FFTT_CONFIG);
    expect(count).toBe(4);
  });

  it("handles duplicate data gracefully (DO NOTHING means no error)", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([{ licence: "12345678" }]),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    mockGetHistoClassement.mockResolvedValue([
      makeApiHisto(),
      makeApiHisto(),
    ]);

    await expect(syncHistorique(db as SyncDb, FFTT_CONFIG)).resolves.not.toThrow();
    const count = await syncHistorique(db as SyncDb, FFTT_CONFIG);
    expect(count).toBe(0);
  });

  it("skips insert when joueur has no historique", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([{ licence: "12345678" }]),
      }),
      insert: vi.fn(),
    };

    mockGetHistoClassement.mockResolvedValue([]);

    const count = await syncHistorique(db as SyncDb, FFTT_CONFIG);
    expect(count).toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
