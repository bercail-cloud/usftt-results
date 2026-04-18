import { Hono } from "hono";
import { eq, desc, asc, count, inArray } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  joueurs,
  equipes,
  rencontres,
  parties_rencontre,
  historique_classement,
  parties_individuelles,
  sync_status,
} from "../db/schema.js";

const app = new Hono();

app.get("/joueurs", async (c) => {
  const allJoueurs = await db
    .select()
    .from(joueurs)
    .where(inArray(joueurs.type_licence, ["T", "A"]))
    .orderBy(desc(joueurs.points_officiels));

  // Count matches per player
  const matchCounts = await db
    .select({
      licence: parties_individuelles.licence,
      nb_matchs: count(),
    })
    .from(parties_individuelles)
    .groupBy(parties_individuelles.licence);

  const matchCountMap = new Map(matchCounts.map((m) => [m.licence, Number(m.nb_matchs)]));

  const enriched = allJoueurs.map((j) => ({
    ...j,
    nb_matchs: matchCountMap.get(j.licence) ?? 0,
    progression_mensuelle: j.points_mensuels != null && j.ancien_points_mensuels != null
      ? Math.round(j.points_mensuels - j.ancien_points_mensuels)
      : null,
    progression_saison: j.points_mensuels != null && j.points_initm != null
      ? Math.round(j.points_mensuels - j.points_initm)
      : null,
  }));

  const syncRows = await db
    .select()
    .from(sync_status)
    .orderBy(desc(sync_status.last_run));

  const lastSync = syncRows.length > 0 ? syncRows[0]!.last_run : null;

  return c.json({ data: enriched, lastSync });
});

app.get("/joueurs/:licence", async (c) => {
  const licence = c.req.param("licence");

  const rows = await db
    .select()
    .from(joueurs)
    .where(eq(joueurs.licence, licence))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: "Joueur not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

app.get("/joueurs/:licence/equipes", async (c) => {
  const licence = c.req.param("licence");

  // Get joueur info for matching
  const joueurRows = await db
    .select({ nom: joueurs.nom, prenom: joueurs.prenom, points_officiels: joueurs.points_officiels })
    .from(joueurs)
    .where(eq(joueurs.licence, licence))
    .limit(1);

  if (joueurRows.length === 0) {
    return c.json({ data: [] });
  }

  const joueurNom = joueurRows[0]!.nom.toUpperCase();
  const joueurPrenom = joueurRows[0]!.prenom.toUpperCase();
  const joueurClt = joueurRows[0]!.points_officiels;

  // Match player in parties_rencontre by "NOM Prenom" and classement
  function isPlayerMatch(name: string, classement: string): boolean {
    const upper = name.toUpperCase();
    // Match "NOM Prenom" exactly
    if (upper.startsWith(joueurNom + " " + joueurPrenom)) return true;
    // Fallback: match nom + classement contains player's points
    if (upper.startsWith(joueurNom) && joueurClt && classement.includes(String(joueurClt))) return true;
    return false;
  }

  // Find all equipes where this player has played (via parties_rencontre)
  const allEquipes = await db.select().from(equipes);
  const allRencontres = await db.select().from(rencontres);
  const allParties = await db.select().from(parties_rencontre);

  // Build rencontre → equipe mapping
  const rencToEquipe = new Map(allRencontres.map((r) => [r.id, r]));

  // Find parties where joueur played (exclude doubles: names containing " et ")
  const playerParties = allParties.filter(
    (p) =>
      !p.joueur_a.includes(" et ") &&
      !p.joueur_b.includes(" et ") &&
      (isPlayerMatch(p.joueur_a, p.classement_a) || isPlayerMatch(p.joueur_b, p.classement_b))
  );

  // Group by equipe
  const equipeStats = new Map<number, { victoires: number; defaites: number }>();

  for (const partie of playerParties) {
    const renc = rencToEquipe.get(partie.rencontre_id);
    if (!renc) continue;

    if (!equipeStats.has(renc.equipe_id)) {
      equipeStats.set(renc.equipe_id, { victoires: 0, defaites: 0 });
    }

    const stats = equipeStats.get(renc.equipe_id)!;

    const isPlayerA = isPlayerMatch(partie.joueur_a, partie.classement_a);
    const playerWon = isPlayerA ? partie.score_a > partie.score_b : partie.score_b > partie.score_a;

    if (playerWon) {
      stats.victoires++;
    } else {
      stats.defaites++;
    }
  }

  // Build response
  const equipeMap = new Map(allEquipes.map((e) => [e.id, e]));
  const result = Array.from(equipeStats.entries())
    .map(([equipeId, stats]) => {
      const eq = equipeMap.get(equipeId);
      return {
        lib_equipe: eq?.lib_equipe ?? "",
        lib_division: eq?.lib_division ?? "",
        victoires: stats.victoires,
        defaites: stats.defaites,
        total: stats.victoires + stats.defaites,
      };
    })
    .sort((a, b) => {
      // Phase 2 before Phase 1
      const phaseA = a.lib_equipe.includes("Phase 2") ? 0 : 1;
      const phaseB = b.lib_equipe.includes("Phase 2") ? 0 : 1;
      return phaseA - phaseB;
    });

  return c.json({ data: result });
});

app.get("/joueurs/:licence/progression", async (c) => {
  const licence = c.req.param("licence");

  const historique = await db
    .select()
    .from(historique_classement)
    .where(eq(historique_classement.licence, licence))
    .orderBy(
      asc(historique_classement.saison),
      asc(historique_classement.phase)
    );

  return c.json({ data: historique });
});

app.get("/joueurs/:licence/parties", async (c) => {
  const licence = c.req.param("licence");
  const epreuveFilter = c.req.query("epreuve");

  const parties = await db
    .select()
    .from(parties_individuelles)
    .where(eq(parties_individuelles.licence, licence))
    .orderBy(desc(parties_individuelles.date_partie));

  const result = epreuveFilter
    ? parties.filter((p) => p.epreuve === epreuveFilter)
    : parties;

  return c.json({ data: result });
});

export const joueursRoutes = app;
