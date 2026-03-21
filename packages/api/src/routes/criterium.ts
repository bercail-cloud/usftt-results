import { Hono } from "hono";
import { eq, and, isNotNull, asc } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  criterium_classement,
  parties_individuelles,
} from "../db/schema.js";

const app = new Hono();

app.get("/criterium/tours", async (c) => {
  const distinctTours = await db
    .selectDistinct({ tour: criterium_classement.tour })
    .from(criterium_classement)
    .orderBy(asc(criterium_classement.tour));

  if (distinctTours.length === 0) {
    return c.json([]);
  }

  const tourSummaries = await Promise.all(
    distinctTours.map(async ({ tour }) => {
      const usfttPlayers = await db
        .select()
        .from(criterium_classement)
        .where(
          and(
            eq(criterium_classement.tour, tour),
            isNotNull(criterium_classement.licence)
          )
        );

      const licences = usfttPlayers
        .map((p) => p.licence)
        .filter((l): l is string => l !== null);

      let victoires = 0;
      let defaites = 0;
      let bestPerformer: string | null = null;
      let bestVictoires = -1;

      if (licences.length > 0) {
        const allParties = await db
          .select()
          .from(parties_individuelles)
          .where(
            and(
              isNotNull(parties_individuelles.licence)
            )
          );

        // Filter parties for criterium epreuve (contains "criterium" or "crit" case-insensitive)
        const criteriumParties = allParties.filter((p) =>
          /crit/i.test(p.epreuve)
        );

        // Compute per-player stats
        const playerStats = new Map<string, { victoires: number; defaites: number; nom: string }>();

        for (const player of usfttPlayers) {
          if (player.licence) {
            playerStats.set(player.licence, {
              victoires: 0,
              defaites: 0,
              nom: player.nom,
            });
          }
        }

        for (const partie of criteriumParties) {
          const stats = playerStats.get(partie.licence);
          if (stats) {
            if (partie.victoire) {
              stats.victoires++;
              victoires++;
            } else {
              stats.defaites++;
              defaites++;
            }
          }
        }

        for (const [, stats] of playerStats) {
          if (stats.victoires > bestVictoires) {
            bestVictoires = stats.victoires;
            bestPerformer = stats.nom;
          }
        }
      }

      return {
        tour,
        usfttCount: usfttPlayers.length,
        victoires,
        defaites,
        bestPerformer,
      };
    })
  );

  return c.json(tourSummaries);
});

app.get("/criterium/tours/:tour", async (c) => {
  const tour = parseInt(c.req.param("tour"), 10);

  const players = await db
    .select()
    .from(criterium_classement)
    .where(
      and(
        eq(criterium_classement.tour, tour),
        isNotNull(criterium_classement.licence)
      )
    )
    .orderBy(asc(criterium_classement.rang));

  if (players.length === 0) {
    return c.json([]);
  }

  const playerResults = await Promise.all(
    players.map(async (player) => {
      const parties = await db
        .select()
        .from(parties_individuelles)
        .where(eq(parties_individuelles.licence, player.licence!));

      const criteriumParties = parties.filter((p) => /crit/i.test(p.epreuve));

      const victoires = criteriumParties.filter((p) => p.victoire).length;
      const defaites = criteriumParties.filter((p) => !p.victoire).length;

      return {
        licence: player.licence,
        nom: player.nom,
        club: player.club,
        classement: player.classement,
        division: player.division_libelle,
        rang: player.rang,
        points: player.points,
        victoires,
        defaites,
      };
    })
  );

  return c.json(playerResults);
});

app.get("/criterium/tours/:tour/joueurs/:licence", async (c) => {
  const tour = parseInt(c.req.param("tour"), 10);
  const licence = c.req.param("licence");

  const playerRows = await db
    .select()
    .from(criterium_classement)
    .where(
      and(
        eq(criterium_classement.tour, tour),
        eq(criterium_classement.licence, licence)
      )
    )
    .limit(1);

  if (playerRows.length === 0) {
    return c.json({ error: "Player not found in this tour" }, 404);
  }

  const player = playerRows[0];

  const divisionStandings = await db
    .select()
    .from(criterium_classement)
    .where(
      and(
        eq(criterium_classement.tour, tour),
        eq(criterium_classement.division_id, player.division_id)
      )
    )
    .orderBy(asc(criterium_classement.rang));

  const matches = await db
    .select()
    .from(parties_individuelles)
    .where(eq(parties_individuelles.licence, licence));

  const criteriumMatches = matches.filter((p) => /crit/i.test(p.epreuve));

  return c.json({
    player: {
      licence: player.licence,
      nom: player.nom,
      club: player.club,
      classement: player.classement,
      division: player.division_libelle,
      rang: player.rang,
      points: player.points,
    },
    divisionStandings,
    matches: criteriumMatches,
  });
});

export const criteriumRoutes = app;
