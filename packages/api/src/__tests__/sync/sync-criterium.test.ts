import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../fftt/endpoints.js", () => ({
  getEpreuves: vi.fn(),
  getDivisions: vi.fn(),
  getResCla: vi.fn(),
}));

import { getEpreuves, getDivisions, getResCla } from "../../fftt/endpoints.js";
import { syncCriterium } from "../../sync/sync-criterium.js";
import type { SyncDb } from "../../sync/sync-equipes.js";

const mockGetEpreuves = vi.mocked(getEpreuves);
const mockGetDivisions = vi.mocked(getDivisions);
const mockGetResCla = vi.mocked(getResCla);

const FFTT_CONFIG = {
  appId: "A001",
  serie: "ABC123",
  password: "FFTT",
  clubNumero: "99999",
  clubNom: "FONTENAY USTT",
  organismeId: "D94",
};

function makeEpreuve(overrides: Record<string, string> = {}) {
  return {
    idepreuve: "EP1",
    idorga: "D94",
    libelle: "Criterium Federal Tour 1",
    typepreuve: "C",
    ...overrides,
  };
}

function makeDivision(overrides: Record<string, string> = {}) {
  return {
    iddivision: "DIV1",
    libelle: "Division 1",
    ...overrides,
  };
}

function makeResCla(overrides: Record<string, string> = {}) {
  return {
    rang: "1",
    nom: "DUPONT",
    clt: "1500",
    club: "FONTENAY USTT",
    points: "10",
    ...overrides,
  };
}

function makeDbWithJoueurs(joueursList: Array<{ licence: string; nom: string }> = []) {
  const insertedValues: unknown[][] = [];
  const conflictCallArgs: unknown[] = [];

  const returningMock = vi.fn().mockResolvedValue([]);
  const onConflictMock = vi.fn().mockImplementation((args: unknown) => {
    conflictCallArgs.push(args);
    return { returning: returningMock };
  });
  const valuesMock = vi.fn().mockImplementation((vals: unknown[]) => {
    insertedValues.push(vals);
    return { onConflictDoUpdate: onConflictMock };
  });
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

  const fromMock = vi.fn().mockResolvedValue(joueursList);
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });

  return {
    insert: insertMock,
    select: selectMock,
    _inserted: insertedValues,
    _conflictCallArgs: conflictCallArgs,
    _mocks: {
      insertMock,
      valuesMock,
      onConflictMock,
      returningMock,
      selectMock,
      fromMock,
    },
  };
}

describe("syncCriterium", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getEpreuves with organismeId and type I", async () => {
    mockGetEpreuves.mockResolvedValue([]);
    const db = makeDbWithJoueurs();

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    expect(mockGetEpreuves).toHaveBeenCalledWith(
      FFTT_CONFIG.organismeId,
      "I",
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("filters epreuves to only those with typepreuve === C", async () => {
    mockGetEpreuves.mockResolvedValue([
      makeEpreuve({ typepreuve: "C", idepreuve: "EP1" }),
      makeEpreuve({ typepreuve: "E", idepreuve: "EP2" }),
      makeEpreuve({ typepreuve: "C", idepreuve: "EP3" }),
    ]);
    mockGetDivisions.mockResolvedValue([]);
    const db = makeDbWithJoueurs();

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    // Sync iterates over 3 organismes (federal "1", ligue "16", dept "D94"), each with 2 C epreuves
    expect(mockGetDivisions).toHaveBeenCalledTimes(6);
    expect(mockGetDivisions).toHaveBeenCalledWith(
      FFTT_CONFIG.organismeId,
      "EP1",
      "I",
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
    expect(mockGetDivisions).toHaveBeenCalledWith(
      FFTT_CONFIG.organismeId,
      "EP3",
      "I",
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("calls getDivisions for each criterium epreuve", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve({ idepreuve: "EP1" })]);
    mockGetDivisions.mockResolvedValue([]);
    const db = makeDbWithJoueurs();

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    expect(mockGetDivisions).toHaveBeenCalledWith(
      FFTT_CONFIG.organismeId,
      "EP1",
      "I",
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("calls getResCla for each division", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve({ idepreuve: "EP1" })]);
    mockGetDivisions.mockResolvedValue([
      makeDivision({ iddivision: "DIV1" }),
      makeDivision({ iddivision: "DIV2" }),
    ]);
    mockGetResCla.mockResolvedValue([]);
    const db = makeDbWithJoueurs();

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    // Sync iterates over 3 organismes, each with 2 divisions = 6 getResCla calls
    expect(mockGetResCla).toHaveBeenCalledTimes(6);
    expect(mockGetResCla).toHaveBeenCalledWith(
      { res_division: "DIV1" },
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
    expect(mockGetResCla).toHaveBeenCalledWith(
      { res_division: "DIV2" },
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("handles empty divisions gracefully without calling getResCla", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve()]);
    mockGetDivisions.mockResolvedValue([]);
    const db = makeDbWithJoueurs();

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    expect(mockGetResCla).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("handles empty resCla gracefully without inserting", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve()]);
    mockGetDivisions.mockResolvedValue([makeDivision()]);
    mockGetResCla.mockResolvedValue([]);
    const db = makeDbWithJoueurs();

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    expect(db.insert).not.toHaveBeenCalled();
  });

  it("derives tour number from epreuve libelle with regex", async () => {
    mockGetEpreuves.mockResolvedValue([
      makeEpreuve({ idepreuve: "EP1", libelle: "Criterium Federal Tour 3" }),
    ]);
    mockGetDivisions.mockResolvedValue([makeDivision({ iddivision: "DIV1" })]);
    mockGetResCla.mockResolvedValue([makeResCla()]);
    const db = makeDbWithJoueurs([]);

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    const inserted = db._inserted[0]! as Array<Record<string, unknown>>;
    expect(inserted[0]!.tour).toBe(3);
  });

  it("defaults tour to 0 when no tour number found in libelle", async () => {
    mockGetEpreuves.mockResolvedValue([
      makeEpreuve({ idepreuve: "EP1", libelle: "Criterium Federal" }),
    ]);
    mockGetDivisions.mockResolvedValue([makeDivision({ iddivision: "DIV1" })]);
    mockGetResCla.mockResolvedValue([makeResCla()]);
    const db = makeDbWithJoueurs([]);

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    const inserted = db._inserted[0]! as Array<Record<string, unknown>>;
    expect(inserted[0]!.tour).toBe(0);
  });

  it("cross-references player nom with joueurs table to populate licence", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve()]);
    mockGetDivisions.mockResolvedValue([makeDivision({ iddivision: "DIV1" })]);
    mockGetResCla.mockResolvedValue([
      makeResCla({ nom: "DUPONT", club: "FONTENAY USTT" }),
    ]);
    const db = makeDbWithJoueurs([{ licence: "12345678", nom: "DUPONT" }]);

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    const inserted = db._inserted[0]! as Array<Record<string, unknown>>;
    expect(inserted[0]!.licence).toBe("12345678");
  });

  it("sets licence to null when player not found in joueurs table but club matches", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve()]);
    mockGetDivisions.mockResolvedValue([makeDivision({ iddivision: "DIV1" })]);
    // Player with club matching USFTT but no licence found in joueurs
    mockGetResCla.mockResolvedValue([
      makeResCla({ nom: "UNKNOWN PLAYER", club: "FONTENAY USTT" }),
    ]);
    const db = makeDbWithJoueurs([{ licence: "12345678", nom: "DUPONT" }]);

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    // Division has a USFTT club player, so insert is called
    expect(db.insert).toHaveBeenCalled();
    const inserted = db._inserted[0]! as Array<Record<string, unknown>>;
    expect(inserted[0]!.licence).toBeNull();
  });

  it("maps resCla fields correctly to DB row", async () => {
    mockGetEpreuves.mockResolvedValue([
      makeEpreuve({ idepreuve: "EP1", libelle: "Criterium Tour 2" }),
    ]);
    mockGetDivisions.mockResolvedValue([
      makeDivision({ iddivision: "DIV1", libelle: "Division A" }),
    ]);
    mockGetResCla.mockResolvedValue([
      makeResCla({ rang: "1", nom: "DUPONT", clt: "1500", club: "FONTENAY USTT", points: "10" }),
    ]);
    const db = makeDbWithJoueurs([{ licence: "12345678", nom: "DUPONT" }]);

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    const inserted = db._inserted[0]! as Array<Record<string, unknown>>;
    expect(inserted).toHaveLength(1);
    expect(inserted[0]!.division_id).toBe("DIV1");
    expect(inserted[0]!.division_libelle).toBe("Division A");
    expect(inserted[0]!.rang).toBe(1);
    expect(inserted[0]!.nom).toBe("DUPONT");
    expect(inserted[0]!.club).toBe("FONTENAY USTT");
    expect(inserted[0]!.classement).toBe(1500);
    expect(inserted[0]!.points).toBe(10);
    expect(inserted[0]!.tour).toBe(2);
    expect(inserted[0]!.licence).toBe("12345678");
  });

  it("upserts with conflict target on divisionId, nom, tour", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve()]);
    mockGetDivisions.mockResolvedValue([makeDivision({ iddivision: "DIV1" })]);
    mockGetResCla.mockResolvedValue([makeResCla()]);
    const db = makeDbWithJoueurs([]);

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    expect(db._mocks.onConflictMock).toHaveBeenCalled();
    const conflictCall = db._mocks.onConflictMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(conflictCall).toHaveProperty("target");
  });

  it("returns total count of upserted rows across all divisions", async () => {
    // Each organisme gets the same epreuve and 2 divisions (3 organismes × 2 divisions = 6 calls)
    mockGetEpreuves.mockResolvedValue([makeEpreuve()]);
    mockGetDivisions.mockResolvedValue([
      makeDivision({ iddivision: "DIV1" }),
      makeDivision({ iddivision: "DIV2" }),
    ]);
    // All 6 ResCla calls return the same 2 players with FONTENAY club
    mockGetResCla.mockResolvedValue([
      makeResCla({ rang: "1", nom: "DUPONT", club: "FONTENAY USTT" }),
      makeResCla({ rang: "2", nom: "MARTIN", club: "FONTENAY USTT" }),
    ]);

    // returning() resolves with the same 2 upserted rows each time
    const returningMock = vi.fn().mockResolvedValue([{}, {}]);
    const onConflictMock = vi.fn().mockReturnValue({ returning: returningMock });
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

    const fromMock = vi.fn().mockResolvedValue([]);
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });

    const db = {
      insert: insertMock,
      select: selectMock,
    };

    const count = await syncCriterium(db as SyncDb, FFTT_CONFIG);
    // 3 organismes × 2 divisions × 2 rows = 12
    expect(count).toBe(12);
  });

  it("does not call getEpreuves when no epreuves returned", async () => {
    mockGetEpreuves.mockResolvedValue([]);
    const db = makeDbWithJoueurs();

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    expect(mockGetDivisions).not.toHaveBeenCalled();
  });

  it("case-insensitive match for player nom lookup", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve()]);
    mockGetDivisions.mockResolvedValue([makeDivision({ iddivision: "DIV1" })]);
    mockGetResCla.mockResolvedValue([
      makeResCla({ nom: "dupont", club: "FONTENAY USTT" }),
    ]);
    const db = makeDbWithJoueurs([{ licence: "12345678", nom: "DUPONT" }]);

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    const inserted = db._inserted[0]! as Array<Record<string, unknown>>;
    expect(inserted[0]!.licence).toBe("12345678");
  });
});
