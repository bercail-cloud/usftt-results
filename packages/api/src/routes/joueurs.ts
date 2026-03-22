import { Hono } from "hono";
import { eq, desc, asc, count } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  joueurs,
  historique_classement,
  parties_individuelles,
  sync_status,
} from "../db/schema.js";

const app = new Hono();

app.get("/joueurs", async (c) => {
  const allJoueurs = await db
    .select()
    .from(joueurs)
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
    progression_mensuelle: j.points_mensuels && j.ancien_points_mensuels
      ? Math.round((j.points_mensuels - j.ancien_points_mensuels) * 10) / 10
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
