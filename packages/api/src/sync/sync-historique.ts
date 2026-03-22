import { getHistoClassement } from "../fftt/endpoints.js";
import { joueurs, historique_classement } from "../db/schema.js";
import { sql } from "drizzle-orm";
import type { FfttConfig, SyncDb } from "./sync-equipes.js";

export async function syncHistorique(db: SyncDb, ffttConfig: FfttConfig): Promise<number> {
  const { appId, serie, password } = ffttConfig;

  // Only sync historique for active players (licence T or A)
  const joueursInDb: Array<{ licence: string }> = await db
    .select({ licence: joueurs.licence })
    .from(joueurs)
    .where(sql`${joueurs.type_licence} IN ('T', 'A')`);

  if (joueursInDb.length === 0) {
    return 0;
  }

  let totalCount = 0;

  for (const joueur of joueursInDb) {
    const historique = await getHistoClassement(joueur.licence, appId, serie, password);

    if (historique.length === 0) {
      continue;
    }

    const rows = historique.map((histo) => ({
      licence: joueur.licence,
      saison: histo.saison,
      phase: parseInt(histo.phase, 10),
      points: parseInt(histo.point, 10),
    }));

    const inserted = await db
      .insert(historique_classement)
      .values(rows)
      .onConflictDoNothing()
      .returning();

    totalCount += inserted.length;
  }

  return totalCount;
}
