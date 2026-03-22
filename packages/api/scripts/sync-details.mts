import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema.js";
import { syncDetailsRencontres } from "../src/sync/sync-rencontres.js";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });
const config = {
  appId: process.env.FFTT_APP_ID!,
  password: process.env.FFTT_PASSWORD!,
  serie: process.env.FFTT_SERIE!,
  clubNumero: "08940073",
  clubNom: "FONTENAYSIENNE",
};

async function run() {
  const equipes = await db.select().from(schema.equipes);
  console.log(`Syncing details for ${equipes.length} equipes...`);
  for (const eq of equipes) {
    try {
      await syncDetailsRencontres(db, eq.id, config);
    } catch (e) {
      console.error(`Error for ${eq.lib_equipe}:`, e);
    }
  }
  console.log("Done");
  await client.end();
}

run();
