import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("../../db/connection.js", () => ({
  db: {
    select: vi.fn(),
    selectDistinct: vi.fn(),
  },
}));

import { db } from "../../db/connection.js";
import { criteriumRoutes } from "../../routes/criterium.js";

const mockDb = vi.mocked(db);

const app = new Hono();
app.route("/api", criteriumRoutes);

describe("GET /api/criterium/tours", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no tours", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    }));

    const res = await app.request("/api/criterium/tours");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns tour summaries with date and usfttCount", async () => {
    const tourRows = [
      {
        tour: 1,
        date_tour: "13/03/2026",
        division_libelle: "Division 1",
        niveau: "National",
        tourId: 1,
      },
    ];
    const usfttPlayers = [
      { nom: "DUPONT Jean", licence: "0940001" },
      { nom: "MARTIN Paul", licence: "0940002" },
    ];

    let selectCallCount = 0;
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // First call: get tour rows
        return {
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(tourRows),
          }),
        };
      }
      // Second call: count USFTT players
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(usfttPlayers),
        }),
      };
    });

    const res = await app.request("/api/criterium/tours");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0]).toHaveProperty("tour", 1);
    expect(body[0]).toHaveProperty("date", "13/03/2026");
    expect(body[0]).toHaveProperty("usfttCount", 2);
  });
});

describe("GET /api/criterium/tours/:tour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when tour parameter is not a number", async () => {
    const res = await app.request("/api/criterium/tours/abc");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("returns empty array when no tour rows found", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }));

    const res = await app.request("/api/criterium/tours/99");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});

describe("GET /api/criterium/tours/:tour/joueurs/:licence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when tour parameter is not a number", async () => {
    const res = await app.request("/api/criterium/tours/abc/joueurs/0940001");
    expect(res.status).toBe(400);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("returns 400 when tourId query parameter is not a number", async () => {
    const tourRows = [{ id: 1, tour: 1, date_tour: "13/03/2026", division_libelle: "D1", niveau: "Departemental" }];
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(tourRows),
      }),
    }));

    const res = await app.request("/api/criterium/tours/1/joueurs/0940001?tourId=abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 when tour not found", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }));

    const res = await app.request("/api/criterium/tours/1/joueurs/9999999");
    expect(res.status).toBe(404);
  });
});
