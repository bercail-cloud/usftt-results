import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { createMockSyncStatus } from "../fixtures/seed.js";

vi.mock("../../db/connection.js", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from "../../db/connection.js";
import { createSystemRoutes } from "../../routes/system.js";

const mockDb = vi.mocked(db);

function makeSelectChain(result: unknown[]) {
  const limitMock = vi.fn().mockResolvedValue(result);
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
  const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { selectMock, fromMock, whereMock, orderByMock, limitMock };
}

const app = new Hono();
app.route("/api", createSystemRoutes(null));

describe("GET /api/health", () => {
  it("returns status ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});

describe("POST /api/sync/trigger/:module auth", () => {
  it("returns 401 when a trigger token is configured and header is missing", async () => {
    const secured = new Hono();
    secured.route("/api", createSystemRoutes(null, "super-secret-token"));
    const res = await secured.request("/api/sync/trigger/criterium", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when the bearer token does not match", async () => {
    const secured = new Hono();
    secured.route("/api", createSystemRoutes(null, "super-secret-token"));
    const res = await secured.request("/api/sync/trigger/criterium", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("passes auth and returns 503 (no FFTT config) when token matches", async () => {
    const secured = new Hono();
    secured.route("/api", createSystemRoutes(null, "super-secret-token"));
    const res = await secured.request("/api/sync/trigger/criterium", {
      method: "POST",
      headers: { authorization: "Bearer super-secret-token" },
    });
    expect(res.status).toBe(503);
  });

  it("skips auth when no trigger token is configured (backward compat)", async () => {
    const open = new Hono();
    open.route("/api", createSystemRoutes(null));
    const res = await open.request("/api/sync/trigger/criterium", {
      method: "POST",
    });
    expect(res.status).toBe(503); // still 503 because ffttConfig is null
  });
});

describe("GET /api/sync/logs/:jobName auth", () => {
  it("returns 401 when a trigger token is configured and header is missing", async () => {
    const secured = new Hono();
    secured.route("/api", createSystemRoutes(null, "super-secret-token"));
    const res = await secured.request("/api/sync/logs/sync-criterium");
    expect(res.status).toBe(401);
  });

  it("returns 401 when the bearer token does not match", async () => {
    const secured = new Hono();
    secured.route("/api", createSystemRoutes(null, "super-secret-token"));
    const res = await secured.request("/api/sync/logs/sync-criterium", {
      headers: { authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("skips auth when no trigger token is configured (backward compat)", async () => {
    const open = new Hono();
    open.route("/api", createSystemRoutes(null));
    const { selectMock, fromMock, whereMock, orderByMock } = makeSelectChain([]);
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
    fromMock.mockReturnValue({ where: whereMock });
    whereMock.mockReturnValue({ orderBy: orderByMock });
    orderByMock.mockResolvedValue([]);

    const res = await open.request("/api/sync/logs/sync-criterium");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/sync/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns latest sync status per job", async () => {
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
