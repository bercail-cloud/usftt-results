import {
  getEpreuves,
  getDivisions,
  getResultIndivPoules,
  getResultIndivClassement,
  getResultIndivParties,
} from "../fftt/endpoints.js";
import {
  criterium_tours,
  criterium_classement,
  criterium_parties,
  joueurs,
} from "../db/schema.js";
import { sql } from "drizzle-orm";
import type { FfttConfig, SyncDb } from "./sync-equipes.js";

export interface CriteriumFfttConfig extends FfttConfig {
  clubNom: string;
  organismeId: string;
}

function si(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : Math.floor(n);
}

function parseClassementFromClt(clt: string): number {
  if (!clt) return 0;
  const parts = clt.split(" - ");
  const numStr = parts.length > 1 ? parts[parts.length - 1] : clt;
  const n = parseInt(numStr!, 10);
  return Number.isNaN(n) ? 0 : n;
}

function parseTourAndGroupe(libelle: string): { tour: number; groupe: string } {
  const tourMatch = libelle.match(/T(\d+)/i);
  const groupeMatch = libelle.match(/(Gr\d+)/i);
  return {
    tour: tourMatch && tourMatch[1] ? parseInt(tourMatch[1], 10) : 0,
    groupe: groupeMatch && groupeMatch[1] ? groupeMatch[1] : "Gr1",
  };
}

function parseLienParams(lien: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of lien.split("&")) {
    const [key, value] = part.split("=");
    if (key && value) {
      params[key] = value;
    }
  }
  return params;
}

function niveauFromOrganisme(orgId: string): string {
  if (orgId === "1") return "National";
  if (orgId === "16") return "Regional";
  return "Departemental";
}

// Organismes to search for criterium epreuves:
// 1 = Federation (national), 16 = Ligue IDF (regional), departement from config
function getOrganismeIds(deptOrganismeId: string): string[] {
  const ids = ["1", "16"]; // Federal + Ligue IDF
  if (deptOrganismeId && !ids.includes(deptOrganismeId)) {
    ids.push(deptOrganismeId);
  }
  return ids;
}

export async function syncCriterium(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): Promise<number> {
  const { appId, serie, password, organismeId, clubNom } = ffttConfig;

  if (!organismeId) {
    console.log("Skipping criterium sync: organismeId not configured");
    return 0;
  }

  const organismeIds = getOrganismeIds(organismeId);

  // Fetch all joueurs for name matching
  const joueursAll: Array<{ licence: string; nom: string; prenom: string }> =
    await db
      .select({
        licence: joueurs.licence,
        nom: joueurs.nom,
        prenom: joueurs.prenom,
      })
      .from(joueurs);

  const joueursByFullName = new Map(
    joueursAll.map((j) => [j.nom.toUpperCase(), j.licence])
  );
  const joueursByNomPrenom = new Map(
    joueursAll.map((j) => [`${j.nom} ${j.prenom}`.toUpperCase(), j.licence])
  );

  function findLicence(fullName: string): string | null {
    const upper = fullName.toUpperCase().trim();
    if (joueursByNomPrenom.has(upper)) return joueursByNomPrenom.get(upper)!;
    const lastName = upper.split(" ")[0];
    if (lastName && joueursByFullName.has(lastName))
      return joueursByFullName.get(lastName)!;
    return null;
  }

  let totalCount = 0;

  for (const orgId of organismeIds) {
    console.log(`Fetching criterium epreuves for organisme ${orgId}...`);
    const niveau = niveauFromOrganisme(orgId);

    let allEpreuves;
    try {
      allEpreuves = await getEpreuves(orgId, "I", appId, serie, password);
    } catch (e) {
      console.error(
        `Failed to fetch epreuves for organisme ${orgId}:`,
        e
      );
      continue;
    }

    const criteriumEpreuves = allEpreuves.filter(
      (e) => e.typepreuve === "C"
    );

    // Only keep the most recent criterium federal epreuve per organisme
    // (highest idepreuve = most recent season)
    // Also filter: only keep epreuves that look like "Criterium" (not "Challenge", etc.)
    const federalCriteriums = criteriumEpreuves.filter(
      (e) =>
        e.libelle.toLowerCase().includes("crit") ||
        e.libelle.toLowerCase().includes("fédéral") ||
        e.libelle.toLowerCase().includes("federal")
    );

    // Take only the one with the highest idepreuve (most recent)
    const currentSeason =
      federalCriteriums.length > 0
        ? [
            federalCriteriums.reduce((best, e) =>
              parseInt(e.idepreuve, 10) > parseInt(best.idepreuve, 10) ? e : best
            ),
          ]
        : [];

    console.log(
      `  Found ${criteriumEpreuves.length} criterium epreuves, using ${currentSeason.length} (current season)`
    );

    const criteriumToSync = currentSeason;

    for (const epreuve of criteriumToSync) {
      let divisions;
      try {
        divisions = await getDivisions(
          orgId,
          epreuve.idepreuve,
          "I",
          appId,
          serie,
          password
        );
      } catch (e) {
        console.error(
          `  Failed to fetch divisions for ${epreuve.libelle}:`,
          e
        );
        continue;
      }

      for (const division of divisions) {
        let poules;
        try {
          poules = await getResultIndivPoules(
            epreuve.idepreuve,
            division.iddivision,
            appId,
            serie,
            password
          );
        } catch (e) {
          console.error(
            `  Failed to fetch poules for ${division.libelle}:`,
            e
          );
          continue;
        }

        if (poules.length === 0) continue;

        for (const poule of poules) {
          const lienParams = parseLienParams(poule.lien);
          const cxTableau = lienParams.cx_tableau ?? "";
          const epr = lienParams.epr ?? epreuve.idepreuve;
          const resDivision =
            lienParams.res_division ?? division.iddivision;
          const { tour, groupe } = parseTourAndGroupe(poule.libelle);

          // Fetch classement for this poule
          let standings;
          try {
            standings = await getResultIndivClassement(
              epr,
              resDivision,
              cxTableau,
              appId,
              serie,
              password
            );
          } catch (e) {
            console.error(
              `  Failed to fetch classement for ${poule.libelle}:`,
              e
            );
            continue;
          }

          if (standings.length === 0) continue;

          // Check if any USFTT player is in this group
          const hasClubPlayer = standings.some(
            (s) =>
              findLicence(s.nom) !== null ||
              (clubNom &&
                s.club.toUpperCase().includes(clubNom.toUpperCase()))
          );

          if (!hasClubPlayer) continue;

          // Upsert criterium_tours row
          const tourRows = await db
            .insert(criterium_tours)
            .values({
              epreuve_id: epreuve.idepreuve,
              epreuve_libelle: epreuve.libelle,
              division_id: division.iddivision,
              division_libelle: division.libelle,
              tour,
              groupe,
              cx_tableau: cxTableau,
              date_tour: poule.date,
              niveau,
            })
            .onConflictDoUpdate({
              target: [
                criterium_tours.division_id,
                criterium_tours.cx_tableau,
              ],
              set: {
                epreuve_id: sql`excluded.epreuve_id`,
                epreuve_libelle: sql`excluded.epreuve_libelle`,
                division_libelle: sql`excluded.division_libelle`,
                tour: sql`excluded.tour`,
                groupe: sql`excluded.groupe`,
                date_tour: sql`excluded.date_tour`,
                niveau: sql`excluded.niveau`,
                updated_at: sql`now()`,
              },
            })
            .returning();

          const tourId = tourRows[0]!.id;

          // Upsert classement rows (deduplicate by nom within same tour)
          const seenNoms = new Set<string>();
          const classementRows = standings
            .filter((s) => {
              if (seenNoms.has(s.nom)) return false;
              seenNoms.add(s.nom);
              return true;
            })
            .map((s) => ({
              criterium_tour_id: tourId,
              rang: si(s.rang),
              licence: findLicence(s.nom),
              nom: s.nom,
              club: s.club,
              classement: parseClassementFromClt(String(s.clt ?? "")),
              points: s.points,
            }));

          const upserted = await db
            .insert(criterium_classement)
            .values(classementRows)
            .onConflictDoUpdate({
              target: [
                criterium_classement.criterium_tour_id,
                criterium_classement.nom,
              ],
              set: {
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

          // Fetch and store parties
          let parties;
          try {
            parties = await getResultIndivParties(
              epr,
              resDivision,
              cxTableau,
              appId,
              serie,
              password
            );
          } catch (e) {
            console.error(
              `  Failed to fetch parties for ${poule.libelle}:`,
              e
            );
            continue;
          }

          if (parties.length > 0) {
            // Delete existing parties for this tour
            await db
              .delete(criterium_parties)
              .where(
                sql`${criterium_parties.criterium_tour_id} = ${tourId}`
              );

            const partieRows = parties.map((p) => ({
              criterium_tour_id: tourId,
              libelle: p.libelle,
              vainqueur: p.vain,
              perdant: p.perd,
              forfait: p.forfait,
            }));

            await db.insert(criterium_parties).values(partieRows);
          }
        }
      }
    }
  }

  console.log(`Criterium sync complete: ${totalCount} rows`);
  return totalCount;
}
