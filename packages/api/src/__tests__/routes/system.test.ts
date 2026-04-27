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

  it("returns 401 for an empty Bearer header", async () => {
    const secured = new Hono();
    secured.route("/api", createSystemRoutes(null, "super-secret-token"));
    const res = await secured.request("/api/sync/trigger/criterium", {
      method: "POST",
      headers: { authorization: "Bearer " },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for a non-Bearer authorization scheme", async () => {
    const secured = new Hono();
    secured.route("/api", createSystemRoutes(null, "super-secret-token"));
    const res = await secured.request("/api/sync/trigger/criterium", {
      method: "POST",
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when the provided token is shorter than the expected one", async () => {
    // Length-mismatch path: bypasses timingSafeEqual but still rejects.
    const secured = new Hono();
    secured.route("/api", createSystemRoutes(null, "super-secret-token"));
    const res = await secured.request("/api/sync/trigger/criterium", {
      method: "POST",
      headers: { authorization: "Bearer short" },
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

  it("skips auth when no trigger token is configured (dev convenience)", async () => {
    // env.ts guarantees a token is present in production, so this path is
    // only reachable in development/test.
    const open = new Hono();
    open.route("/api", createSystemRoutes(null));
    const res = await open.request("/api/sync/trigger/criterium", {
      method: "POST",
    });
    expect(res.status).toBe(503); // still 503 because ffttConfig is null
  });

  it("rejects unknown sync modules with 400 and the available list", async () => {
    // Provide a stub FFTT config so we get past the 503 branch.
    const ffttConfig = {
      appId: "id",
      password: "pw",
      serie: "123456789012345",
      clubNumero: "08940073",
      clubNom: "FONTENAYSIENNE",
    };
    const open = new Hono();
    open.route("/api", createSystemRoutes(ffttConfig));
    const res = await open.request("/api/sync/trigger/does-not-exist", {
      method: "POST",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown sync module/);
    expect(Array.isArray(body.available)).toBe(true);
    expect(body.available).toContain("criterium");
  });
});

describe("GET /api/sync/logs/:jobName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns logs filtered by job name", async () => {
    const logs = [
      {
        id: 1,
        job_name: "sync-criterium",
        level: "info",
        message: "started",
        details: null,
        created_at: new Date("2024-01-01T12:00:00Z"),
      },
      {
        id: 2,
        job_name: "sync-criterium",
        level: "warn",
        message: "skipped pool",
        details: "no club player",
        created_at: new Date("2024-01-01T12:01:00Z"),
      },
    ];
    const orderByMock = vi.fn().mockResolvedValue(logs);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const res = await app.request("/api/sync/logs/sync-criterium");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs).toHaveLength(2);
    expect(body.logs[0].message).toBe("started");
    // Verify the where filter was actually applied.
    expect(whereMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array when no logs match", async () => {
    const orderByMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const res = await app.request("/api/sync/logs/unknown-job");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ logs: [] });
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
