import { eq, and, isNotNull, inArray } from "drizzle-orm";
import {
  getResultEquClassement,
  getResultEquMatches,
  getChpRenc,
} from "../fftt/endpoints.js";
import {
  classements_poule,
  rencontres,
  parties_rencontre,
} from "../db/schema.js";
import type { FfttConfig, SyncDb } from "./sync-equipes.js";
import { safeInt, dedupeBy } from "./coerce.js";

export interface EquipeRow {
  id: number;
  lib_equipe: string;
  id_division: string;
  id_poule: string;
}

export async function syncClassementsPoule(
  db: SyncDb,
  equipe: EquipeRow,
  ffttConfig: FfttConfig
): Promise<void> {
  const { appId, serie, password } = ffttConfig;

  const standings = await getResultEquClassement(
    equipe.id_division,
    equipe.id_poule,
    appId,
    serie,
    password
  );

  await db.delete(classements_poule).where(eq(classements_poule.equipe_id, equipe.id));

  if (standings.length === 0) {
    return;
  }

  const rows = standings.map((s) => ({
    equipe_id: equipe.id,
    club_numero: s.idclub || "",
    nom_equipe: s.equipe || "",
    position: safeInt(s.clt),
    points: safeInt(s.pts),
    joue: safeInt(s.joue),
    victoires: safeInt(s.vic),
    defaites: safeInt(s.def),
    nuls: safeInt(s.nul),
    parties_gagnees: safeInt(s.pg),
    parties_perdues: safeInt(s.pp),
  }));

  await db.insert(classements_poule).values(rows);
}

export async function syncRencontres(
  db: SyncDb,
  equipe: EquipeRow,
  ffttConfig: FfttConfig
): Promise<unknown[]> {
  const { appId, serie, password } = ffttConfig;

  const matches = await getResultEquMatches(
    equipe.id_division,
    equipe.id_poule,
    appId,
    serie,
    password
  );

  if (matches.length === 0) {
    return [];
  }

  const rows = matches.map((match) => {
    const is_domicile = match.equipeA.includes(equipe.lib_equipe);
    const parseScore = (v: string): number | null => {
      if (!v || v === "") return null;
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? null : n;
    };
    const score_a = parseScore(match.scoreA);
    const score_b = parseScore(match.scoreB);
    const lien_detail = match.lien !== "" ? match.lien : null;

    return {
      equipe_id: equipe.id,
      libelle: match.libelle,
      equipe_a: match.equipeA,
      equipe_b: match.equipeB,
      score_a,
      score_b,
      date_prevue: match.datePrevue,
      date_reelle: match.dateReelle,
      lien_detail,
      is_domicile,
    };
  });

  // FFTT API can return duplicate matches for some poules
  const dedupedRows = dedupeBy(
    rows,
    (r) => `${r.equipe_a}|${r.equipe_b}|${r.date_prevue}`
  );

  // Delete existing parties_rencontre + rencontres for this equipe, then re-insert
  const existingRencontreIds = (await db.select({ id: rencontres.id }).from(rencontres).where(eq(rencontres.equipe_id, equipe.id))).map((r: { id: number }) => r.id);
  if (existingRencontreIds.length > 0) {
    await db.delete(parties_rencontre).where(inArray(parties_rencontre.rencontre_id, existingRencontreIds));
  }
  await db.delete(rencontres).where(eq(rencontres.equipe_id, equipe.id));
  await db.insert(rencontres).values(dedupedRows);

  return dedupedRows;
}

export async function syncDetailsRencontres(
  db: SyncDb,
  equipeId: number,
  ffttConfig: FfttConfig
): Promise<void> {
  const { appId, serie, password } = ffttConfig;

  const rencontresList = await db
    .select()
    .from(rencontres)
    .where(
      and(
        eq(rencontres.equipe_id, equipeId),
        isNotNull(rencontres.lien_detail)
      )
    );

  for (const rencontre of rencontresList) {
    if (!rencontre.lien_detail) {
      continue;
    }

    const params = Object.fromEntries(
      new URLSearchParams(rencontre.lien_detail).entries()
    );

    const chpRenc = await getChpRenc(params, appId, serie, password);

    await db
      .delete(parties_rencontre)
      .where(eq(parties_rencontre.rencontre_id, rencontre.id));

    // Store equa/equb from detail result
    if (chpRenc.resultat) {
      await db
        .update(rencontres)
        .set({
          detail_equa: chpRenc.resultat.equa,
          detail_equb: chpRenc.resultat.equb,
        })
        .where(eq(rencontres.id, rencontre.id));
    }

    if (chpRenc.parties.length === 0) {
      continue;
    }

    // Build independent lookups: player name -> classement for each side
    const classementA = new Map<string, string>();
    const classementB = new Map<string, string>();
    for (const j of chpRenc.joueurs) {
      if (j.xja && j.xca) classementA.set(j.xja, j.xca);
      if (j.xjb && j.xcb) classementB.set(j.xjb, j.xcb);
    }

    const partyRows = chpRenc.parties.map((partie) => ({
      rencontre_id: rencontre.id,
      joueur_a: partie.ja,
      classement_a: classementA.get(partie.ja) ?? "",
      joueur_b: partie.jb,
      classement_b: classementB.get(partie.jb) ?? "",
      score_a: safeInt(partie.scorea),
      score_b: safeInt(partie.scoreb),
      detail_sets: partie.detail,
    }));

    await db.insert(parties_rencontre).values(partyRows);
  }
}
