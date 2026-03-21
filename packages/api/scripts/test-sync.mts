import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema.js";
import { syncEquipes } from "../src/sync/sync-equipes.js";
import { syncClassementsPoule, syncRencontres } from "../src/sync/sync-rencontres.js";
import { syncJoueurs } from "../src/sync/sync-joueurs.js";
import { syncParties } from "../src/sync/sync-parties.js";

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

async function run() {
  try {
    console.log("Syncing equipes...");
    const equipes = await syncEquipes(db, config);
    console.log(`Equipes synced: ${equipes.length}`);

    console.log("Syncing joueurs...");
    const count = await syncJoueurs(db, config);
    console.log(`Joueurs synced: ${count}`);

    for (const equipe of equipes.slice(0, 2)) {
      console.log(`Syncing classements for ${equipe.lib_equipe}...`);
      try {
        await syncClassementsPoule(db, equipe, config);
        console.log("  Classements OK");
      } catch (e) {
        console.error("  Classements ERROR:", e);
      }

      console.log(`Syncing rencontres for ${equipe.lib_equipe}...`);
      try {
        await syncRencontres(db, equipe, config);
        console.log("  Rencontres OK");
      } catch (e) {
        console.error("  Rencontres ERROR:", e);
      }
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
  await client.end();
}

run();
