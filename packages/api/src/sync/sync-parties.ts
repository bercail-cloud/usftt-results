import { getPartieMysql } from "../fftt/endpoints.js";
import { joueurs, parties_individuelles } from "../db/schema.js";
import { sql } from "drizzle-orm";
import type { FfttConfig } from "./sync-equipes.js";

export async function syncParties(db: any, ffttConfig: FfttConfig): Promise<number> {
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
      adversaireLicence: partie.advlic,
      adversaireNom: partie.advnompre,
      adversaireClassement: parseInt(partie.advclaof, 10),
      victoire: partie.vd === "V",
      pointsResultat: parseFloat(partie.pointres),
      coefficient: parseFloat(partie.coefchamp),
      datePartie: partie.date,
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
          adversaireNom: sql`excluded.adversaire_nom`,
          adversaireClassement: sql`excluded.adversaire_classement`,
          victoire: sql`excluded.victoire`,
          pointsResultat: sql`excluded.points_resultat`,
          coefficient: sql`excluded.coefficient`,
          epreuve: sql`excluded.epreuve`,
        },
      })
      .returning();

    totalCount += upserted.length;
  }

  return totalCount;
}
