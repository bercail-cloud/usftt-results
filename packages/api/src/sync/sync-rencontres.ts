import { eq, and, isNotNull } from "drizzle-orm";
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
    club_numero: s.idclub,
    nom_equipe: s.equipe,
    position: parseInt(s.clt, 10),
    points: parseInt(s.pts, 10),
    joue: parseInt(s.joue, 10),
    victoires: parseInt(s.vic, 10),
    defaites: parseInt(s.def, 10),
    nuls: parseInt(s.nul, 10),
    parties_gagnees: parseInt(s.pg, 10),
    parties_perdues: parseInt(s.pp, 10),
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
    const score_a = match.scoreA !== "" ? parseInt(match.scoreA, 10) : null;
    const score_b = match.scoreB !== "" ? parseInt(match.scoreB, 10) : null;
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

  const upserted = await db
    .insert(rencontres)
    .values(rows)
    .onConflictDoUpdate({
      target: [rencontres.equipe_id, rencontres.libelle],
      set: {
        equipe_a: rows[0]!.equipe_a,
        equipe_b: rows[0]!.equipe_b,
        score_a: rows[0]!.score_a,
        score_b: rows[0]!.score_b,
        date_reelle: rows[0]!.date_reelle,
        lien_detail: rows[0]!.lien_detail,
        is_domicile: rows[0]!.is_domicile,
      },
    })
    .returning();

  return upserted;
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

    if (chpRenc.parties.length === 0) {
      continue;
    }

    const joueurMap = new Map(
      chpRenc.joueurs.map((j) => [j.xja, { classement_a: j.xca, classement_b: j.xcb }])
    );

    const partyRows = chpRenc.parties.map((partie) => {
      const joueurInfo = joueurMap.get(partie.ja);
      return {
        rencontre_id: rencontre.id,
        joueur_a: partie.ja,
        classement_a: joueurInfo?.classement_a ?? "",
        joueur_b: partie.jb,
        classement_b: joueurInfo?.classement_b ?? "",
        score_a: parseInt(partie.scorea, 10),
        score_b: parseInt(partie.scoreb, 10),
        detail_sets: partie.detail,
      };
    });

    await db.insert(parties_rencontre).values(partyRows);
  }
}
