import { getEpreuves, getDivisions, getResCla } from "../fftt/endpoints.js";
import { criterium_classement, joueurs } from "../db/schema.js";
import { sql } from "drizzle-orm";
import type { FfttConfig, SyncDb } from "./sync-equipes.js";

export interface CriteriumFfttConfig extends FfttConfig {
  clubNom: string;
  organismeId: string;
}

function deriveTourFromLibelle(libelle: string): number {
  const match = libelle.match(/Tour\s+(\d+)/i);
  return match && match[1] ? parseInt(match[1], 10) : 0;
}

export async function syncCriterium(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): Promise<number> {
  const { appId, serie, password, organismeId } = ffttConfig;

  const allEpreuves = await getEpreuves(organismeId, "I", appId, serie, password);

  const criteriumEpreuves = allEpreuves.filter(
    (e) => e.typepreuve === "C"
  );

  if (criteriumEpreuves.length === 0) {
    return 0;
  }

  const joueursInDb: Array<{ licence: string; nom: string }> = await db
    .select({ licence: joueurs.licence, nom: joueurs.nom })
    .from(joueurs);

  const joueursByNom = new Map(
    joueursInDb.map((j) => [j.nom.toUpperCase(), j.licence])
  );

  let totalCount = 0;

  for (const epreuve of criteriumEpreuves) {
    const tour = deriveTourFromLibelle(epreuve.libelle);

    const divisions = await getDivisions(
      organismeId,
      epreuve.idepreuve,
      "I",
      appId,
      serie,
      password
    );

    for (const division of divisions) {
      const standings = await getResCla(
        { res_division: division.iddivision },
        appId,
        serie,
        password
      );

      if (standings.length === 0) {
        continue;
      }

      const rows = standings.map((s) => {
        const nomUpper = s.nom.toUpperCase();
        const licence = joueursByNom.get(nomUpper) ?? null;

        return {
          division_id: division.iddivision,
          division_libelle: division.libelle,
          rang: parseInt(s.rang, 10),
          licence,
          nom: s.nom,
          club: s.club,
          classement: parseInt(s.clt, 10),
          points: parseInt(s.points, 10),
          tour,
        };
      });

      const upserted = await db
        .insert(criterium_classement)
        .values(rows)
        .onConflictDoUpdate({
          target: [
            criterium_classement.division_id,
            criterium_classement.nom,
            criterium_classement.tour,
          ],
          set: {
            division_libelle: sql`excluded.division_libelle`,
            rang: sql`excluded.rang`,
            licence: sql`excluded.licence`,
            club: sql`excluded.club`,
            classement: sql`excluded.classement`,
            points: sql`excluded.points`,
            updated_at: sql`now()`,
          },
        })
        .returning();

      totalCount += upserted.length;
    }
  }

  return totalCount;
}
