import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createSystemRoutes } from "./routes/system.js";
import { equipesRoutes } from "./routes/equipes.js";
import { criteriumRoutes } from "./routes/criterium.js";
import { joueursRoutes } from "./routes/joueurs.js";
import { startScheduler } from "./sync/scheduler.js";
import { db } from "./db/connection.js";
import type { CriteriumFfttConfig } from "./sync/sync-criterium.js";

// Build FFTT config from env
const hasEnvVars =
  process.env.FFTT_APP_ID &&
  process.env.FFTT_PASSWORD &&
  process.env.FFTT_SERIE &&
  process.env.DATABASE_URL;

const ffttConfig: CriteriumFfttConfig | null = hasEnvVars
  ? {
      appId: process.env.FFTT_APP_ID!,
      password: process.env.FFTT_PASSWORD!,
      serie: process.env.FFTT_SERIE!,
      clubNumero: process.env.CLUB_NUMERO ?? "08940073",
      clubNom: process.env.CLUB_NOM ?? "",
      organismeId: process.env.ORGANISME_ID ?? "",
    }
  : null;

const app = new Hono();

app.use("/*", cors());

app.route("/api", createSystemRoutes(ffttConfig));
app.route("/api", equipesRoutes);
app.route("/api", criteriumRoutes);
app.route("/api", joueursRoutes);

const port = parseInt(process.env.PORT ?? "3010", 10);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API server running on port ${port}`);
});

if (ffttConfig) {
  startScheduler(db, ffttConfig);
}
