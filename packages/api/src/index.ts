import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { systemRoutes } from "./routes/system.js";
import { equipesRoutes } from "./routes/equipes.js";
import { criteriumRoutes } from "./routes/criterium.js";
import { joueursRoutes } from "./routes/joueurs.js";
import { startScheduler } from "./sync/scheduler.js";
import { db } from "./db/connection.js";

const app = new Hono();

app.use("/*", cors());

app.route("/", systemRoutes);
app.route("/api", equipesRoutes);
app.route("/api", criteriumRoutes);
app.route("/api", joueursRoutes);

const port = 3000;
serve({ fetch: app.fetch, port }, () => {
  console.log(`API server running on port ${port}`);
});

// Start scheduler only when required env vars are present
const hasEnvVars =
  process.env.FFTT_APP_ID &&
  process.env.FFTT_PASSWORD &&
  process.env.FFTT_SERIE &&
  process.env.DATABASE_URL;

if (hasEnvVars) {
  const ffttConfig = {
    appId: process.env.FFTT_APP_ID!,
    password: process.env.FFTT_PASSWORD!,
    serie: process.env.FFTT_SERIE!,
    clubNumero: process.env.CLUB_NUMERO ?? "08940073",
    clubNom: process.env.CLUB_NOM ?? "",
    organismeId: process.env.ORGANISME_ID ?? "",
  };
  startScheduler(db, ffttConfig);
}
