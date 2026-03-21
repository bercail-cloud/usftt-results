import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  createMockJoueur,
  createMockSyncStatus,
} from "../fixtures/seed.js";

vi.mock("../../db/connection.js", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from "../../db/connection.js";
import { joueursRoutes } from "../../routes/joueurs.js";

const mockDb = vi.mocked(db);

const app = new Hono();
app.route("/api", joueursRoutes);

function makeSelectChain(finalResult: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(finalResult),
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(finalResult),
        orderBy: vi.fn().mockResolvedValue(finalResult),
      }),
    }),
  };
}

describe("GET /api/joueurs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns player list sorted by points", async () => {
    const joueurs = [
      createMockJoueur({ licence: "0940001", points_officiels: 1600 }),
      createMockJoueur({ licence: "0940002", points_officiels: 1500 }),
    ];
    const syncRows = [createMockSyncStatus()];

    let callCount = 0;
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(joueurs),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(syncRows),
        }),
      };
    });

    const res = await app.request("/api/joueurs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("lastSync");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].licence).toBe("0940001");
  });

  it("returns lastSync as null when no sync status", async () => {
    let callCount = 0;
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      };
    });

    const res = await app.request("/api/joueurs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lastSync).toBeNull();
  });
});

describe("GET /api/joueurs/:licence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns player detail for known licence", async () => {
    const joueur = createMockJoueur({ licence: "0940001" });

    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([joueur]),
        }),
      }),
    }));

    const res = await app.request("/api/joueurs/0940001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body.data.licence).toBe("0940001");
  });

  it("returns 404 for unknown licence", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }));

    const res = await app.request("/api/joueurs/9999999");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/joueurs/:licence/progression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns historique sorted by saison and phase", async () => {
    const historique = [
      { id: 1, licence: "0940001", saison: "2023-2024", phase: 1, points: 1400 },
      { id: 2, licence: "0940001", saison: "2023-2024", phase: 2, points: 1450 },
      { id: 3, licence: "0940001", saison: "2024-2025", phase: 1, points: 1500 },
    ];

    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(historique),
        }),
      }),
    }));

    const res = await app.request("/api/joueurs/0940001/progression");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(3);
    expect(body.data[0].saison).toBe("2023-2024");
    expect(body.data[0].phase).toBe(1);
  });
});

describe("GET /api/joueurs/:licence/parties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parties sorted by date DESC", async () => {
    const parties = [
      {
        id: 1,
        licence: "0940001",
        adversaire_nom: "MARTIN",
        adversaire_classement: 1400,
        victoire: true,
        points_resultat: 12.5,
        coefficient: 1.0,
        date_partie: "2024-02-01",
        epreuve: "Championnat",
        journee: 5,
      },
      {
        id: 2,
        licence: "0940001",
        adversaire_nom: "DURAND",
        adversaire_classement: 1600,
        victoire: false,
        points_resultat: -5.0,
        coefficient: 1.0,
        date_partie: "2024-01-15",
        epreuve: "Championnat",
        journee: 4,
      },
    ];

    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(parties),
        }),
      }),
    }));

    const res = await app.request("/api/joueurs/0940001/parties");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].date_partie).toBe("2024-02-01");
  });

  it("filters parties by epreuve when query param is provided", async () => {
    const criteriumParties = [
      {
        id: 3,
        licence: "0940001",
        adversaire_nom: "LEBLANC",
        adversaire_classement: 1350,
        victoire: true,
        points_resultat: 10.0,
        coefficient: 1.0,
        date_partie: "2024-03-01",
        epreuve: "Criterium",
        journee: 1,
      },
    ];

    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(criteriumParties),
        }),
      }),
    }));

    const res = await app.request("/api/joueurs/0940001/parties?epreuve=Criterium");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].epreuve).toBe("Criterium");
  });
});
