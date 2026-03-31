import { getPartieMysql, getPartieSpid } from "../fftt/endpoints.js";
import { joueurs, parties_individuelles } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import type { FfttConfig, SyncDb } from "./sync-equipes.js";

/**
 * FFTT official points table (coefficient = 1)
 * Source: https://cauxtt.fr/comprendre-calcul-classement-points-fftt-tennis-de-table/
 *
 * Ecart = abs(classement_joueur - classement_adversaire)
 * "Normal" = expected result (stronger wins or weaker loses)
 * "Upset"  = unexpected result (weaker wins or stronger loses)
 *
 * | Ecart     | V normal | D normal | V upset | D upset |
 * |-----------|----------|----------|---------|---------|
 * | 0-24      | +6       | -5       | +6      | -5      |
 * | 25-49     | +5.5     | -4.5     | +7      | -6      |
 * | 50-99     | +5       | -4       | +8      | -7      |
 * | 100-149   | +4       | -3       | +10     | -8      |
 * | 150-199   | +3       | -2       | +13     | -10     |
 * | 200-299   | +2       | -1       | +17     | -12.5   |
 * | 300-399   | +1       | -0.5     | +22     | -16     |
 * | 400-499   | +0.5     | 0        | +28     | -20     |
 * | 500+      | 0        | 0        | +40     | -29     |
 */
const FFTT_TABLE: Array<{ maxEcart: number; vNormal: number; dNormal: number; vUpset: number; dUpset: number }> = [
  { maxEcart: 24,  vNormal: 6,   dNormal: -5,    vUpset: 6,   dUpset: -5 },
  { maxEcart: 49,  vNormal: 5.5, dNormal: -4.5,  vUpset: 7,   dUpset: -6 },
  { maxEcart: 99,  vNormal: 5,   dNormal: -4,    vUpset: 8,   dUpset: -7 },
  { maxEcart: 149, vNormal: 4,   dNormal: -3,    vUpset: 10,  dUpset: -8 },
  { maxEcart: 199, vNormal: 3,   dNormal: -2,    vUpset: 13,  dUpset: -10 },
  { maxEcart: 299, vNormal: 2,   dNormal: -1,    vUpset: 17,  dUpset: -12.5 },
  { maxEcart: 399, vNormal: 1,   dNormal: -0.5,  vUpset: 22,  dUpset: -16 },
  { maxEcart: 499, vNormal: 0.5, dNormal: 0,     vUpset: 28,  dUpset: -20 },
  { maxEcart: Infinity, vNormal: 0, dNormal: 0,   vUpset: 40,  dUpset: -29 },
];

export function estimatePoints(
  playerClassement: number,
  adversaireClassement: number,
  victoire: boolean,
  coefficient: number,
  forfait: boolean = false
): number {
  if (forfait) return 0;

  const pClt = playerClassement < 50 ? playerClassement * 100 : playerClassement;
  const aClt = adversaireClassement < 50 ? adversaireClassement * 100 : adversaireClassement;

  const ecart = Math.abs(pClt - aClt);
  const playerIsStronger = pClt >= aClt;

  const row = FFTT_TABLE.find((r) => ecart <= r.maxEcart)!;

  let base: number;
  if (victoire) {
    base = playerIsStronger ? row.vNormal : row.vUpset;
  } else {
    base = playerIsStronger ? row.dUpset : row.dNormal;
  }

  return Math.round(base * coefficient * 10) / 10;
}

/**
 * Parse SPID classement field.
 * Formats: "N718 - 2130" (rank - points), "1999" (just points)
 */
export function parseSpidClassement(raw: string): { points: number; rang: string | null } {
  if (!raw) return { points: 0, rang: null };
  const dashIdx = raw.lastIndexOf(" - ");
  if (dashIdx >= 0) {
    const rangPart = raw.slice(0, dashIdx).trim();
    const n = parseInt(raw.slice(dashIdx + 3), 10);
    return { points: Number.isNaN(n) ? 0 : n, rang: rangPart || null };
  }
  const n = parseInt(raw, 10);
  return { points: Number.isNaN(n) ? 0 : n, rang: null };
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

async function getActiveJoueurs(db: SyncDb) {
  return db
    .select({ licence: joueurs.licence, points_mensuels: joueurs.points_mensuels })
    .from(joueurs)
    .where(sql`${joueurs.type_licence} IN ('T', 'A')`);
}

/**
 * Sync parties from mysql source (xml_partie_mysql).
 * Updated monthly (between 12th and 20th).
 */
export async function syncPartiesMysql(db: SyncDb, ffttConfig: FfttConfig): Promise<number> {
  const { appId, serie, password } = ffttConfig;
  const joueursInDb = await getActiveJoueurs(db);

  if (joueursInDb.length === 0) return 0;

  let totalCount = 0;

  for (const joueur of joueursInDb) {
    const parties = await getPartieMysql(joueur.licence, appId, serie, password);
    if (parties.length === 0) continue;

    const rows = parties.map((partie) => {
      const clt = partie.advclaof || "";
      // Parse "N352" (ranked player) or "1073" (points)
      const nMatch = clt.match(/^N(\d+)/);
      const advClassement = nMatch ? 0 : safeInt(clt);
      const advRang = nMatch ? `N${nMatch[1]}` : null;

      return {
      licence: partie.licence,
      adversaire_licence: partie.advlic || "",
      adversaire_nom: partie.advnompre || "",
      adversaire_classement: advClassement,
      adversaire_rang: advRang,
      victoire: partie.vd === "V",
      points_resultat: safeFloat(partie.pointres),
      coefficient: safeFloat(partie.coefchamp),
      date_partie: partie.date || "",
      epreuve: partie.codechamp || "",
      epreuve_libelle: null as string | null,
      id_partie: partie.idpartie || null,
      journee: safeInt(partie.numjourn),
      forfait: false,
    };
    });

    await db
      .delete(parties_individuelles)
      .where(eq(parties_individuelles.licence, joueur.licence));

    await db.insert(parties_individuelles).values(rows);
    totalCount += rows.length;
  }

  return totalCount;
}

/**
 * Sync parties from SPID source (xml_partie).
 * Can be updated at any time. Enriches existing mysql rows and adds SPID-only matches.
 */
export async function syncPartiesSpid(db: SyncDb, ffttConfig: FfttConfig): Promise<number> {
  const { appId, serie, password } = ffttConfig;
  const joueursInDb = await getActiveJoueurs(db);

  if (joueursInDb.length === 0) return 0;

  let totalCount = 0;

  for (const joueur of joueursInDb) {
    let spidParties;
    try {
      spidParties = await getPartieSpid(joueur.licence, appId, serie, password);
    } catch {
      continue;
    }

    if (spidParties.length === 0) continue;

    // Get existing mysql-sourced parties for this player
    const existingParties = await db
      .select({ id_partie: parties_individuelles.id_partie })
      .from(parties_individuelles)
      .where(eq(parties_individuelles.licence, joueur.licence));

    const existingIdParties = new Set(
      existingParties.map((p: { id_partie: string | null }) => p.id_partie).filter(Boolean)
    );

    // Enrich existing rows with SPID data (epreuve_libelle, adversaire_rang)
    for (const sp of spidParties) {
      if (!sp.idpartie || !existingIdParties.has(sp.idpartie)) continue;

      const parsed = parseSpidClassement(sp.classement);
      await db
        .update(parties_individuelles)
        .set({
          epreuve_libelle: sp.epreuve || null,
          adversaire_rang: parsed.rang,
          forfait: sp.forfait === "1",
        })
        .where(
          sql`${parties_individuelles.licence} = ${joueur.licence} AND ${parties_individuelles.id_partie} = ${sp.idpartie}`
        );
    }

    // Add SPID-only matches (not yet in mysql)
    const playerClt = joueur.points_mensuels ?? 500;

    const spidOnlyRows = spidParties
      .filter((sp) => sp.idpartie && !existingIdParties.has(sp.idpartie))
      .map((sp) => {
        const victoire = sp.victoire === "V";
        const parsed = parseSpidClassement(sp.classement);
        const coef = safeFloat(sp.coefchamp);
        const isForfait = sp.forfait === "1";
        const estimated = estimatePoints(playerClt, parsed.points, victoire, coef, isForfait);

        return {
          licence: joueur.licence,
          adversaire_licence: "",
          adversaire_nom: sp.nom || "",
          adversaire_classement: parsed.points,
          adversaire_rang: parsed.rang,
          victoire,
          points_resultat: estimated,
          coefficient: coef,
          date_partie: sp.date || "",
          epreuve: "",
          epreuve_libelle: sp.epreuve || null,
          id_partie: sp.idpartie || null,
          journee: 0,
          forfait: isForfait,
        };
      });

    if (spidOnlyRows.length > 0) {
      await db.insert(parties_individuelles).values(spidOnlyRows);
    }

    totalCount += spidOnlyRows.length;
  }

  return totalCount;
}
