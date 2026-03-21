import { getLicenceB } from "../fftt/endpoints.js";
import { joueurs } from "../db/schema.js";
import { sql } from "drizzle-orm";
import type { FfttConfig, SyncDb } from "./sync-equipes.js";

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
    points_officiels: parseInt(player.point, 10),
    points_mensuels: parseInt(player.pointm, 10),
    categorie: player.cat,
    sexe: player.sexe,
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
        categorie: sql`excluded.categorie`,
        sexe: sql`excluded.sexe`,
        updated_at: sql`now()`,
      },
    })
    .returning();

  return upserted.length;
}
