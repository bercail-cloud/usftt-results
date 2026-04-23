import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  equipes,
  classements_poule,
  rencontres,
  parties_rencontre,
  sync_status,
} from "../db/schema.js";
import { tryParseInt } from "../lib/http.js";

type CompetitionLevel = "Nationale" | "Régionale" | "Départementale" | "Autre";

function parseCompetitionLevel(libDivision: string): CompetitionLevel {
  if (
    /Nationale/i.test(libDivision) ||
    /\bN[123]\b/.test(libDivision) ||
    /\bFED_/.test(libDivision)
  ) {
    return "Nationale";
  }
  if (
    /Régionale/i.test(libDivision) ||
    /\bR[123]\b/.test(libDivision) ||
    /\bPN\b/.test(libDivision)
  ) {
    return "Régionale";
  }
  if (
    /Départementale/i.test(libDivision) ||
    /\bD[1234]\b/.test(libDivision)
  ) {
    return "Départementale";
  }
  return "Autre";
}

function parseJourneeFromLibelle(libelle: string): number | null {
  const match = libelle.match(/J(\d+)/i);
  return match ? parseInt(match[1]!, 10) : null;
}

const app = new Hono();

app.get("/equipes", async (c) => {
  const typeFilter = c.req.query("type");

  const equipesRows = await (typeFilter
    ? db.select().from(equipes).where(eq(equipes.type_epreuve, typeFilter))
    : db.select().from(equipes));

  // For each equipe, get classements and rencontres
  const equipesWithData = await Promise.all(
    equipesRows.map(async (equipe) => {
      const classements = await db
        .select()
        .from(classements_poule)
        .where(eq(classements_poule.equipe_id, equipe.id));

      const rencRows = await db
        .select()
        .from(rencontres)
        .where(eq(rencontres.equipe_id, equipe.id));

      const rencWithJournee = rencRows.map((r) => ({
        ...r,
        journee: parseJourneeFromLibelle(r.libelle),
      }));

      return { equipe, classements, rencontres: rencWithJournee };
    })
  );

  // Group by competition level
  const grouped = new Map<
    CompetitionLevel,
    typeof equipesWithData
  >();

  for (const item of equipesWithData) {
    const level = parseCompetitionLevel(item.equipe.lib_division);
    if (!grouped.has(level)) {
      grouped.set(level, []);
    }
    grouped.get(level)!.push(item);
  }

  const groups = Array.from(grouped.entries()).map(([level, items]) => ({
    level,
    equipes: items,
  }));

  // Get latest sync status
  const syncRows = await db
    .select()
    .from(sync_status)
    .orderBy(desc(sync_status.last_run));

  const lastSync = syncRows.length > 0 ? syncRows[0]!.last_run : null;

  return c.json({ groups, lastSync });
});

app.get("/equipes/:id", async (c) => {
  const id = tryParseInt(c.req.param("id"));
  if (id === null) return c.json({ error: "Invalid id" }, 400);

  const equipeRows = await db
    .select()
    .from(equipes)
    .where(eq(equipes.id, id));

  if (equipeRows.length === 0) {
    return c.json({ error: "Equipe not found" }, 404);
  }

  const equipe = equipeRows[0];

  const classement = await db
    .select()
    .from(classements_poule)
    .where(eq(classements_poule.equipe_id, id));

  const rencRows = await db
    .select()
    .from(rencontres)
    .where(eq(rencontres.equipe_id, id));

  return c.json({ equipe, classement, rencontres: rencRows });
});

app.get("/equipes/:id/rencontres/:rencId", async (c) => {
  const rencId = tryParseInt(c.req.param("rencId"));
  if (rencId === null) return c.json({ error: "Invalid rencId" }, 400);

  const rencontreRows = await db
    .select()
    .from(rencontres)
    .where(eq(rencontres.id, rencId));

  if (rencontreRows.length === 0) {
    return c.json({ error: "Rencontre not found" }, 404);
  }

  const rencontre = rencontreRows[0];

  const parties = await db
    .select()
    .from(parties_rencontre)
    .where(eq(parties_rencontre.rencontre_id, rencId));

  return c.json({ rencontre, parties });
});

export const equipesRoutes = app;
