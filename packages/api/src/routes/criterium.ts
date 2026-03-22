import { Hono } from "hono";
import { eq, and, like, asc, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  criterium_tours,
  criterium_classement,
  criterium_parties,
  parties_individuelles,
} from "../db/schema.js";

const USFTT_CLUB = "FONTENAYSIENNE";

const app = new Hono();

app.get("/criterium/tours", async (c) => {
  // Get distinct tour numbers with dates and player counts
  const rows = await db
    .select({
      tour: criterium_tours.tour,
      date_tour: criterium_tours.date_tour,
      division_libelle: criterium_tours.division_libelle,
      niveau: criterium_tours.niveau,
      tourId: criterium_tours.id,
    })
    .from(criterium_tours)
    .orderBy(asc(criterium_tours.tour));

  if (rows.length === 0) {
    return c.json([]);
  }

  // Group by tour number
  const tourMap = new Map<
    number,
    {
      tour: number;
      date: string;
      divisions: Array<{ libelle: string; niveau: string }>;
      tourIds: number[];
    }
  >();

  for (const row of rows) {
    const existing = tourMap.get(row.tour);
    if (existing) {
      existing.divisions.push({
        libelle: row.division_libelle,
        niveau: row.niveau,
      });
      existing.tourIds.push(row.tourId);
    } else {
      tourMap.set(row.tour, {
        tour: row.tour,
        date: row.date_tour,
        divisions: [{ libelle: row.division_libelle, niveau: row.niveau }],
        tourIds: [row.tourId],
      });
    }
  }

  // For each tour, count USFTT players
  const tourSummaries = await Promise.all(
    Array.from(tourMap.values()).map(async (tourData) => {
      const usfttPlayers = await db
        .select({
          nom: criterium_classement.nom,
          licence: criterium_classement.licence,
        })
        .from(criterium_classement)
        .where(
          and(
            sql`${criterium_classement.criterium_tour_id} IN (${sql.raw(tourData.tourIds.join(","))})`,
            like(criterium_classement.club, `%${USFTT_CLUB}%`)
          )
        );

      return {
        tour: tourData.tour,
        date: tourData.date,
        usfttCount: usfttPlayers.length,
        divisions: tourData.divisions,
      };
    })
  );

  return c.json(tourSummaries);
});

app.get("/criterium/tours/:tour", async (c) => {
  const tour = parseInt(c.req.param("tour"), 10);

  // Get all tour rows for this tour number
  const tourRows = await db
    .select()
    .from(criterium_tours)
    .where(eq(criterium_tours.tour, tour));

  if (tourRows.length === 0) {
    return c.json([]);
  }

  const tourIds = tourRows.map((t) => t.id);

  // Get USFTT players across all divisions for this tour
  const players = await db
    .select({
      id: criterium_classement.id,
      criterium_tour_id: criterium_classement.criterium_tour_id,
      rang: criterium_classement.rang,
      licence: criterium_classement.licence,
      nom: criterium_classement.nom,
      club: criterium_classement.club,
      classement: criterium_classement.classement,
      points: criterium_classement.points,
    })
    .from(criterium_classement)
    .where(
      and(
        sql`${criterium_classement.criterium_tour_id} IN (${sql.raw(tourIds.join(","))})`,
        like(criterium_classement.club, `%${USFTT_CLUB}%`)
      )
    )
    .orderBy(asc(criterium_classement.rang));

  if (players.length === 0) {
    return c.json([]);
  }

  // Build a lookup for tour info
  const tourLookup = new Map(tourRows.map((t) => [t.id, t]));

  // For each player, get their match results (V/D)
  const playerResults = await Promise.all(
    players.map(async (player) => {
      const tourInfo = tourLookup.get(player.criterium_tour_id);

      // Count victories and defeats from criterium_parties
      // Classement nom is typically just surname, parties have full name "SURNAME Firstname"
      const allParties = await db
        .select()
        .from(criterium_parties)
        .where(
          eq(criterium_parties.criterium_tour_id, player.criterium_tour_id)
        );

      const namePrefix = player.nom.toUpperCase();
      const victoires = allParties.filter(
        (p) => p.vainqueur.toUpperCase().startsWith(namePrefix)
      ).length;
      const defaites = allParties.filter(
        (p) => p.perdant.toUpperCase().startsWith(namePrefix)
      ).length;

      return {
        licence: player.licence,
        nom: player.nom,
        club: player.club,
        classement: player.classement,
        division: tourInfo?.division_libelle ?? "",
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

  // Find tour rows for this tour number
  const tourRows = await db
    .select()
    .from(criterium_tours)
    .where(eq(criterium_tours.tour, tour));

  if (tourRows.length === 0) {
    return c.json({ error: "Tour not found" }, 404);
  }

  const tourIds = tourRows.map((t) => t.id);

  // Find the player in any of these tours
  const playerRows = await db
    .select()
    .from(criterium_classement)
    .where(
      and(
        sql`${criterium_classement.criterium_tour_id} IN (${sql.raw(tourIds.join(","))})`,
        eq(criterium_classement.licence, licence)
      )
    )
    .limit(1);

  if (playerRows.length === 0) {
    return c.json({ error: "Player not found in this tour" }, 404);
  }

  const player = playerRows[0]!;
  const tourInfo = tourRows.find((t) => t.id === player.criterium_tour_id);

  // Get full division standings
  const divisionStandings = await db
    .select()
    .from(criterium_classement)
    .where(
      eq(
        criterium_classement.criterium_tour_id,
        player.criterium_tour_id
      )
    )
    .orderBy(asc(criterium_classement.rang));

  // Get match results for this group
  const matches = await db
    .select()
    .from(criterium_parties)
    .where(
      eq(criterium_parties.criterium_tour_id, player.criterium_tour_id)
    );

  // Filter to only the player's matches using prefix matching
  const namePrefix = player.nom.toUpperCase();
  const playerMatches = matches.filter(
    (m) =>
      m.vainqueur.toUpperCase().startsWith(namePrefix) ||
      m.perdant.toUpperCase().startsWith(namePrefix)
  );

  // Get pool matches from parties_individuelles (epreuve = "I", matching tour date)
  // Tour dates can vary slightly across groups, collect all dates for this tour
  const tourDates = [...new Set(tourRows.map((t) => t.date_tour).filter(Boolean))];

  let poolMatches: Array<{
    libelle: string;
    victoire: boolean;
    adversaire: string;
    adversaireClassement: number;
    pointsResultat: number;
    forfait: boolean;
  }> = [];

  if (tourDates.length > 0) {
    const allPoolParties = await db
      .select()
      .from(parties_individuelles)
      .where(
        and(
          eq(parties_individuelles.licence, licence),
          sql`${parties_individuelles.date_partie} IN (${sql.raw(tourDates.map((d) => `'${d}'`).join(","))})`
        )
      );

    poolMatches = allPoolParties.map((p) => ({
      libelle: "Poule",
      victoire: p.victoire,
      adversaire: p.adversaire_nom,
      adversaireClassement: p.adversaire_classement,
      pointsResultat: p.points_resultat,
      forfait: false,
    }));
  }

  // Combine: pool matches first, then elimination phase matches
  const eliminationMatches = playerMatches.map((m) => {
    const isWinner = m.vainqueur.toUpperCase().startsWith(namePrefix);
    return {
      libelle: m.libelle,
      victoire: isWinner,
      adversaire: isWinner ? m.perdant : m.vainqueur,
      adversaireClassement: 0,
      pointsResultat: 0,
      forfait: m.forfait,
    };
  });

  return c.json({
    player: {
      licence: player.licence,
      nom: player.nom,
      club: player.club,
      classement: player.classement,
      division: tourInfo?.division_libelle ?? "",
      rang: player.rang,
      points: player.points,
    },
    divisionStandings: divisionStandings.map((s) => ({
      rang: s.rang,
      licence: s.licence,
      nom: s.nom,
      club: s.club,
      classement: s.classement,
      points: s.points,
    })),
    matches: [...poolMatches, ...eliminationMatches],
  });
});

export const criteriumRoutes = app;
