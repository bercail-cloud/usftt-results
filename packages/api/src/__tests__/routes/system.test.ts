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
    expect(body).toHaveProperty("isSyncing", false);
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
    expect(body).toEqual({ jobs: [], isSyncing: false });
  });
});
