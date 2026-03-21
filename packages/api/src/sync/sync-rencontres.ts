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
  libEquipe: string;
  idDivision: string;
  idPoule: string;
}

export async function syncClassementsPoule(
  db: SyncDb,
  equipe: EquipeRow,
  ffttConfig: FfttConfig
): Promise<void> {
  const { appId, serie, password } = ffttConfig;

  const standings = await getResultEquClassement(
    equipe.idDivision,
    equipe.idPoule,
    appId,
    serie,
    password
  );

  await db.delete(classements_poule).where(eq(classements_poule.equipe_id, equipe.id));

  if (standings.length === 0) {
    return;
  }

  const rows = standings.map((s) => ({
    equipeId: equipe.id,
    clubNumero: s.idclub,
    nomEquipe: s.equipe,
    position: parseInt(s.clt, 10),
    points: parseInt(s.pts, 10),
    joue: parseInt(s.joue, 10),
    victoires: parseInt(s.vic, 10),
    defaites: parseInt(s.def, 10),
    nuls: parseInt(s.nul, 10),
    partiesGagnees: parseInt(s.pg, 10),
    partiesPerdues: parseInt(s.pp, 10),
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
    equipe.idDivision,
    equipe.idPoule,
    appId,
    serie,
    password
  );

  if (matches.length === 0) {
    return [];
  }

  const rows = matches.map((match) => {
    const isDomicile = match.equipeA.includes(equipe.libEquipe);
    const scoreA = match.scoreA !== "" ? parseInt(match.scoreA, 10) : null;
    const scoreB = match.scoreB !== "" ? parseInt(match.scoreB, 10) : null;
    const lienDetail = match.lien !== "" ? match.lien : null;

    return {
      equipeId: equipe.id,
      libelle: match.libelle,
      equipeA: match.equipeA,
      equipeB: match.equipeB,
      scoreA,
      scoreB,
      datePrevue: match.datePrevue,
      dateReelle: match.dateReelle,
      lienDetail,
      isDomicile,
    };
  });

  const upserted = await db
    .insert(rencontres)
    .values(rows)
    .onConflictDoUpdate({
      target: [rencontres.equipe_id, rencontres.libelle],
      set: {
        equipe_a: rows[0]!.equipeA,
        equipe_b: rows[0]!.equipeB,
        score_a: rows[0]!.scoreA,
        score_b: rows[0]!.scoreB,
        date_reelle: rows[0]!.dateReelle,
        lien_detail: rows[0]!.lienDetail,
        is_domicile: rows[0]!.isDomicile,
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
    if (!rencontre.lienDetail) {
      continue;
    }

    const params = Object.fromEntries(
      new URLSearchParams(rencontre.lienDetail).entries()
    );

    const chpRenc = await getChpRenc(params, appId, serie, password);

    await db
      .delete(parties_rencontre)
      .where(eq(parties_rencontre.rencontre_id, rencontre.id));

    if (chpRenc.parties.length === 0) {
      continue;
    }

    const joueurMap = new Map(
      chpRenc.joueurs.map((j) => [j.xja, { classementA: j.xca, classementB: j.xcb }])
    );

    const partyRows = chpRenc.parties.map((partie) => {
      const joueurInfo = joueurMap.get(partie.ja);
      return {
        rencontreId: rencontre.id,
        joueurA: partie.ja,
        classementA: joueurInfo?.classementA ?? "",
        joueurB: partie.jb,
        classementB: joueurInfo?.classementB ?? "",
        scoreA: parseInt(partie.scorea, 10),
        scoreB: parseInt(partie.scoreb, 10),
        detailSets: partie.detail,
      };
    });

    await db.insert(parties_rencontre).values(partyRows);
  }
}
