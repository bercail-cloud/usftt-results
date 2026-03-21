import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  createMockCriteriumClassement,
} from "../fixtures/seed.js";

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

  it("returns list of tours with summary", async () => {
    const distinctTours = [{ tour: 1 }, { tour: 2 }];
    const usfttPlayers = [
      createMockCriteriumClassement({ tour: 1, licence: "0940001" }),
      createMockCriteriumClassement({ id: 2, tour: 1, licence: "0940002" }),
    ];
    const parties = [{ victoire: true }, { victoire: false }, { victoire: true }];

    let callCount = 0;
    (mockDb.selectDistinct as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(distinctTours),
      }),
    }));

    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      // odd calls = usfttPlayers (filtered by club), even calls = parties (no where clause)
      const isOdd = callCount % 2 === 1;
      const data = isOdd ? usfttPlayers : parties;
      const fromMock = vi.fn().mockResolvedValue(data);
      fromMock.mockReturnValue(
        Object.assign(Promise.resolve(data), {
          where: vi.fn().mockResolvedValue(data),
          orderBy: vi.fn().mockResolvedValue(data),
        })
      );
      return { from: fromMock };
    });

    const res = await app.request("/api/criterium/tours");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveProperty("tour");
    expect(body[0]).toHaveProperty("usfttCount");
  });

  it("returns empty array when no tours", async () => {
    (mockDb.selectDistinct as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    }));

    const res = await app.request("/api/criterium/tours");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});

describe("GET /api/criterium/tours/:tour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns USFTT players for a given tour", async () => {
    const players = [
      createMockCriteriumClassement({ tour: 1, licence: "0940001" }),
      createMockCriteriumClassement({
        id: 2,
        tour: 1,
        licence: "0940002",
        nom: "MARTIN Sophie",
      }),
    ];
    const parties = [{ victoire: true }, { victoire: false }];

    let callCount = 0;
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(players),
            }),
          }),
        };
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(parties),
          }),
        };
      }
    });

    const res = await app.request("/api/criterium/tours/1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveProperty("licence");
    expect(body[0]).toHaveProperty("nom");
    expect(body[0]).toHaveProperty("victoires");
    expect(body[0]).toHaveProperty("defaites");
  });

  it("returns empty array when no USFTT players found", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
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

  it("returns 404 when player not found in tour", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }));

    const res = await app.request("/api/criterium/tours/1/joueurs/9999999");
    expect(res.status).toBe(404);
  });

  it("returns player details with division standings and matches", async () => {
    const playerRow = createMockCriteriumClassement({
      tour: 1,
      licence: "0940001",
      division_id: "DIV1",
    });
    const divisionStandings = [
      createMockCriteriumClassement({ tour: 1, division_id: "DIV1" }),
      createMockCriteriumClassement({
        id: 2,
        tour: 1,
        division_id: "DIV1",
        licence: "0940001",
      }),
    ];
    const matches = [
      { victoire: true, adversaire_nom: "MARTIN", adversaire_classement: 1400 },
      { victoire: false, adversaire_nom: "DURAND", adversaire_classement: 1600 },
    ];

    let callCount = 0;
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // find player row
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([playerRow]),
            }),
          }),
        };
      } else if (callCount === 2) {
        // division standings
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(divisionStandings),
            }),
          }),
        };
      } else {
        // matches
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(matches),
          }),
        };
      }
    });

    const res = await app.request("/api/criterium/tours/1/joueurs/0940001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("player");
    expect(body).toHaveProperty("divisionStandings");
    expect(body).toHaveProperty("matches");
    expect(Array.isArray(body.divisionStandings)).toBe(true);
    expect(Array.isArray(body.matches)).toBe(true);
  });
});
