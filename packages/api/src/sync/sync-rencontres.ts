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
import { safeIntOrZero as si, safeIntOrNull } from "./parsers.js";

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
    position: si(s.clt),
    points: si(s.pts),
    joue: si(s.joue),
    victoires: si(s.vic),
    defaites: si(s.def),
    nuls: si(s.nul),
    parties_gagnees: si(s.pg),
    parties_perdues: si(s.pp),
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
    const score_a = safeIntOrNull(match.scoreA);
    const score_b = safeIntOrNull(match.scoreB);
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

  // Deduplicate: FFTT API can return duplicate matches for some poules
  const seen = new Set<string>();
  const dedupedRows = rows.filter((r) => {
    const key = `${r.equipe_a}|${r.equipe_b}|${r.date_prevue}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

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
      score_a: si(partie.scorea),
      score_b: si(partie.scoreb),
      detail_sets: partie.detail,
    }));

    await db.insert(parties_rencontre).values(partyRows);
  }
}
