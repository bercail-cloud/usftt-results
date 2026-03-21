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

  // Deduplicate by lib_equipe + id_epreuve (API can return duplicates for Phase 1/2)
  const seen = new Set<string>();
  const dedupedEquipes = equipesFromApi.filter((equipe) => {
    const key = `${equipe.libEquipe}|${equipe.idEpreuve}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const rows = dedupedEquipes.map((equipe) => {
    const params = new URLSearchParams(equipe.lienDivision);
    const id_poule = params.get("cx_poule") ?? "";
    const id_division = params.get("D1") ?? "";

    return {
      lib_equipe: equipe.libEquipe,
      lib_division: equipe.libDivision,
      id_poule,
      id_division,
      id_epreuve: equipe.idEpreuve,
      lib_epreuve: equipe.libEpreuve,
      type_epreuve: "equipe",
    };
  });

  const upserted = await db
    .insert(equipes)
    .values(rows)
    .onConflictDoUpdate({
      target: [equipes.lib_equipe, equipes.id_epreuve],
      set: {
        lib_division: sql`excluded.lib_division`,
        id_poule: sql`excluded.id_poule`,
        id_division: sql`excluded.id_division`,
        lib_epreuve: sql`excluded.lib_epreuve`,
        type_epreuve: sql`excluded.type_epreuve`,
        updated_at: sql`now()`,
      },
    }).returning();

  return upserted;
}
