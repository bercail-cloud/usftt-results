import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  createMockEquipe,
  createMockClassement,
  createMockRencontre,
  createMockPartieRencontre,
  createMockSyncStatus,
} from "../fixtures/seed.js";

vi.mock("../../db/connection.js", () => ({
  db: {
    select: vi.fn(),
    query: {
      equipes: { findFirst: vi.fn() },
    },
  },
}));

import { db } from "../../db/connection.js";
import { equipesRoutes } from "../../routes/equipes.js";

const mockDb = vi.mocked(db);


const app = new Hono();
app.route("/api", equipesRoutes);

describe("GET /api/equipes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns equipes grouped by competition level", async () => {
    const equipes = [
      createMockEquipe({
        id: 1,
        lib_division: "FED_Nationale 2 Messieurs Phase 1 Poule 3",
        type_epreuve: "M",
      }),
      createMockEquipe({
        id: 2,
        lib_division: "L08_PN Messieurs phase 1 Poule 1",
        type_epreuve: "M",
      }),
      createMockEquipe({
        id: 3,
        lib_division: "D94_Départementale 3 phase 1 Poule B",
        type_epreuve: "M",
      }),
    ];

    const classements = [createMockClassement({ equipe_id: 1 })];
    const rencontres = [createMockRencontre({ equipe_id: 1 })];
    const syncStatuses = [createMockSyncStatus()];

    // Sequence of calls:
    // 1: equipes (no .where, awaitable directly from .from())
    // 2-4: classements_poule for each of 3 equipes (uses .where())
    // 5-7: rencontres for each of 3 equipes (uses .where())
    // 8: sync_status (uses .orderBy() not .where())
    let callCount = 0;
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // equipes - from() result must be directly awaitable AND have .where() for filtered path
        const thenable = Object.assign(
          { then: (resolve: (v: unknown) => void) => resolve(equipes), catch: () => {}, finally: () => {} },
          { where: vi.fn().mockResolvedValue(equipes), orderBy: vi.fn().mockResolvedValue(equipes) }
        );
        return { from: vi.fn().mockReturnValue(thenable) };
      } else if (callCount <= 4) {
        // classements_poule queries (calls 2, 3, 4)
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(classements) }) };
      } else if (callCount <= 7) {
        // rencontres queries (calls 5, 6, 7)
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rencontres) }) };
      } else {
        // sync_status (call 8)
        return { from: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(syncStatuses) }) };
      }
    });

    const res = await app.request("/api/equipes");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("groups");
    expect(Array.isArray(body.groups)).toBe(true);
  });

  it("filters equipes by typeEpreuve when ?type= is provided", async () => {
    const equipes = [
      createMockEquipe({ id: 1, type_epreuve: "F" }),
    ];

    let callCount = 0;
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(equipes),
          }),
        };
      } else if (callCount === 2) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        };
      } else if (callCount === 3) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        };
      } else {
        return {
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        };
      }
    });

    const res = await app.request("/api/equipes?type=F");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/equipes/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when equipe not found", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      };
    });

    const res = await app.request("/api/equipes/999");
    expect(res.status).toBe(404);
  });

  it("returns equipe with classement and rencontres", async () => {
    const equipe = createMockEquipe({ id: 1 });
    const classements = [
      createMockClassement({ equipe_id: 1 }),
      createMockClassement({ id: 2, equipe_id: 1, position: 2, nom_equipe: "OTHER 1" }),
    ];
    const rencontres = [createMockRencontre({ equipe_id: 1 })];

    let callCount = 0;
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([equipe]),
          }),
        };
      } else if (callCount === 2) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(classements),
          }),
        };
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(rencontres),
          }),
        };
      }
    });

    const res = await app.request("/api/equipes/1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("equipe");
    expect(body).toHaveProperty("classement");
    expect(body).toHaveProperty("rencontres");
    expect(body.equipe.id).toBe(1);
    expect(Array.isArray(body.classement)).toBe(true);
    expect(Array.isArray(body.rencontres)).toBe(true);
  });
});

describe("GET /api/equipes/:id input validation", () => {
  it("returns 400 when id is not a number", async () => {
    const res = await app.request("/api/equipes/not-a-number");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid id parameter" });
  });
});

describe("GET /api/equipes/:id/rencontres/:rencId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when rencId is not a number", async () => {
    const res = await app.request("/api/equipes/1/rencontres/not-a-number");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid rencId parameter" });
  });

  it("returns 404 when rencontre not found", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }));

    const res = await app.request("/api/equipes/1/rencontres/999");
    expect(res.status).toBe(404);
  });

  it("returns rencontre with parties", async () => {
    const rencontre = createMockRencontre({ id: 1, equipe_id: 1 });
    const parties = [
      createMockPartieRencontre({ rencontre_id: 1 }),
      createMockPartieRencontre({ id: 2, rencontre_id: 1 }),
    ];

    let callCount = 0;
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([rencontre]),
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

    const res = await app.request("/api/equipes/1/rencontres/1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("rencontre");
    expect(body).toHaveProperty("parties");
    expect(Array.isArray(body.parties)).toBe(true);
    expect(body.parties).toHaveLength(2);
  });
});
