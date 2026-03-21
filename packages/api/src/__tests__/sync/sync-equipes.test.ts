import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../fftt/endpoints.js", () => ({
  getEquipes: vi.fn(),
}));

import { getEquipes } from "../../fftt/endpoints.js";
import { syncEquipes } from "../../sync/sync-equipes.js";
import type { SyncDb } from "../../sync/sync-equipes.js";

const mockGetEquipes = vi.mocked(getEquipes);

const FFTT_CONFIG = {
  appId: "A001",
  serie: "ABC123",
  password: "FFTT",
  clubNumero: "99999",
};

function makeMockDb(upsertedRows: unknown[] = []) {
  const upsertMock = vi.fn().mockResolvedValue(upsertedRows);
  const conflictMock = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ returning: upsertMock }) });
  const onConflictMock = vi.fn().mockReturnValue({ doUpdate: conflictMock });
  const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

  return {
    insert: insertMock,
    _mocks: { insertMock, valuesMock, onConflictMock, conflictMock, upsertMock },
  };
}

describe("syncEquipes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getEquipes with the club numero from config", async () => {
    mockGetEquipes.mockResolvedValue([]);
    const db = makeMockDb();
    await syncEquipes(db as SyncDb, FFTT_CONFIG);
    expect(mockGetEquipes).toHaveBeenCalledWith(
      FFTT_CONFIG.clubNumero,
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("parses lienDivision to extract idPoule (cx_poule) and idDivision (D1)", async () => {
    mockGetEquipes.mockResolvedValue([
      {
        libEquipe: "USFTT 1",
        libDivision: "R1 Regionale",
        lienDivision: "cx_poule=123&D1=456",
        idEpreuve: "EP1",
        libEpreuve: "Championnat",
      },
    ]);

    const insertedValues: unknown[] = [];
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues.push(...(Array.isArray(vals) ? vals : [vals]));
          return {
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
      }),
    };

    await syncEquipes(db as SyncDb, FFTT_CONFIG);

    expect(insertedValues).toHaveLength(1);
    const inserted = insertedValues[0] as Record<string, unknown>;
    expect(inserted.id_poule).toBe("123");
    expect(inserted.id_division).toBe("456");
  });

  it("maps equipe fields correctly into db row", async () => {
    mockGetEquipes.mockResolvedValue([
      {
        libEquipe: "USFTT 2",
        libDivision: "D1 Departementale",
        lienDivision: "cx_poule=99&D1=88",
        idEpreuve: "EP2",
        libEpreuve: "Champ Dep",
      },
    ]);

    const insertedValues: unknown[] = [];
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues.push(...(Array.isArray(vals) ? vals : [vals]));
          return {
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
      }),
    };

    await syncEquipes(db as SyncDb, FFTT_CONFIG);

    const inserted = insertedValues[0] as Record<string, unknown>;
    expect(inserted.lib_equipe).toBe("USFTT 2");
    expect(inserted.lib_division).toBe("D1 Departementale");
    expect(inserted.id_epreuve).toBe("EP2");
    expect(inserted.lib_epreuve).toBe("Champ Dep");
  });

  it("returns empty array when no equipes found", async () => {
    mockGetEquipes.mockResolvedValue([]);
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    const result = await syncEquipes(db as SyncDb, FFTT_CONFIG);
    expect(result).toEqual([]);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("handles multiple equipes and returns upserted rows", async () => {
    const fakeEquipes = [
      {
        libEquipe: "USFTT 1",
        libDivision: "R1",
        lienDivision: "cx_poule=1&D1=10",
        idEpreuve: "EP1",
        libEpreuve: "Champ R",
      },
      {
        libEquipe: "USFTT 2",
        libDivision: "D2",
        lienDivision: "cx_poule=2&D1=20",
        idEpreuve: "EP2",
        libEpreuve: "Champ D",
      },
    ];
    mockGetEquipes.mockResolvedValue(fakeEquipes);

    const fakeUpserted = [
      { id: 1, libEquipe: "USFTT 1" },
      { id: 2, libEquipe: "USFTT 2" },
    ];
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(fakeUpserted),
          }),
        }),
      }),
    };

    const result = await syncEquipes(db as SyncDb, FFTT_CONFIG);
    expect(result).toEqual(fakeUpserted);
  });
});
