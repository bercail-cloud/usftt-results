import { getEpreuves, getDivisions, getResCla } from "../fftt/endpoints.js";
import { criterium_classement, joueurs } from "../db/schema.js";
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

function parseClassement(clt: string): number {
  if (!clt) return 0;
  const parts = clt.split(" - ");
  const numStr = parts.length > 1 ? parts[parts.length - 1] : clt;
  const n = parseInt(numStr!, 10);
  return Number.isNaN(n) ? 0 : n;
}

function deriveTourFromLibelle(libelle: string): number {
  const match = libelle.match(/[Tt]our\s*(\d+)/i);
  return match && match[1] ? parseInt(match[1]!, 10) : 0;
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
  const joueursInDb: Array<{ licence: string; nom: string }> = await db
    .select({ licence: joueurs.licence, nom: joueurs.nom })
    .from(joueurs);

  // Build lookup by full name "NOM Prenom" (criterium API returns this format)
  // Use full name to distinguish siblings (e.g., SOLARI Ilan vs SOLARI Eva)
  const joueursByFullName = new Map(
    joueursInDb.map((j) => [j.nom.toUpperCase(), j.licence])
  );
  // Also build by "NOM Prenom" from joueurs table
  const joueursAll: Array<{ licence: string; nom: string; prenom: string }> = await db
    .select({ licence: joueurs.licence, nom: joueurs.nom, prenom: joueurs.prenom })
    .from(joueurs);
  const joueursByNomPrenom = new Map(
    joueursAll.map((j) => [`${j.nom} ${j.prenom}`.toUpperCase(), j.licence])
  );

  function findLicence(fullName: string): string | null {
    const upper = fullName.toUpperCase().trim();
    // Try "NOM Prenom" exact match first (handles siblings)
    if (joueursByNomPrenom.has(upper)) return joueursByNomPrenom.get(upper)!;
    // Fallback: try last name only (less precise but catches accented names)
    const lastName = upper.split(" ")[0];
    if (lastName && joueursByFullName.has(lastName)) return joueursByFullName.get(lastName)!;
    return null;
  }

  let totalCount = 0;

  for (const orgId of organismeIds) {
    console.log(`Fetching criterium epreuves for organisme ${orgId}...`);

    let allEpreuves;
    try {
      allEpreuves = await getEpreuves(orgId, "I", appId, serie, password);
    } catch (e) {
      console.error(`Failed to fetch epreuves for organisme ${orgId}:`, e);
      continue;
    }

    const criteriumEpreuves = allEpreuves.filter(
      (e) => e.typepreuve === "C"
    );

    console.log(`  Found ${criteriumEpreuves.length} criterium epreuves`);

    for (const epreuve of criteriumEpreuves) {
      const tour = deriveTourFromLibelle(epreuve.libelle);

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
        console.error(`  Failed to fetch divisions for ${epreuve.libelle}:`, e);
        continue;
      }

      for (const division of divisions) {
        let standings;
        try {
          standings = await getResCla(
            { res_division: division.iddivision },
            appId,
            serie,
            password
          );
        } catch (e) {
          console.error(`  Failed to fetch standings for ${division.libelle}:`, e);
          continue;
        }

        if (standings.length === 0) {
          continue;
        }

        // Check if any USFTT player is in this division
        const hasClubPlayer = standings.some(
          (s) =>
            findLicence(s.nom) !== null ||
            (clubNom && s.club.toUpperCase().includes(clubNom.toUpperCase()))
        );

        if (!hasClubPlayer) {
          continue;
        }

        const rows = standings.map((s) => {
          const licence = findLicence(s.nom);

          return {
            division_id: division.iddivision,
            division_libelle: division.libelle,
            rang: si(s.rang),
            licence,
            nom: s.nom,
            club: s.club,
            classement: parseClassement(String(s.clt ?? "")),
            points: si(s.points),
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
  }

  console.log(`Criterium sync complete: ${totalCount} rows`);
  return totalCount;
}
