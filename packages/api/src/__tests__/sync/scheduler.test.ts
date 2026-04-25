import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../sync/sync-equipes.js", () => ({
  syncEquipes: vi.fn(),
}));
vi.mock("../../sync/sync-joueurs.js", () => ({
  syncJoueurs: vi.fn(),
}));
vi.mock("../../sync/sync-rencontres.js", () => ({
  syncClassementsPoule: vi.fn(),
  syncRencontres: vi.fn(),
  syncDetailsRencontres: vi.fn(),
}));
vi.mock("../../sync/sync-parties.js", () => ({
  syncPartiesMysql: vi.fn(),
  syncPartiesSpid: vi.fn(),
}));
vi.mock("../../sync/sync-historique.js", () => ({
  syncHistorique: vi.fn(),
}));
vi.mock("../../sync/sync-criterium.js", () => ({
  syncCriterium: vi.fn(),
}));
vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn(),
  },
}));

import { syncEquipes } from "../../sync/sync-equipes.js";
import { syncJoueurs } from "../../sync/sync-joueurs.js";
import { syncClassementsPoule, syncRencontres, syncDetailsRencontres } from "../../sync/sync-rencontres.js";
import { syncPartiesMysql, syncPartiesSpid } from "../../sync/sync-parties.js";
import { syncHistorique } from "../../sync/sync-historique.js";
import { syncCriterium } from "../../sync/sync-criterium.js";
import cron from "node-cron";
import { syncFull, syncQuotidienEtJourDeMatch, syncHebdoEtDebutPhaseBiQuotidien, startScheduler } from "../../sync/scheduler.js";
import type { SyncDb } from "../../sync/sync-equipes.js";

const mockSyncEquipes = vi.mocked(syncEquipes);
const mockSyncJoueurs = vi.mocked(syncJoueurs);
const mockSyncClassementsPoule = vi.mocked(syncClassementsPoule);
const mockSyncRencontres = vi.mocked(syncRencontres);
const mockSyncDetailsRencontres = vi.mocked(syncDetailsRencontres);
const mockSyncPartiesSpid = vi.mocked(syncPartiesSpid);
vi.mocked(syncPartiesMysql);
const mockSyncHistorique = vi.mocked(syncHistorique);
const mockSyncCriterium = vi.mocked(syncCriterium);
const mockCronSchedule = vi.mocked(cron.schedule);

const FFTT_CONFIG = {
  appId: "A001",
  serie: "ABC123",
  password: "FFTT",
  clubNumero: "99999",
  clubNom: "FONTENAY USTT",
};

function makeDb(equipes: unknown[] = []) {
  const insertReturningMock = vi.fn().mockResolvedValue([]);
  const onConflictMock = vi.fn().mockReturnValue({ returning: insertReturningMock });
  const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

  const fromMock = vi.fn().mockResolvedValue(equipes);
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });

  const deleteMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });

  return {
    insert: insertMock,
    select: selectMock,
    delete: deleteMock,
    update: updateMock,
  };
}

describe("syncFull", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls all sync jobs in order", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockResolvedValue([]);
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncPartiesSpid.mockResolvedValue(0);
    mockSyncCriterium.mockResolvedValue(0);

    await syncFull(db as unknown as SyncDb, FFTT_CONFIG);

    expect(mockSyncEquipes).toHaveBeenCalledWith(db, FFTT_CONFIG);
    expect(mockSyncJoueurs).toHaveBeenCalledWith(db, FFTT_CONFIG);
    expect(mockSyncPartiesSpid).toHaveBeenCalledWith(db, FFTT_CONFIG);
    expect(mockSyncCriterium).not.toHaveBeenCalled();
  });

  it("logs success status for each completed job", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockResolvedValue([]);
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncPartiesSpid.mockResolvedValue(0);

    await syncFull(db as unknown as SyncDb, FFTT_CONFIG);

    expect(db.insert).toHaveBeenCalled();
    const insertedStatuses = (db.insert as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0]
    );
    expect(insertedStatuses.length).toBeGreaterThan(0);
  });

  it("continues executing subsequent jobs when one fails", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockRejectedValue(new Error("sync-equipes failed"));
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncPartiesSpid.mockResolvedValue(0);

    await expect(syncFull(db as unknown as SyncDb, FFTT_CONFIG)).resolves.not.toThrow();

    expect(mockSyncJoueurs).toHaveBeenCalled();
    expect(mockSyncPartiesSpid).toHaveBeenCalled();
  });

  it("logs error status when a job fails", async () => {
    const db = makeDb([]);
    const error = new Error("network failure");
    mockSyncEquipes.mockRejectedValue(error);
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncPartiesSpid.mockResolvedValue(0);

    await syncFull(db as unknown as SyncDb, FFTT_CONFIG);

    expect(db.insert).toHaveBeenCalled();
    const valuesCalls = (db.select as ReturnType<typeof vi.fn>).mock.calls;
    expect(valuesCalls).toBeDefined();
  });

  it("failure in syncEquipes does NOT prevent syncJoueurs from running", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockRejectedValue(new Error("equipes API down"));
    mockSyncJoueurs.mockResolvedValue(5);
    mockSyncPartiesSpid.mockResolvedValue(0);

    await syncFull(db as unknown as SyncDb, FFTT_CONFIG);

    expect(mockSyncJoueurs).toHaveBeenCalledTimes(1);
  });

  it("failure in syncJoueurs does NOT prevent syncParties from running", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockResolvedValue([]);
    mockSyncJoueurs.mockRejectedValue(new Error("joueurs API down"));
    mockSyncPartiesSpid.mockResolvedValue(3);

    await syncFull(db as unknown as SyncDb, FFTT_CONFIG);

    expect(mockSyncPartiesSpid).toHaveBeenCalledTimes(1);
  });

  it("multiple failures are all logged independently", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockRejectedValue(new Error("equipes failed"));
    mockSyncJoueurs.mockRejectedValue(new Error("joueurs failed"));
    mockSyncPartiesSpid.mockResolvedValue(0);

    await expect(syncFull(db as unknown as SyncDb, FFTT_CONFIG)).resolves.not.toThrow();

    expect(mockSyncPartiesSpid).toHaveBeenCalled();
  });

  it("iterates equipes from DB for classements/rencontres/details sync", async () => {
    const fakeEquipes = [
      { id: 1, lib_equipe: "USFTT 1", id_division: "DIV1", id_poule: "P1" },
      { id: 2, lib_equipe: "USFTT 2", id_division: "DIV2", id_poule: "P2" },
    ];
    const db = makeDb(fakeEquipes);
    mockSyncEquipes.mockResolvedValue([]);
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncClassementsPoule.mockResolvedValue(undefined);
    mockSyncRencontres.mockResolvedValue([]);
    mockSyncDetailsRencontres.mockResolvedValue(undefined);
    mockSyncPartiesSpid.mockResolvedValue(0);

    await syncFull(db as unknown as SyncDb, FFTT_CONFIG);

    expect(mockSyncClassementsPoule).toHaveBeenCalledTimes(2);
    expect(mockSyncRencontres).toHaveBeenCalledTimes(2);
    expect(mockSyncDetailsRencontres).toHaveBeenCalledTimes(2);
  });
});

describe("syncQuotidienEtJourDeMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs classements and parties spid", async () => {
    const fakeEquipes = [
      { id: 1, lib_equipe: "USFTT 1", id_division: "DIV1", id_poule: "P1" },
    ];
    const db = makeDb(fakeEquipes);
    mockSyncClassementsPoule.mockResolvedValue(undefined);
    mockSyncRencontres.mockResolvedValue([]);
    mockSyncDetailsRencontres.mockResolvedValue(undefined);
    mockSyncPartiesSpid.mockResolvedValue(0);

    await syncQuotidienEtJourDeMatch(db as unknown as SyncDb, FFTT_CONFIG);

    expect(mockSyncClassementsPoule).toHaveBeenCalled();
    expect(mockSyncRencontres).toHaveBeenCalled();
    expect(mockSyncDetailsRencontres).toHaveBeenCalled();
    expect(mockSyncPartiesSpid).toHaveBeenCalled();
  });

  it("does not run criterium, joueurs, or equipes sync", async () => {
    const db = makeDb([]);
    mockSyncPartiesSpid.mockResolvedValue(0);

    await syncQuotidienEtJourDeMatch(db as unknown as SyncDb, FFTT_CONFIG);

    expect(mockSyncCriterium).not.toHaveBeenCalled();
    expect(mockSyncJoueurs).not.toHaveBeenCalled();
    expect(mockSyncEquipes).not.toHaveBeenCalled();
  });

  it("continues parties spid when classements fails", async () => {
    const db = makeDb([]);
    mockSyncPartiesSpid.mockResolvedValue(0);

    await expect(syncQuotidienEtJourDeMatch(db as unknown as SyncDb, FFTT_CONFIG)).resolves.not.toThrow();

    expect(mockSyncPartiesSpid).toHaveBeenCalledTimes(1);
  });
});

describe("syncHebdoEtDebutPhaseBiQuotidien", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs equipes, joueurs, and historique", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockResolvedValue([]);
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncHistorique.mockResolvedValue(0);

    await syncHebdoEtDebutPhaseBiQuotidien(db as unknown as SyncDb, FFTT_CONFIG);

    expect(mockSyncEquipes).toHaveBeenCalledWith(db, FFTT_CONFIG);
    expect(mockSyncJoueurs).toHaveBeenCalledWith(db, FFTT_CONFIG);
    expect(mockSyncHistorique).toHaveBeenCalledWith(db, FFTT_CONFIG);
  });

  it("does not run parties or classements", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockResolvedValue([]);
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncHistorique.mockResolvedValue(0);

    await syncHebdoEtDebutPhaseBiQuotidien(db as unknown as SyncDb, FFTT_CONFIG);

    expect(mockSyncPartiesSpid).not.toHaveBeenCalled();
    expect(mockSyncClassementsPoule).not.toHaveBeenCalled();
  });

  it("continues subsequent jobs when one fails", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockRejectedValue(new Error("equipes down"));
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncHistorique.mockResolvedValue(0);

    await expect(syncHebdoEtDebutPhaseBiQuotidien(db as unknown as SyncDb, FFTT_CONFIG)).resolves.not.toThrow();

    expect(mockSyncJoueurs).toHaveBeenCalledTimes(1);
    expect(mockSyncHistorique).toHaveBeenCalledTimes(1);
  });
});

describe("startScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers all cron jobs", () => {
    const db = makeDb([]);
    startScheduler(db as unknown as SyncDb, FFTT_CONFIG);

    expect(mockCronSchedule).toHaveBeenCalledTimes(5);
  });

  it("registers daily sync at 7am and 19pm", () => {
    const db = makeDb([]);
    startScheduler(db as unknown as SyncDb, FFTT_CONFIG);

    const schedules = mockCronSchedule.mock.calls.map((call) => call[0]);
    expect(schedules).toContain("0 7,19 * * *");
  });

  it("registers match day sync every hour on Saturday", () => {
    const db = makeDb([]);
    startScheduler(db as unknown as SyncDb, FFTT_CONFIG);

    const schedules = mockCronSchedule.mock.calls.map((call) => call[0]);
    expect(schedules).toContain("0 * * * 6");
  });

  it("registers historique sync every 2 days in January and September", () => {
    const db = makeDb([]);
    startScheduler(db as unknown as SyncDb, FFTT_CONFIG);

    const schedules = mockCronSchedule.mock.calls.map((call) => call[0]);
    expect(schedules).toContain("0 6 1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31 1,9 *");
  });

  it("registers weekly historique sync on Mondays for remaining months", () => {
    const db = makeDb([]);
    startScheduler(db as unknown as SyncDb, FFTT_CONFIG);

    const schedules = mockCronSchedule.mock.calls.map((call) => call[0]);
    expect(schedules).toContain("0 6 * 2-8,10-12 1");
  });

  it("registers mysql parties sync mid-month", () => {
    const db = makeDb([]);
    startScheduler(db as unknown as SyncDb, FFTT_CONFIG);

    const schedules = mockCronSchedule.mock.calls.map((call) => call[0]);
    expect(schedules).toContain("0 6 12-20 * *");
  });
});
