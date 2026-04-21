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

const app = new Hono();
app.route("/api", createSystemRoutes(null));

const TOKEN = "super-secret-token-1234567890";

function securedApp() {
  const a = new Hono();
  a.route("/api", createSystemRoutes(null, TOKEN));
  return a;
}

describe("GET /api/health", () => {
  it("returns status ok (no auth required)", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});

describe("POST /api/sync/trigger/:module auth", () => {
  it("returns 401 when a trigger token is configured and header is missing", async () => {
    const res = await securedApp().request("/api/sync/trigger/criterium", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when the bearer token does not match", async () => {
    const res = await securedApp().request("/api/sync/trigger/criterium", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when a bearer token is provided with different length", async () => {
    // Hashed compare means length no longer leaks via short-circuit.
    const res = await securedApp().request("/api/sync/trigger/criterium", {
      method: "POST",
      headers: { authorization: "Bearer x" },
    });
    expect(res.status).toBe(401);
  });

  it("passes auth and returns 503 (no FFTT config) when token matches", async () => {
    const res = await securedApp().request("/api/sync/trigger/criterium", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(503);
  });

  it("skips auth when no trigger token is configured (dev backward compat)", async () => {
    const open = new Hono();
    open.route("/api", createSystemRoutes(null));
    const res = await open.request("/api/sync/trigger/criterium", {
      method: "POST",
    });
    expect(res.status).toBe(503); // still 503 because ffttConfig is null
  });
});

describe("GET /api/sync/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when a token is configured but no auth header is provided", async () => {
    const res = await securedApp().request("/api/sync/status");
    expect(res.status).toBe(401);
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

    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(syncStatuses),
      }),
    }));

    const res = await app.request("/api/sync/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("jobs");
    expect(body).toHaveProperty("activeSyncs");
    expect(Array.isArray(body.jobs)).toBe(true);
  });

  it("returns empty array when no sync status exists", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    }));

    const res = await app.request("/api/sync/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ jobs: [], activeSyncs: [] });
  });
});

describe("GET /api/sync/logs/:jobName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when a token is configured and none provided", async () => {
    const res = await securedApp().request("/api/sync/logs/sync-criterium");
    expect(res.status).toBe(401);
  });

  it("applies default limit and caps user-supplied limit", async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({ where: whereMock }),
    }));

    // default limit = 200
    const res1 = await app.request("/api/sync/logs/sync-criterium");
    expect(res1.status).toBe(200);
    expect(limitMock).toHaveBeenLastCalledWith(200);

    // user-supplied limit respected when within range
    await app.request("/api/sync/logs/sync-criterium?limit=50");
    expect(limitMock).toHaveBeenLastCalledWith(50);

    // user-supplied limit capped to MAX_LOG_LIMIT (1000)
    await app.request("/api/sync/logs/sync-criterium?limit=999999");
    expect(limitMock).toHaveBeenLastCalledWith(1000);

    // invalid or non-positive falls back to default
    await app.request("/api/sync/logs/sync-criterium?limit=-5");
    expect(limitMock).toHaveBeenLastCalledWith(200);
  });
});
