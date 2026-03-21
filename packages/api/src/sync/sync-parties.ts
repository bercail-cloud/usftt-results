import { getPartieMysql } from "../fftt/endpoints.js";
import { joueurs, parties_individuelles } from "../db/schema.js";
import { sql } from "drizzle-orm";
import type { FfttConfig, SyncDb } from "./sync-equipes.js";

export async function syncParties(db: SyncDb, ffttConfig: FfttConfig): Promise<number> {
  const { appId, serie, password } = ffttConfig;

  const joueursInDb: Array<{ licence: string }> = await db
    .select({ licence: joueurs.licence })
    .from(joueurs);

  if (joueursInDb.length === 0) {
    return 0;
  }

  let totalCount = 0;

  for (const joueur of joueursInDb) {
    const parties = await getPartieMysql(joueur.licence, appId, serie, password);

    if (parties.length === 0) {
      continue;
    }

    const rows = parties.map((partie) => ({
      licence: partie.licence,
      adversaire_licence: partie.advlic,
      adversaire_nom: partie.advnompre,
      adversaire_classement: parseInt(partie.advclaof, 10),
      victoire: partie.vd === "V",
      points_resultat: parseFloat(partie.pointres),
      coefficient: parseFloat(partie.coefchamp),
      date_partie: partie.date,
      epreuve: partie.codechamp,
      journee: parseInt(partie.numjourn, 10),
    }));

    const upserted = await db
      .insert(parties_individuelles)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          parties_individuelles.licence,
          parties_individuelles.adversaire_licence,
          parties_individuelles.date_partie,
          parties_individuelles.journee,
        ],
        set: {
          adversaire_nom: sql`excluded.adversaire_nom`,
          adversaire_classement: sql`excluded.adversaire_classement`,
          victoire: sql`excluded.victoire`,
          points_resultat: sql`excluded.points_resultat`,
          coefficient: sql`excluded.coefficient`,
          epreuve: sql`excluded.epreuve`,
        },
      })
      .returning();

    totalCount += upserted.length;
  }

  return totalCount;
}
