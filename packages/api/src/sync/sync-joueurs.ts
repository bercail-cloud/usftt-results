import { getLicenceB } from "../fftt/endpoints.js";
import { joueurs } from "../db/schema.js";
import { sql } from "drizzle-orm";
import type { FfttConfig, SyncDb } from "./sync-equipes.js";
import { safeIntOrNull as safeInt, safeFloatOrNull as safeFloat } from "./parsers.js";

export async function syncJoueurs(db: SyncDb, ffttConfig: FfttConfig): Promise<number> {
  const { appId, serie, password, clubNumero } = ffttConfig;

  const players = await getLicenceB({ club: clubNumero }, appId, serie, password);

  if (players.length === 0) {
    return 0;
  }

  const rows = players.map((player) => ({
    licence: player.licence,
    nom: player.nom,
    prenom: player.prenom,
    club_numero: player.numclub,
    points_officiels: safeInt(player.point),
    points_mensuels: safeFloat(player.pointm),
    ancien_points_mensuels: safeFloat(player.apointm),
    points_initm: safeFloat(player.initm),
    categorie: player.cat || null,
    type_licence: player.type || null,
    sexe: player.sexe || "M",
    rang_departemental: null,
    rang_regional: null,
  }));

  const upserted = await db
    .insert(joueurs)
    .values(rows)
    .onConflictDoUpdate({
      target: [joueurs.licence],
      set: {
        nom: sql`excluded.nom`,
        prenom: sql`excluded.prenom`,
        club_numero: sql`excluded.club_numero`,
        points_officiels: sql`excluded.points_officiels`,
        points_mensuels: sql`excluded.points_mensuels`,
        ancien_points_mensuels: sql`excluded.ancien_points_mensuels`,
        points_initm: sql`excluded.points_initm`,
        categorie: sql`excluded.categorie`,
        type_licence: sql`excluded.type_licence`,
        sexe: sql`excluded.sexe`,
        updated_at: sql`now()`,
      },
    })
    .returning();

  return upserted.length;
}
