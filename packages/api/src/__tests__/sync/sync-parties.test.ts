import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../fftt/endpoints.js", () => ({
  getPartieMysql: vi.fn(),
  getPartieSpid: vi.fn(),
}));

import { getPartieMysql } from "../../fftt/endpoints.js";
import { syncPartiesMysql } from "../../sync/sync-parties.js";
import type { SyncDb } from "../../sync/sync-equipes.js";

const mockGetPartieMysql = vi.mocked(getPartieMysql);

const FFTT_CONFIG = {
  appId: "A001",
  serie: "ABC123",
  password: "FFTT",
  clubNumero: "99999",
};

function makeApiPartie(overrides: Record<string, string> = {}) {
  return {
    licence: "12345678",
    advlic: "87654321",
    vd: "V",
    numjourn: "5",
    codechamp: "FM01",
    date: "15/01/2025",
    advsexe: "M",
    advnompre: "MARTIN Pierre",
    pointres: "2.5",
    coefchamp: "1.0",
    advclaof: "1600",
    idpartie: "999",
    ...overrides,
  };
}


describe("syncPartiesMysql", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets all joueurs licences from DB", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    const db = { select: selectMock };

    await syncPartiesMysql(db as unknown as SyncDb, FFTT_CONFIG);
    expect(selectMock).toHaveBeenCalled();
  });

  it("returns 0 when no joueurs in DB", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const db = { select: vi.fn().mockReturnValue({ from: fromMock }) };

    const count = await syncPartiesMysql(db as unknown as SyncDb, FFTT_CONFIG);
    expect(count).toBe(0);
    expect(mockGetPartieMysql).not.toHaveBeenCalled();
  });

  it("calls getPartieMysql for each joueur licence", async () => {
    const licences = ["11111111", "22222222"];
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(licences.map((l) => ({ licence: l }))),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    mockGetPartieMysql.mockResolvedValue([]);

    await syncPartiesMysql(db as unknown as SyncDb, FFTT_CONFIG);

    expect(mockGetPartieMysql).toHaveBeenCalledTimes(2);
    expect(mockGetPartieMysql).toHaveBeenCalledWith(
      "11111111",
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
    expect(mockGetPartieMysql).toHaveBeenCalledWith(
      "22222222",
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("maps V to victoire=true and D to victoire=false", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ licence: "12345678" }]),
        }),
      }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };

    mockGetPartieMysql.mockResolvedValueOnce([
      makeApiPartie({ vd: "V" }),
      makeApiPartie({ vd: "D", advlic: "99999999" }),
    ]);

    const insertedValues: unknown[] = [];
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((vals: unknown[]) => {
        insertedValues.push(...vals);
        return Promise.resolve(insertedValues);
      }),
    });

    await syncPartiesMysql(db as unknown as SyncDb, FFTT_CONFIG);

    const rows = insertedValues as Array<Record<string, unknown>>;
    const victoire = rows.find((r) => r.adversaire_licence === "87654321");
    const defaite = rows.find((r) => r.adversaire_licence === "99999999");
    expect(victoire?.victoire).toBe(true);
    expect(defaite?.victoire).toBe(false);
  });

  it("maps API fields correctly to DB columns", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ licence: "12345678" }]),
        }),
      }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      insert: vi.fn(),
    };

    mockGetPartieMysql.mockResolvedValue([makeApiPartie()]);

    const insertedValues: unknown[] = [];
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((vals: unknown[]) => {
        insertedValues.push(...vals);
        return Promise.resolve(insertedValues);
      }),
    });

    await syncPartiesMysql(db as unknown as SyncDb, FFTT_CONFIG);

    expect(insertedValues).toHaveLength(1);
    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.licence).toBe("12345678");
    expect(row.adversaire_licence).toBe("87654321");
    expect(row.adversaire_nom).toBe("MARTIN Pierre");
    expect(row.adversaire_classement).toBe(1600);
    expect(row.victoire).toBe(true);
    expect(row.points_resultat).toBe(2.5);
    expect(row.coefficient).toBe(1.0);
    expect(row.date_partie).toBe("15/01/2025");
    expect(row.epreuve).toBe("FM01");
    expect(row.journee).toBe(5);
  });

  it("parses numeric fields correctly", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ licence: "12345678" }]),
        }),
      }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      insert: vi.fn(),
    };

    mockGetPartieMysql.mockResolvedValue([
      makeApiPartie({ advclaof: "1750", pointres: "3.5", coefchamp: "0.5", numjourn: "12" }),
    ]);

    const insertedValues: unknown[] = [];
    db.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((vals: unknown[]) => {
        insertedValues.push(...vals);
        return Promise.resolve(insertedValues);
      }),
    });

    await syncPartiesMysql(db as unknown as SyncDb, FFTT_CONFIG);

    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.adversaire_classement).toBe(1750);
    expect(row.points_resultat).toBe(3.5);
    expect(row.coefficient).toBe(0.5);
    expect(row.journee).toBe(12);
    expect(typeof row.adversaire_classement).toBe("number");
    expect(typeof row.points_resultat).toBe("number");
    expect(typeof row.coefficient).toBe("number");
    expect(typeof row.journee).toBe("number");
  });

  it("returns total count of synced parties across all joueurs", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { licence: "11111111" },
            { licence: "22222222" },
          ]),
        }),
      }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };

    mockGetPartieMysql
      .mockResolvedValueOnce([makeApiPartie(), makeApiPartie({ advlic: "AAAAAAAA" })])
      .mockResolvedValueOnce([makeApiPartie({ licence: "22222222" })]);

    const count = await syncPartiesMysql(db as unknown as SyncDb, FFTT_CONFIG);
    expect(count).toBe(3);
  });

  it("skips insert when joueur has no parties", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ licence: "11111111" }]),
        }),
      }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      insert: vi.fn(),
    };

    mockGetPartieMysql.mockResolvedValue([]);

    const count = await syncPartiesMysql(db as unknown as SyncDb, FFTT_CONFIG);
    expect(count).toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
