import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema.js";
import { syncEquipes } from "../src/sync/sync-equipes.js";
import { syncClassementsPoule, syncRencontres } from "../src/sync/sync-rencontres.js";
import { syncJoueurs } from "../src/sync/sync-joueurs.js";
import { syncParties } from "../src/sync/sync-parties.js";
import { syncHistorique } from "../src/sync/sync-historique.js";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const config = {
  appId: process.env.FFTT_APP_ID!,
  password: process.env.FFTT_PASSWORD!,
  serie: process.env.FFTT_SERIE!,
  clubNumero: process.env.CLUB_NUMERO ?? "08940073",
  clubNom: "",
  organismeId: "",
};

const arg = process.argv[2];

async function run() {
  try {
    if (!arg || arg === "all" || arg === "equipes") {
      console.log("Syncing equipes...");
      const equipes = await syncEquipes(db, config);
      console.log(`Equipes synced: ${equipes.length}`);
    }

    if (!arg || arg === "all" || arg === "joueurs") {
      console.log("Syncing joueurs...");
      const count = await syncJoueurs(db, config);
      console.log(`Joueurs synced: ${count}`);
    }

    if (!arg || arg === "all" || arg === "historique") {
      console.log("Syncing historique...");
      const h = await syncHistorique(db, config);
      console.log(`Historique synced: ${h}`);
    }

    if (!arg || arg === "all" || arg === "parties") {
      console.log("Syncing parties (715 joueurs, takes a while)...");
      const p = await syncParties(db, config);
      console.log(`Parties synced: ${p}`);
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
  await client.end();
}

run();
