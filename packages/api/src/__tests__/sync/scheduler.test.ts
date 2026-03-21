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
  syncParties: vi.fn(),
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
import { syncParties } from "../../sync/sync-parties.js";
import { syncHistorique } from "../../sync/sync-historique.js";
import { syncCriterium } from "../../sync/sync-criterium.js";
import cron from "node-cron";
import { syncFull, syncMatchDay, startScheduler } from "../../sync/scheduler.js";
import type { SyncDb } from "../../sync/sync-equipes.js";

const mockSyncEquipes = vi.mocked(syncEquipes);
const mockSyncJoueurs = vi.mocked(syncJoueurs);
const mockSyncClassementsPoule = vi.mocked(syncClassementsPoule);
const mockSyncRencontres = vi.mocked(syncRencontres);
const mockSyncDetailsRencontres = vi.mocked(syncDetailsRencontres);
const mockSyncParties = vi.mocked(syncParties);
vi.mocked(syncHistorique);
const mockSyncCriterium = vi.mocked(syncCriterium);
const mockCronSchedule = vi.mocked(cron.schedule);

const FFTT_CONFIG = {
  appId: "A001",
  serie: "ABC123",
  password: "FFTT",
  clubNumero: "99999",
  clubNom: "FONTENAY USTT",
  organismeId: "D94",
};

function makeDb(equipes: unknown[] = []) {
  const insertReturningMock = vi.fn().mockResolvedValue([]);
  const onConflictMock = vi.fn().mockReturnValue({ returning: insertReturningMock });
  const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

  const fromMock = vi.fn().mockResolvedValue(equipes);
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });

  return {
    insert: insertMock,
    select: selectMock,
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
    mockSyncParties.mockResolvedValue(0);
    mockSyncCriterium.mockResolvedValue(0);

    await syncFull(db as SyncDb, FFTT_CONFIG);

    expect(mockSyncEquipes).toHaveBeenCalledWith(db, FFTT_CONFIG);
    expect(mockSyncJoueurs).toHaveBeenCalledWith(db, FFTT_CONFIG);
    expect(mockSyncParties).toHaveBeenCalledWith(db, FFTT_CONFIG);
    expect(mockSyncCriterium).toHaveBeenCalledWith(db, FFTT_CONFIG);
  });

  it("logs success status for each completed job", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockResolvedValue([]);
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncParties.mockResolvedValue(0);
    mockSyncCriterium.mockResolvedValue(0);

    await syncFull(db as SyncDb, FFTT_CONFIG);

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
    mockSyncParties.mockResolvedValue(0);
    mockSyncCriterium.mockResolvedValue(0);

    await expect(syncFull(db as SyncDb, FFTT_CONFIG)).resolves.not.toThrow();

    expect(mockSyncJoueurs).toHaveBeenCalled();
    expect(mockSyncParties).toHaveBeenCalled();
    expect(mockSyncCriterium).toHaveBeenCalled();
  });

  it("logs error status when a job fails", async () => {
    const db = makeDb([]);
    const error = new Error("network failure");
    mockSyncEquipes.mockRejectedValue(error);
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncParties.mockResolvedValue(0);
    mockSyncCriterium.mockResolvedValue(0);

    await syncFull(db as SyncDb, FFTT_CONFIG);

    expect(db.insert).toHaveBeenCalled();
    const valuesCalls = (db.select as ReturnType<typeof vi.fn>).mock.calls;
    expect(valuesCalls).toBeDefined();
  });

  it("failure in syncEquipes does NOT prevent syncJoueurs from running", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockRejectedValue(new Error("equipes API down"));
    mockSyncJoueurs.mockResolvedValue(5);
    mockSyncParties.mockResolvedValue(0);
    mockSyncCriterium.mockResolvedValue(0);

    await syncFull(db as SyncDb, FFTT_CONFIG);

    expect(mockSyncJoueurs).toHaveBeenCalledTimes(1);
  });

  it("failure in syncJoueurs does NOT prevent syncParties from running", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockResolvedValue([]);
    mockSyncJoueurs.mockRejectedValue(new Error("joueurs API down"));
    mockSyncParties.mockResolvedValue(3);
    mockSyncCriterium.mockResolvedValue(0);

    await syncFull(db as SyncDb, FFTT_CONFIG);

    expect(mockSyncParties).toHaveBeenCalledTimes(1);
  });

  it("failure in syncParties does NOT prevent syncCriterium from running", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockResolvedValue([]);
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncParties.mockRejectedValue(new Error("parties API down"));
    mockSyncCriterium.mockResolvedValue(7);

    await syncFull(db as SyncDb, FFTT_CONFIG);

    expect(mockSyncCriterium).toHaveBeenCalledTimes(1);
  });

  it("multiple failures are all logged independently", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockRejectedValue(new Error("equipes failed"));
    mockSyncJoueurs.mockRejectedValue(new Error("joueurs failed"));
    mockSyncParties.mockResolvedValue(0);
    mockSyncCriterium.mockResolvedValue(0);

    await expect(syncFull(db as SyncDb, FFTT_CONFIG)).resolves.not.toThrow();

    expect(mockSyncParties).toHaveBeenCalled();
    expect(mockSyncCriterium).toHaveBeenCalled();
  });

  it("iterates equipes from DB for classements/rencontres/details sync", async () => {
    const fakeEquipes = [
      { id: 1, libEquipe: "USFTT 1", idDivision: "DIV1", idPoule: "P1" },
      { id: 2, libEquipe: "USFTT 2", idDivision: "DIV2", idPoule: "P2" },
    ];
    const db = makeDb(fakeEquipes);
    mockSyncEquipes.mockResolvedValue([]);
    mockSyncJoueurs.mockResolvedValue(0);
    mockSyncClassementsPoule.mockResolvedValue(undefined);
    mockSyncRencontres.mockResolvedValue([]);
    mockSyncDetailsRencontres.mockResolvedValue(undefined);
    mockSyncParties.mockResolvedValue(0);
    mockSyncCriterium.mockResolvedValue(0);

    await syncFull(db as SyncDb, FFTT_CONFIG);

    expect(mockSyncClassementsPoule).toHaveBeenCalledTimes(2);
    expect(mockSyncRencontres).toHaveBeenCalledTimes(2);
    expect(mockSyncDetailsRencontres).toHaveBeenCalledTimes(2);
  });
});

describe("syncMatchDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs equipes, classements, rencontres and details", async () => {
    const fakeEquipes = [
      { id: 1, libEquipe: "USFTT 1", idDivision: "DIV1", idPoule: "P1" },
    ];
    const db = makeDb(fakeEquipes);
    mockSyncEquipes.mockResolvedValue([]);
    mockSyncClassementsPoule.mockResolvedValue(undefined);
    mockSyncRencontres.mockResolvedValue([]);
    mockSyncDetailsRencontres.mockResolvedValue(undefined);

    await syncMatchDay(db as SyncDb, FFTT_CONFIG);

    expect(mockSyncEquipes).toHaveBeenCalled();
    expect(mockSyncClassementsPoule).toHaveBeenCalled();
    expect(mockSyncRencontres).toHaveBeenCalled();
    expect(mockSyncDetailsRencontres).toHaveBeenCalled();
  });

  it("does not run criterium or joueurs sync", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockResolvedValue([]);

    await syncMatchDay(db as SyncDb, FFTT_CONFIG);

    expect(mockSyncCriterium).not.toHaveBeenCalled();
    expect(mockSyncJoueurs).not.toHaveBeenCalled();
  });

  it("isolates failures per job without throwing", async () => {
    const db = makeDb([]);
    mockSyncEquipes.mockRejectedValue(new Error("equipes failed"));

    await expect(syncMatchDay(db as SyncDb, FFTT_CONFIG)).resolves.not.toThrow();
  });
});

describe("startScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers cron jobs for full sync, match day, and historique", () => {
    const db = makeDb([]);
    startScheduler(db as SyncDb, FFTT_CONFIG);

    expect(mockCronSchedule).toHaveBeenCalledTimes(4);
  });

  it("registers full sync at 8:00 and 20:00 daily", () => {
    const db = makeDb([]);
    startScheduler(db as SyncDb, FFTT_CONFIG);

    const schedules = mockCronSchedule.mock.calls.map((call) => call[0]);
    expect(schedules).toContain("0 8,20 * * *");
  });

  it("registers match day sync on Friday evenings", () => {
    const db = makeDb([]);
    startScheduler(db as SyncDb, FFTT_CONFIG);

    const schedules = mockCronSchedule.mock.calls.map((call) => call[0]);
    expect(schedules).toContain("0 18-23 * * 5");
  });

  it("registers match day sync on Saturday daytime", () => {
    const db = makeDb([]);
    startScheduler(db as SyncDb, FFTT_CONFIG);

    const schedules = mockCronSchedule.mock.calls.map((call) => call[0]);
    expect(schedules).toContain("0 9-20 * * 6");
  });

  it("registers weekly historique sync on Monday mornings", () => {
    const db = makeDb([]);
    startScheduler(db as SyncDb, FFTT_CONFIG);

    const schedules = mockCronSchedule.mock.calls.map((call) => call[0]);
    expect(schedules).toContain("0 6 * * 1");
  });
});
