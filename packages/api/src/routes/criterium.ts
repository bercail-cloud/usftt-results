import { Hono } from "hono";
import { eq, and, like, asc, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  criterium_tours,
  criterium_classement,
  criterium_parties,
  parties_individuelles,
  joueurs,
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

  // Build a lookup for tour info
  const tourLookup = new Map(tourRows.map((t) => [t.id, t]));

  // Build prenom lookup from joueurs table
  const licences = players.map((p) => p.licence).filter(Boolean) as string[];
  const joueursRows = licences.length > 0
    ? await db
        .select({ licence: joueurs.licence, prenom: joueurs.prenom })
        .from(joueurs)
        .where(sql`${joueurs.licence} IN (${sql.raw(licences.map((l) => `'${l}'`).join(","))})`)
    : [];
  const prenomByLicence = new Map(joueursRows.map((j) => [j.licence, j.prenom]));

  // Collect all tour dates for pool match lookup
  const tourDates = [...new Set(tourRows.map((t) => t.date_tour).filter(Boolean))];

  // For each player, get their match results (V/D) from both sources
  const playerResults = await Promise.all(
    players.map(async (player) => {
      const tourInfo = tourLookup.get(player.criterium_tour_id);
      // Bug #3 fix: match by full name instead of prefix
      const playerName = player.nom.toUpperCase();

      // 1. Count from criterium_parties (elimination phases)
      const allParties = await db
        .select()
        .from(criterium_parties)
        .where(
          eq(criterium_parties.criterium_tour_id, player.criterium_tour_id)
        );

      const elimVictoires = allParties.filter(
        (p) => p.vainqueur.toUpperCase() === playerName
      ).length;
      const elimDefaites = allParties.filter(
        (p) => p.perdant.toUpperCase() === playerName
      ).length;

      // Build set of elimination adversary full names for dedup
      const elimAdversaries = new Set(
        allParties
          .filter(
            (p) =>
              p.vainqueur.toUpperCase() === playerName ||
              p.perdant.toUpperCase() === playerName
          )
          .map((p) => {
            const isWinner = p.vainqueur.toUpperCase() === playerName;
            return (isWinner ? p.perdant : p.vainqueur).toUpperCase();
          })
      );

      // 2. Count from parties_individuelles (pool matches, deduplicated)
      let poolVictoires = 0;
      let poolDefaites = 0;

      // Bug #4 fix: use player's specific tour date, not all dates
      const playerTourDate = tourLookup.get(player.criterium_tour_id)?.date_tour;

      if (player.licence && playerTourDate) {
        const poolParties = await db
          .select()
          .from(parties_individuelles)
          .where(
            and(
              eq(parties_individuelles.licence, player.licence),
              sql`${parties_individuelles.date_partie} = ${playerTourDate}`
            )
          );

        const dedupedPool = poolParties.filter((p) => {
          return !elimAdversaries.has(p.adversaire_nom.toUpperCase());
        });

        poolVictoires = dedupedPool.filter((p) => p.victoire).length;
        poolDefaites = dedupedPool.filter((p) => !p.victoire).length;
      }

      const prenom = player.licence ? prenomByLicence.get(player.licence) ?? "" : "";

      return {
        licence: player.licence,
        nom: player.nom,
        prenom,
        club: player.club,
        classement: player.classement,
        division: tourInfo?.division_libelle ?? "",
        rang: player.rang,
        points: player.points,
        victoires: elimVictoires + poolVictoires,
        defaites: elimDefaites + poolDefaites,
      };
    })
  );

  // Find USFTT players who played on tour dates but aren't in criterium standings
  const existingLicences = new Set(
    players.map((p) => p.licence).filter(Boolean)
  );

  if (tourDates.length > 0) {
    const dateList = tourDates.map((d) => `'${d}'`).join(",");
    const missingPlayers = await db
      .select({
        licence: parties_individuelles.licence,
        nom: joueurs.nom,
        prenom: joueurs.prenom,
        points_officiels: joueurs.points_officiels,
        date_partie: parties_individuelles.date_partie,
        victoire: parties_individuelles.victoire,
      })
      .from(parties_individuelles)
      .innerJoin(joueurs, eq(joueurs.licence, parties_individuelles.licence))
      .where(
        and(
          eq(joueurs.club_numero, "08940073"),
          sql`${parties_individuelles.date_partie} IN (${sql.raw(dateList)})`,
          sql`(${parties_individuelles.epreuve_libelle} ILIKE '%crit%' OR ${parties_individuelles.epreuve_libelle} ILIKE '%fédéral%' OR ${parties_individuelles.epreuve_libelle} ILIKE '%federal%')`
        )
      );

    // Group by licence
    const missingByLicence = new Map<string, {
      licence: string;
      nom: string;
      prenom: string;
      classement: number;
      victoires: number;
      defaites: number;
    }>();

    for (const row of missingPlayers) {
      if (existingLicences.has(row.licence)) continue;

      if (!missingByLicence.has(row.licence)) {
        missingByLicence.set(row.licence, {
          licence: row.licence,
          nom: row.nom,
          prenom: row.prenom,
          classement: row.points_officiels ?? 0,
          victoires: 0,
          defaites: 0,
        });
      }

      const entry = missingByLicence.get(row.licence)!;
      if (row.victoire) {
        entry.victoires++;
      } else {
        entry.defaites++;
      }
    }

    // Add missing players to results
    for (const [, entry] of missingByLicence) {
      playerResults.push({
        licence: entry.licence,
        nom: entry.nom,
        prenom: entry.prenom,
        club: USFTT_CLUB,
        classement: entry.classement,
        division: "Non publie",
        rang: 0,
        points: "",
        victoires: entry.victoires,
        defaites: entry.defaites,
      });
    }
  }

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
    // Fallback: player not in criterium standings, build from parties_individuelles
    const tourDates = [...new Set(tourRows.map((t) => t.date_tour).filter(Boolean))];
    if (tourDates.length === 0) {
      return c.json({ error: "Player not found in this tour" }, 404);
    }

    const dateList = tourDates.map((d) => `'${d}'`).join(",");
    // Bug #1 fix: filter by criterium epreuve type (same as overview)
    const fallbackParties = await db
      .select()
      .from(parties_individuelles)
      .where(
        and(
          eq(parties_individuelles.licence, licence),
          sql`${parties_individuelles.date_partie} IN (${sql.raw(dateList)})`,
          sql`(${parties_individuelles.epreuve_libelle} ILIKE '%crit%' OR ${parties_individuelles.epreuve_libelle} ILIKE '%fédéral%' OR ${parties_individuelles.epreuve_libelle} ILIKE '%federal%')`
        )
      );

    if (fallbackParties.length === 0) {
      return c.json({ error: "Player not found in this tour" }, 404);
    }

    // Get joueur info
    const joueurRows = await db
      .select()
      .from(joueurs)
      .where(eq(joueurs.licence, licence))
      .limit(1);

    const joueurInfo = joueurRows[0];

    return c.json({
      player: {
        licence,
        nom: joueurInfo ? joueurInfo.nom : licence,
        club: joueurInfo?.club_numero ?? "",
        classement: joueurInfo?.points_officiels ?? 0,
        division: "Resultats non trouves sur la FFTT",
        rang: 0,
        points: "",
      },
      divisionStandings: [],
      matches: fallbackParties.map((p) => ({
        libelle: "Poule",
        victoire: p.victoire,
        adversaire: p.adversaire_nom,
        adversaireClassement: p.adversaire_classement,
        pointsResultat: p.points_resultat,
        forfait: p.forfait,
        estimated: p.adversaire_licence === "",
      })),
    });
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

  // Bug #3 fix: match by full name instead of prefix to avoid false positives with siblings
  const playerName = player.nom.toUpperCase();
  const playerMatches = matches.filter(
    (m) =>
      m.vainqueur.toUpperCase() === playerName ||
      m.perdant.toUpperCase() === playerName
  );

  // Bug #4 fix: use only the date of the player's specific tour/division, not all dates
  const playerTourDate = tourInfo?.date_tour;
  const tourDates = playerTourDate ? [playerTourDate] : [];

  let poolMatches: Array<{
    libelle: string;
    victoire: boolean;
    adversaire: string;
    adversaireClassement: number;
    pointsResultat: number;
    forfait: boolean;
    estimated: boolean;
  }> = [];

  let allPoolParties: Array<typeof parties_individuelles.$inferSelect> = [];

  if (tourDates.length > 0) {
    allPoolParties = await db
      .select()
      .from(parties_individuelles)
      .where(
        and(
          eq(parties_individuelles.licence, licence),
          sql`${parties_individuelles.date_partie} IN (${sql.raw(tourDates.map((d) => `'${d}'`).join(","))})`
        )
      );

    // Build set of elimination phase adversary full names (to deduplicate)
    const elimAdversaries = new Set(
      playerMatches.map((m) => {
        const isWinner = m.vainqueur.toUpperCase() === playerName;
        return (isWinner ? m.perdant : m.vainqueur).toUpperCase();
      })
    );

    poolMatches = allPoolParties
      .filter((p) => {
        // Exclude matches that are already in elimination phases
        return !elimAdversaries.has(p.adversaire_nom.toUpperCase());
      })
      .map((p) => ({
        libelle: "Poule",
        victoire: p.victoire,
        adversaire: p.adversaire_nom,
        adversaireClassement: p.adversaire_classement,
        pointsResultat: p.points_resultat,
        forfait: p.forfait,
        estimated: p.adversaire_licence === "",
      }));
  }

  // Bug #2 fix: reuse allPoolParties instead of querying again
  const partiesByAdv = new Map(
    (allPoolParties ?? []).map((p) => [p.adversaire_nom.toUpperCase(), p])
  );

  // Combine: pool matches first, then elimination phase matches
  const eliminationMatches = playerMatches.map((m) => {
    const isWinner = m.vainqueur.toUpperCase() === playerName;
    const adversaire = isWinner ? m.perdant : m.vainqueur;
    const partieInfo = partiesByAdv.get(adversaire.toUpperCase());
    return {
      libelle: m.libelle,
      victoire: isWinner,
      adversaire,
      adversaireClassement: partieInfo?.adversaire_classement ?? 0,
      pointsResultat: partieInfo?.points_resultat ?? 0,
      forfait: m.forfait,
      estimated: partieInfo ? partieInfo.adversaire_licence === "" : true,
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
