import { getEquipes } from "../fftt/endpoints.js";
import { equipes } from "../db/schema.js";
import { sql } from "drizzle-orm";

export interface FfttConfig {
  appId: string;
  serie: string;
  password: string;
  clubNumero: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SyncDb = any;

export async function syncEquipes(
  db: SyncDb,
  ffttConfig: FfttConfig
): Promise<unknown[]> {
  const { appId, serie, password, clubNumero } = ffttConfig;

  const equipesFromApi = await getEquipes(clubNumero, appId, serie, password);

  if (equipesFromApi.length === 0) {
    return [];
  }

  const rows = equipesFromApi.map((equipe) => {
    const params = new URLSearchParams(equipe.lienDivision);
    const idPoule = params.get("cx_poule") ?? "";
    const idDivision = params.get("D1") ?? "";

    return {
      libEquipe: equipe.libEquipe,
      libDivision: equipe.libDivision,
      idPoule,
      idDivision,
      idEpreuve: equipe.idEpreuve,
      libEpreuve: equipe.libEpreuve,
      typeEpreuve: "equipe",
    };
  });

  const upserted = await db
    .insert(equipes)
    .values(rows)
    .onConflictDoUpdate({
      target: [equipes.lib_equipe, equipes.id_epreuve],
      set: {
        libDivision: sql`excluded.lib_division`,
        idPoule: sql`excluded.id_poule`,
        idDivision: sql`excluded.id_division`,
        libEpreuve: sql`excluded.lib_epreuve`,
        typeEpreuve: sql`excluded.type_epreuve`,
        updatedAt: sql`now()`,
      },
    }).returning();

  return upserted;
}
