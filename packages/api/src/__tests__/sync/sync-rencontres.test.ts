import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../fftt/endpoints.js", () => ({
  getResultEquClassement: vi.fn(),
  getResultEquMatches: vi.fn(),
  getChpRenc: vi.fn(),
}));

import {
  getResultEquClassement,
  getResultEquMatches,
  getChpRenc,
} from "../../fftt/endpoints.js";
import {
  syncClassementsPoule,
  syncRencontres,
  syncDetailsRencontres,
} from "../../sync/sync-rencontres.js";
import type { EquipeRow } from "../../sync/sync-rencontres.js";
import type { SyncDb } from "../../sync/sync-equipes.js";

const mockGetClassement = vi.mocked(getResultEquClassement);
const mockGetMatches = vi.mocked(getResultEquMatches);
const mockGetChpRenc = vi.mocked(getChpRenc);

const FFTT_CONFIG = {
  appId: "A001",
  serie: "ABC123",
  password: "FFTT",
  clubNumero: "99999",
};

const EQUIPE = {
  id: 1,
  lib_equipe: "USFTT 1",
  id_division: "456",
  id_poule: "123",
};

// ─────────────────────────────────────────────────────────────────────────────
// syncClassementsPoule
// ─────────────────────────────────────────────────────────────────────────────

describe("syncClassementsPoule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getResultEquClassement with equipe idDivision and idPoule", async () => {
    mockGetClassement.mockResolvedValue([]);

    const db = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };

    await syncClassementsPoule(db as SyncDb, EQUIPE as EquipeRow, FFTT_CONFIG);

    expect(mockGetClassement).toHaveBeenCalledWith(
      EQUIPE.id_division,
      EQUIPE.id_poule,
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("deletes existing classement rows for the equipe before inserting", async () => {
    mockGetClassement.mockResolvedValue([]);

    const whereMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      delete: vi.fn().mockReturnValue({ where: whereMock }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };

    await syncClassementsPoule(db as SyncDb, EQUIPE as EquipeRow, FFTT_CONFIG);

    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(whereMock).toHaveBeenCalledTimes(1);
  });

  it("inserts standings rows when classement data is returned", async () => {
    mockGetClassement.mockResolvedValue([
      {
        poule: "P1",
        clt: "1",
        equipe: "USFTT 1",
        joue: "5",
        pts: "8",
        numero: "99999",
        totvic: "4",
        totdef: "1",
        idequipe: "111",
        idclub: "99999",
        vic: "4",
        def: "1",
        nul: "0",
        pf: "0",
        pg: "20",
        pp: "5",
      },
    ]);

    const insertedValues: unknown[] = [];
    const db = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues.push(...(Array.isArray(vals) ? vals : [vals]));
          return Promise.resolve(undefined);
        }),
      }),
    };

    await syncClassementsPoule(db as SyncDb, EQUIPE as EquipeRow, FFTT_CONFIG);

    expect(insertedValues).toHaveLength(1);
    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.equipe_id).toBe(EQUIPE.id);
    expect(row.position).toBe(1);
    expect(row.points).toBe(8);
    expect(row.joue).toBe(5);
    expect(row.victoires).toBe(4);
    expect(row.defaites).toBe(1);
    expect(row.nuls).toBe(0);
    expect(row.parties_gagnees).toBe(20);
    expect(row.parties_perdues).toBe(5);
  });

  it("does not call insert when no standings returned", async () => {
    mockGetClassement.mockResolvedValue([]);

    const db = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi.fn(),
    };

    await syncClassementsPoule(db as SyncDb, EQUIPE as EquipeRow, FFTT_CONFIG);

    expect(db.insert).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// syncRencontres
// ─────────────────────────────────────────────────────────────────────────────

describe("syncRencontres", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getResultEquMatches with equipe idDivision and idPoule", async () => {
    mockGetMatches.mockResolvedValue([]);

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };

    await syncRencontres(db as SyncDb, EQUIPE as EquipeRow, FFTT_CONFIG);

    expect(mockGetMatches).toHaveBeenCalledWith(
      EQUIPE.id_division,
      EQUIPE.id_poule,
      FFTT_CONFIG.appId,
      FFTT_CONFIG.serie,
      FFTT_CONFIG.password
    );
  });

  it("sets isDomicile=true when equipeA contains USFTT team name", async () => {
    mockGetMatches.mockResolvedValue([
      {
        libelle: "J1",
        equipeA: "USFTT 1",
        equipeB: "Club Adverse",
        scoreA: "5",
        scoreB: "4",
        lien: "renc_id=1&is_retour=0",
        datePrevue: "01/01/2024",
        dateReelle: "01/01/2024",
      },
    ]);

    const insertedValues: unknown[] = [];
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues.push(...(Array.isArray(vals) ? vals : [vals]));
          return Promise.resolve(undefined);
        }),
      }),
    };

    await syncRencontres(db as SyncDb, EQUIPE as EquipeRow, FFTT_CONFIG);

    expect(insertedValues).toHaveLength(1);
    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.is_domicile).toBe(true);
  });

  it("sets isDomicile=false when equipeA does not contain USFTT team name", async () => {
    mockGetMatches.mockResolvedValue([
      {
        libelle: "J2",
        equipeA: "Club Adverse",
        equipeB: "USFTT 1",
        scoreA: "3",
        scoreB: "6",
        lien: "renc_id=2&is_retour=1",
        datePrevue: "08/01/2024",
        dateReelle: "08/01/2024",
      },
    ]);

    const insertedValues: unknown[] = [];
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues.push(...(Array.isArray(vals) ? vals : [vals]));
          return Promise.resolve(undefined);
        }),
      }),
    };

    await syncRencontres(db as SyncDb, EQUIPE as EquipeRow, FFTT_CONFIG);

    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.is_domicile).toBe(false);
  });

  it("stores null scores when scoreA/scoreB are empty strings", async () => {
    mockGetMatches.mockResolvedValue([
      {
        libelle: "J3",
        equipeA: "USFTT 1",
        equipeB: "Club Adverse",
        scoreA: "",
        scoreB: "",
        lien: "",
        datePrevue: "15/01/2024",
        dateReelle: "",
      },
    ]);

    const insertedValues: unknown[] = [];
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues.push(...(Array.isArray(vals) ? vals : [vals]));
          return Promise.resolve(undefined);
        }),
      }),
    };

    await syncRencontres(db as SyncDb, EQUIPE as EquipeRow, FFTT_CONFIG);

    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.score_a).toBeNull();
    expect(row.score_b).toBeNull();
  });

  it("stores lienDetail as null when lien is empty", async () => {
    mockGetMatches.mockResolvedValue([
      {
        libelle: "J4",
        equipeA: "USFTT 1",
        equipeB: "Autre",
        scoreA: "",
        scoreB: "",
        lien: "",
        datePrevue: "22/01/2024",
        dateReelle: "",
      },
    ]);

    const insertedValues: unknown[] = [];
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues.push(...(Array.isArray(vals) ? vals : [vals]));
          return Promise.resolve(undefined);
        }),
      }),
    };

    await syncRencontres(db as SyncDb, EQUIPE as EquipeRow, FFTT_CONFIG);

    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.lien_detail).toBeNull();
  });

  it("returns empty array when no matches found", async () => {
    mockGetMatches.mockResolvedValue([]);

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };

    const result = await syncRencontres(db as SyncDb, EQUIPE as EquipeRow, FFTT_CONFIG);
    expect(result).toEqual([]);
    expect(db.insert).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// syncDetailsRencontres
// ─────────────────────────────────────────────────────────────────────────────

describe("syncDetailsRencontres", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getChpRenc with parsed lienDetail params for each rencontre", async () => {
    const lienDetail = "is_retour=0&phase=1&res_1=2&res_2=3&renc_id=12345&equip_1=ABC&equip_2=DEF&equip_id1=111&equip_id2=222";

    mockGetChpRenc.mockResolvedValue({
      resultat: { equa: "USFTT 1", equb: "Club B", resa: "5", resb: "4" },
      joueurs: [],
      parties: [],
    });

    const whereMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 10,
              equipe_id: 1,
              lien_detail: lienDetail,
              score_a: 5,
              score_b: 4,
            },
          ]),
        }),
      }),
      delete: vi.fn().mockReturnValue({ where: whereMock }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
    };

    await syncDetailsRencontres(db as SyncDb, 1, FFTT_CONFIG);

    expect(mockGetChpRenc).toHaveBeenCalledTimes(1);
    const [calledParams] = mockGetChpRenc.mock.calls[0]!;
    expect(calledParams).toMatchObject({
      renc_id: "12345",
      is_retour: "0",
      phase: "1",
    });
  });

  it("deletes existing parties_rencontre before inserting new ones", async () => {
    mockGetChpRenc.mockResolvedValue({
      resultat: { equa: "USFTT 1", equb: "Club B", resa: "5", resb: "4" },
      joueurs: [],
      parties: [
        { ja: "Joueur A", scorea: "3", jb: "Joueur B", scoreb: "0", detail: "11-5 11-3 11-4" },
      ],
    });

    const whereMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 10, equipe_id: 1, lien_detail: "renc_id=12345&is_retour=0", score_a: 5, score_b: 4 },
          ]),
        }),
      }),
      delete: vi.fn().mockReturnValue({ where: whereMock }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
    };

    await syncDetailsRencontres(db as SyncDb, 1, FFTT_CONFIG);

    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(whereMock).toHaveBeenCalledTimes(1);
  });

  it("inserts parties with rencontreId and parsed fields", async () => {
    mockGetChpRenc.mockResolvedValue({
      resultat: { equa: "USFTT 1", equb: "Club B", resa: "5", resb: "4" },
      joueurs: [
        { xja: "Joueur A", xca: "1000", xjb: "Joueur B", xcb: "900" },
      ],
      parties: [
        { ja: "Joueur A", scorea: "3", jb: "Joueur B", scoreb: "0", detail: "11-5 11-3 11-4" },
      ],
    });

    const insertedValues: unknown[] = [];
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 10, equipe_id: 1, lien_detail: "renc_id=12345&is_retour=0", score_a: 5, score_b: 4 },
          ]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues.push(...(Array.isArray(vals) ? vals : [vals]));
          return Promise.resolve(undefined);
        }),
      }),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
    };

    await syncDetailsRencontres(db as SyncDb, 1, FFTT_CONFIG);

    expect(insertedValues).toHaveLength(1);
    const row = insertedValues[0] as Record<string, unknown>;
    expect(row.rencontre_id).toBe(10);
    expect(row.joueur_a).toBe("Joueur A");
    expect(row.joueur_b).toBe("Joueur B");
    expect(row.score_a).toBe(3);
    expect(row.score_b).toBe(0);
    expect(row.detail_sets).toBe("11-5 11-3 11-4");
  });

  it("skips rencontres with null lienDetail", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 11, equipe_id: 1, lien_detail: null, score_a: null, score_b: null },
          ]),
        }),
      }),
      delete: vi.fn(),
      insert: vi.fn(),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
    };

    await syncDetailsRencontres(db as SyncDb, 1, FFTT_CONFIG);

    expect(mockGetChpRenc).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
});
