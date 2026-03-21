import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);
await migrate(db, { migrationsFolder: "./packages/api/src/db/migrations" });
await client.end();
console.log("Migrations complete");
