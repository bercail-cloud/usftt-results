import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { createMockSyncStatus } from "../fixtures/seed.js";

vi.mock("../../db/connection.js", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("../../sync/scheduler.js", () => ({
  syncFull: vi.fn().mockResolvedValue(undefined),
  runJob: vi.fn((_db, _name, fn: () => Promise<unknown>) => fn()),
}));

vi.mock("../../sync/sync-criterium.js", () => ({
  syncCriterium: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../sync/sync-parties.js", () => ({
  syncPartiesSpid: vi.fn().mockResolvedValue(undefined),
  syncPartiesMysql: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "../../db/connection.js";
import { createSystemRoutes } from "../../routes/system.js";
import { syncFull } from "../../sync/scheduler.js";

const mockDb = vi.mocked(db);

function makeSelectChain(result: unknown[]) {
  const limitMock = vi.fn().mockResolvedValue(result);
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
  const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { selectMock, fromMock, whereMock, orderByMock, limitMock };
}

const FFTT_CONFIG = {
  appId: "test-app",
  password: "test-pw",
  serie: "TESTSERIE000000",
  clubNumero: "08940073",
  clubNom: "TEST",
};

describe("GET /api/health", () => {
  const app = new Hono();
  app.route("/api", createSystemRoutes(null));

  it("returns status ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});

describe("GET /api/sync/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const app = new Hono();
  app.route("/api", createSystemRoutes(null));

  it("returns sync status rows", async () => {
    const syncStatuses = [
      createMockSyncStatus({ job_name: "sync-equipes", status: "success" }),
      createMockSyncStatus({
        id: 2,
        job_name: "sync-joueurs",
        status: "error",
        error_message: "timeout",
      }),
    ];

    const { selectMock, fromMock, orderByMock } = makeSelectChain(syncStatuses);
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
    fromMock.mockReturnValue({ orderBy: orderByMock });
    orderByMock.mockResolvedValue(syncStatuses);

    const res = await app.request("/api/sync/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("jobs");
    expect(body).toHaveProperty("activeSyncs");
    expect(Array.isArray(body.jobs)).toBe(true);
    expect(body.jobs).toHaveLength(2);
  });

  it("returns empty array when no sync status exists", async () => {
    const { selectMock, fromMock, orderByMock } = makeSelectChain([]);
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
    fromMock.mockReturnValue({ orderBy: orderByMock });
    orderByMock.mockResolvedValue([]);

    const res = await app.request("/api/sync/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ jobs: [], activeSyncs: [] });
  });
});

describe("POST /api/sync/trigger/:module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 when FFTT config is missing", async () => {
    const app = new Hono();
    app.route("/api", createSystemRoutes(null));

    const res = await app.request("/api/sync/trigger/full", { method: "POST" });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "FFTT config not available" });
  });

  it("returns 400 for an unknown module", async () => {
    const app = new Hono();
    app.route("/api", createSystemRoutes(FFTT_CONFIG));

    const res = await app.request("/api/sync/trigger/does-not-exist", {
      method: "POST",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unknown sync module");
    expect(Array.isArray(body.available)).toBe(true);
    expect(body.available).toContain("full");
  });

  it("starts a known sync and returns 200", async () => {
    const app = new Hono();
    app.route("/api", createSystemRoutes(FFTT_CONFIG));

    const res = await app.request("/api/sync/trigger/full", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ message: "Sync full started" });
    expect(syncFull).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when the same module is already in progress", async () => {
    const app = new Hono();
    app.route("/api", createSystemRoutes(FFTT_CONFIG));

    // Make syncFull hang so the first trigger keeps the activeSyncs flag set.
    let resolveFirst!: () => void;
    vi.mocked(syncFull).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const first = await app.request("/api/sync/trigger/full", { method: "POST" });
    expect(first.status).toBe(200);

    const second = await app.request("/api/sync/trigger/full", { method: "POST" });
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error).toContain("already in progress");

    resolveFirst();
  });
});

describe("GET /api/sync/logs/:jobName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const app = new Hono();
  app.route("/api", createSystemRoutes(null));

  it("returns logs filtered by job name", async () => {
    const logs = [
      {
        id: 1,
        job_name: "sync-criterium",
        level: "info",
        message: "Started",
        details: null,
        created_at: new Date("2024-01-01T12:00:00Z"),
      },
    ];

    const { selectMock, fromMock, whereMock, orderByMock } = makeSelectChain(logs);
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
    whereMock.mockReturnValue({ orderBy: orderByMock });
    orderByMock.mockResolvedValue(logs);

    const res = await app.request("/api/sync/logs/sync-criterium");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("logs");
    expect(body.logs).toHaveLength(1);
    expect(body.logs[0].job_name).toBe("sync-criterium");
    expect(fromMock).toHaveBeenCalled();
    expect(whereMock).toHaveBeenCalled();
  });

  it("returns empty logs array when no rows match", async () => {
    const { selectMock, whereMock, orderByMock } = makeSelectChain([]);
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
    whereMock.mockReturnValue({ orderBy: orderByMock });
    orderByMock.mockResolvedValue([]);

    const res = await app.request("/api/sync/logs/sync-nothing");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ logs: [] });
  });
});
