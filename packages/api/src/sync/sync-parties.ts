import { getPartieMysql, getPartieSpid } from "../fftt/endpoints.js";
import { joueurs, parties_individuelles } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import type { FfttConfig, SyncDb } from "./sync-equipes.js";

/**
 * Estimate points gained/lost using the FFTT formula.
 * Uses classement officiel (debut de phase).
 * The FFTT uses a step-based table where points depend on the
 * ecart (gap) between player and opponent in tranches of 25 pts.
 * Formula derived from observed FFTT results.
 */
function estimatePoints(
  playerClassement: number,
  adversaireClassement: number,
  victoire: boolean,
  coefficient: number,
  forfait: boolean = false
): number {
  if (forfait) return 0;

  // Ensure classements are in real points
  const pClt = playerClassement < 50 ? playerClassement * 100 : playerClassement;
  const aClt = adversaireClassement < 50 ? adversaireClassement * 100 : adversaireClassement;

  const ecart = aClt - pClt; // positive = adversaire plus fort

  // FFTT points table (approximate, per tranche of ~50pts)
  // Victory: gain depends on opponent strength relative to player
  // Defeat: loss depends on opponent weakness relative to player
  if (victoire) {
    let base: number;
    if (ecart >= 200) base = 40;
    else if (ecart >= 150) base = 20;
    else if (ecart >= 100) base = 10;
    else if (ecart >= 50) base = 7;
    else if (ecart >= 25) base = 6;
    else if (ecart >= 0) base = 5.5;
    else if (ecart >= -25) base = 5;
    else if (ecart >= -50) base = 4;
    else if (ecart >= -100) base = 3;
    else if (ecart >= -150) base = 2;
    else if (ecart >= -200) base = 1;
    else if (ecart >= -300) base = 0.5;
    else base = 0;
    return Math.round(base * coefficient * 10) / 10;
  } else {
    let base: number;
    if (ecart <= -200) base = -40;
    else if (ecart <= -150) base = -20;
    else if (ecart <= -100) base = -10;
    else if (ecart <= -50) base = -7;
    else if (ecart <= -25) base = -6;
    else if (ecart <= 0) base = -5.5;
    else if (ecart <= 25) base = -5;
    else if (ecart <= 50) base = -4;
    else if (ecart <= 100) base = -3;
    else if (ecart <= 150) base = -2;
    else if (ecart <= 200) base = -1;
    else if (ecart <= 300) base = -0.5;
    else base = 0;
    return Math.round(base * coefficient * 10) / 10;
  }
}

export async function syncParties(db: SyncDb, ffttConfig: FfttConfig): Promise<number> {
  const { appId, serie, password } = ffttConfig;

  // Only sync parties for active players (licence T or A)
  const joueursInDb: Array<{ licence: string; points_officiels: number | null }> = await db
    .select({ licence: joueurs.licence, points_officiels: joueurs.points_officiels })
    .from(joueurs)
    .where(sql`${joueurs.type_licence} IN ('T', 'A')`);

  if (joueursInDb.length === 0) {
    return 0;
  }

  const safeInt = (val: string | undefined): number => {
    if (!val) return 0;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? 0 : n;
  };
  const safeFloat = (val: string | undefined): number => {
    if (!val) return 0;
    const n = parseFloat(val);
    return Number.isNaN(n) ? 0 : n;
  };

  let totalCount = 0;

  for (const joueur of joueursInDb) {
    const parties = await getPartieMysql(joueur.licence, appId, serie, password);

    if (parties.length === 0) {
      continue;
    }

    // Get SPID parties for epreuve libelle + recent matches not yet in mysql
    let spidParties: Array<{ date: string; nom: string; classement: string; epreuve: string; victoire: string; forfait: string; idpartie: string; coefchamp: string }> = [];
    try {
      spidParties = await getPartieSpid(joueur.licence, appId, serie, password);
    } catch {
      // xml_partie may fail for some players, continue without
    }
    const spidEpreuveMap = new Map(
      spidParties.map((p) => [p.idpartie, p.epreuve])
    );

    const rows = parties.map((partie) => {
      const idPartie = partie.idpartie || "";
      const epreuveLibelle = spidEpreuveMap.get(idPartie) || null;

      return {
        licence: partie.licence,
        adversaire_licence: partie.advlic || "",
        adversaire_nom: partie.advnompre || "",
        adversaire_classement: safeInt(partie.advclaof),
        victoire: partie.vd === "V",
        points_resultat: safeFloat(partie.pointres),
        coefficient: safeFloat(partie.coefchamp),
        date_partie: partie.date || "",
        epreuve: partie.codechamp || "",
        epreuve_libelle: epreuveLibelle,
        id_partie: idPartie || null,
        journee: safeInt(partie.numjourn),
      };
    });

    // Add SPID-only matches (recent matches not yet in mysql)
    const mysqlIdParties = new Set(parties.map((p) => p.idpartie).filter(Boolean));

    const playerClt = joueur.points_officiels ?? 500;

    const spidOnlyRows = spidParties
      .filter((sp) => sp.idpartie && !mysqlIdParties.has(sp.idpartie))
      .map((sp) => {
        const victoire = sp.victoire === "V";
        const advClt = safeInt(sp.classement);
        const coef = safeFloat(sp.coefchamp);
        const isForfait = sp.forfait === "1";
        const estimated = estimatePoints(playerClt, advClt, victoire, coef, isForfait);

        return {
          licence: joueur.licence,
          adversaire_licence: "",
          adversaire_nom: sp.nom || "",
          adversaire_classement: advClt,
          victoire,
          points_resultat: estimated,
          coefficient: coef,
          date_partie: sp.date || "",
          epreuve: "", // No codechamp in SPID
          epreuve_libelle: sp.epreuve || null,
          id_partie: sp.idpartie || null,
          journee: 0,
        };
      });

    // Delete existing parties for this player, then re-insert all
    await db
      .delete(parties_individuelles)
      .where(eq(parties_individuelles.licence, joueur.licence));

    const allRows = [...rows, ...spidOnlyRows];
    if (allRows.length > 0) {
      await db.insert(parties_individuelles).values(allRows);
    }

    totalCount += allRows.length;
  }

  return totalCount;
}
