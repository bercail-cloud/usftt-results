import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../fftt/endpoints.js", () => ({
  getLicenceB: vi.fn(),
}));

import { getLicenceB } from "../../fftt/endpoints.js";
import { syncJoueurs } from "../../sync/sync-joueurs.js";

const mockGetLicenceB = vi.mocked(getLicenceB);

const FFTT_CONFIG = {
  appId: "A001",
  serie: "ABC123",
  password: "FFTT",
  clubNumero: "99999",
};

function makeApiPlayer(overrides: Record<string, string> = {}) {
  return {
    idlicence: "123",
    nom: "DUPONT",
    prenom: "Jean",
    licence: "12345678",
    numclub: "99999",
    nomclub: "USFTT",
    sexe: "M",
    type: "P",
    point: "1500",
    cat: "SH",
    pointm: "1520",
    apointm: "",
    initm: "",
    natio: "FRA",
    ...overrides,
  };
}

function makeInsertMock(returnedRows: unknown[] = []) {
  const returningMock = vi.fn().mockResolvedValue(returnedRows);
  const onConflictMock = vi.fn().mockReturnValue({ returning: returningMock });
  const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

  return {
    insert: insertMock,
    _mocks: { insertMock, valuesMock, onConflictMock, returningMock },
  };
}

describe("syncJoueurs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getLicenceB with club from config", async () => {
    mockGetLicenceB.mockResolvedValue([]);
    const db = makeInsertMock();
    await syncJoueurs(db as any, FFTT_CONFIG);
    expect(mockGetLicenceB).toHaveBeenCalledWith(
      { club: FFTT_CONFIG.clubNumero },
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("returns 0 when no players returned from API", async () => {
    mockGetLicenceB.mockResolvedValue([]);
    const db = makeInsertMock();
    const count = await syncJoueurs(db as any, FFTT_CONFIG);
    expect(count).toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("maps API fields correctly to DB columns", async () => {
    mockGetLicenceB.mockResolvedValue([makeApiPlayer()]);

    const insertedValues: unknown[] = [];
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals: unknown[]) => {
          insertedValues.push(...vals);
          return {
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue(insertedValues),
            }),
          };
        }),
      }),
    };

    await syncJoueurs(db as any, FFTT_CONFIG);

    expect(insertedValues).toHaveLength(1);
    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.licence).toBe("12345678");
    expect(row.nom).toBe("DUPONT");
    expect(row.prenom).toBe("Jean");
    expect(row.clubNumero).toBe("99999");
    expect(row.pointsOfficiels).toBe(1500);
    expect(row.pointsMensuels).toBe(1520);
    expect(row.categorie).toBe("SH");
    expect(row.sexe).toBe("M");
  });

  it("parses point and pointm as integers", async () => {
    mockGetLicenceB.mockResolvedValue([makeApiPlayer({ point: "1750", pointm: "1800" })]);

    const insertedValues: unknown[] = [];
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals: unknown[]) => {
          insertedValues.push(...vals);
          return {
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue(insertedValues),
            }),
          };
        }),
      }),
    };

    await syncJoueurs(db as any, FFTT_CONFIG);

    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.pointsOfficiels).toBe(1750);
    expect(row.pointsMensuels).toBe(1800);
    expect(typeof row.pointsOfficiels).toBe("number");
    expect(typeof row.pointsMensuels).toBe("number");
  });

  it("returns count of synced players", async () => {
    mockGetLicenceB.mockResolvedValue([
      makeApiPlayer({ licence: "11111111" }),
      makeApiPlayer({ licence: "22222222" }),
      makeApiPlayer({ licence: "33333333" }),
    ]);

    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{}, {}, {}]),
          }),
        }),
      }),
    };

    const count = await syncJoueurs(db as any, FFTT_CONFIG);
    expect(count).toBe(3);
  });

  it("upserts with updatedAt in the conflict set", async () => {
    mockGetLicenceB.mockResolvedValue([makeApiPlayer()]);

    let conflictSetArg: Record<string, unknown> = {};
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockImplementation(({ set }: { set: Record<string, unknown> }) => {
            conflictSetArg = set;
            return {
              returning: vi.fn().mockResolvedValue([{}]),
            };
          }),
        }),
      }),
    };

    await syncJoueurs(db as any, FFTT_CONFIG);
    expect(conflictSetArg).toHaveProperty("updatedAt");
  });
});
