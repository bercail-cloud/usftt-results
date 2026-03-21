import { describe, it, expect, vi, beforeEach } from "vitest";
import { criterium_tours, criterium_classement } from "../../db/schema.js";

vi.mock("../../fftt/endpoints.js", () => ({
  getEpreuves: vi.fn(),
  getDivisions: vi.fn(),
  getResultIndivPoules: vi.fn(),
  getResultIndivClassement: vi.fn(),
  getResultIndivParties: vi.fn(),
}));

import {
  getEpreuves,
  getDivisions,
  getResultIndivPoules,
  getResultIndivClassement,
  getResultIndivParties,
} from "../../fftt/endpoints.js";
import { syncCriterium } from "../../sync/sync-criterium.js";
import type { SyncDb } from "../../sync/sync-equipes.js";

const mockGetEpreuves = vi.mocked(getEpreuves);
const mockGetDivisions = vi.mocked(getDivisions);
const mockGetResultIndivPoules = vi.mocked(getResultIndivPoules);
const mockGetResultIndivClassement = vi.mocked(getResultIndivClassement);
const mockGetResultIndivParties = vi.mocked(getResultIndivParties);

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
    libelle: "Criterium Federal",
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

function makePoule(overrides: Record<string, string> = {}) {
  return {
    libelle: "T1 Gr1",
    lien: "epr=EP1&res_division=DIV1&cx_tableau=CT1",
    date: "13/03/2026",
    ...overrides,
  };
}

function makeClassement(overrides: Record<string, string> = {}) {
  return {
    rang: "1",
    nom: "DUPONT",
    clt: "1500",
    club: "FONTENAY USTT",
    points: "120A",
    ...overrides,
  };
}

function makePartie(overrides: Partial<{ libelle: string; vain: string; perd: string; forfait: boolean }> = {}) {
  return {
    libelle: "Finale",
    vain: "DUPONT",
    perd: "MARTIN",
    forfait: false,
    ...overrides,
  };
}

function makeDb(joueursList: Array<{ licence: string; nom: string; prenom: string }> = []) {
  // Use a single generic insert mock that detects the table by reference
  const insertMock = vi.fn().mockImplementation((table: unknown) => {
    if (table === criterium_tours) {
      return {
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      };
    }
    if (table === criterium_classement) {
      return {
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{}]),
          }),
        }),
      };
    }
    // criterium_parties
    return {
      values: vi.fn().mockResolvedValue([]),
    };
  });

  const deleteMock = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  });

  const fromMock = vi.fn().mockResolvedValue(joueursList);
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });

  return {
    insert: insertMock,
    delete: deleteMock,
    select: selectMock,
  };
}

describe("syncCriterium", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getEpreuves with organismeId and type I", async () => {
    mockGetEpreuves.mockResolvedValue([]);
    const db = makeDb();

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
    const db = makeDb();

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    // 3 organismes, each keeping only 1 most recent C epreuve = 3 calls
    expect(mockGetDivisions).toHaveBeenCalledTimes(3);
  });

  it("calls getResultIndivPoules for each division", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve({ idepreuve: "EP1" })]);
    mockGetDivisions.mockResolvedValue([
      makeDivision({ iddivision: "DIV1" }),
    ]);
    mockGetResultIndivPoules.mockResolvedValue([]);
    const db = makeDb();

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    // 3 organismes, each with 1 division = 3 calls
    expect(mockGetResultIndivPoules).toHaveBeenCalledTimes(3);
    expect(mockGetResultIndivPoules).toHaveBeenCalledWith(
      "EP1",
      "DIV1",
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("handles empty poules gracefully without fetching classement", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve()]);
    mockGetDivisions.mockResolvedValue([makeDivision()]);
    mockGetResultIndivPoules.mockResolvedValue([]);
    const db = makeDb();

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    expect(mockGetResultIndivClassement).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("calls getResultIndivClassement for each poule", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve()]);
    mockGetDivisions.mockResolvedValue([makeDivision()]);
    mockGetResultIndivPoules.mockResolvedValue([makePoule()]);
    mockGetResultIndivClassement.mockResolvedValue([makeClassement()]);
    mockGetResultIndivParties.mockResolvedValue([]);
    const db = makeDb([]);

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    expect(mockGetResultIndivClassement).toHaveBeenCalledWith(
      "EP1",
      "DIV1",
      "CT1",
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("does not call getEpreuves-dependent functions when no epreuves returned", async () => {
    mockGetEpreuves.mockResolvedValue([]);
    const db = makeDb();

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    expect(mockGetDivisions).not.toHaveBeenCalled();
  });

  it("returns 0 when organismeId is not configured", async () => {
    const config = { ...FFTT_CONFIG, organismeId: "" };
    const db = makeDb();

    const count = await syncCriterium(db as SyncDb, config);

    expect(count).toBe(0);
    expect(mockGetEpreuves).not.toHaveBeenCalled();
  });

  it("skips divisions with no USFTT players", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve()]);
    mockGetDivisions.mockResolvedValue([makeDivision()]);
    mockGetResultIndivPoules.mockResolvedValue([makePoule()]);
    mockGetResultIndivClassement.mockResolvedValue([
      makeClassement({ club: "SOME OTHER CLUB", nom: "RANDOM PLAYER" }),
    ]);
    const db = makeDb([]);

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    // No insert should be called since no USFTT player found
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("fetches and stores parties for groups with USFTT players", async () => {
    mockGetEpreuves.mockResolvedValue([makeEpreuve()]);
    mockGetDivisions.mockResolvedValue([makeDivision()]);
    mockGetResultIndivPoules.mockResolvedValue([makePoule()]);
    mockGetResultIndivClassement.mockResolvedValue([makeClassement()]);
    mockGetResultIndivParties.mockResolvedValue([makePartie()]);
    const db = makeDb([]);

    await syncCriterium(db as SyncDb, FFTT_CONFIG);

    expect(mockGetResultIndivParties).toHaveBeenCalled();
  });
});
