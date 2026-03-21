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
    clubNumero: player.numclub,
    pointsOfficiels: parseInt(player.point, 10),
    pointsMensuels: parseInt(player.pointm, 10),
    categorie: player.cat,
    sexe: player.sexe,
    rangDepartemental: null,
    rangRegional: null,
  }));

  const upserted = await db
    .insert(joueurs)
    .values(rows)
    .onConflictDoUpdate({
      target: [joueurs.licence],
      set: {
        nom: sql`excluded.nom`,
        prenom: sql`excluded.prenom`,
        clubNumero: sql`excluded.club_numero`,
        pointsOfficiels: sql`excluded.points_officiels`,
        pointsMensuels: sql`excluded.points_mensuels`,
        categorie: sql`excluded.categorie`,
        sexe: sql`excluded.sexe`,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  return upserted.length;
}
