import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createSystemRoutes } from "./routes/system.js";
import { equipesRoutes } from "./routes/equipes.js";
import { criteriumRoutes } from "./routes/criterium.js";
import { joueursRoutes } from "./routes/joueurs.js";
import { startScheduler } from "./sync/scheduler.js";
import { db } from "./db/connection.js";
import { env, hasFfttConfig } from "./env.js";
import type { CriteriumFfttConfig } from "./sync/sync-criterium.js";

const ffttConfig: CriteriumFfttConfig | null = hasFfttConfig(env)
  ? {
      appId: env.FFTT_APP_ID,
      password: env.FFTT_PASSWORD,
      serie: env.FFTT_SERIE,
      clubNumero: env.CLUB_NUMERO,
      clubNom: env.CLUB_NOM,
    }
  : null;

const app = new Hono();

const allowedOrigins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : null;

// Outside production we default to "*" for convenience. In production the
// envSchema refuses to load without ALLOWED_ORIGINS, so allowedOrigins is
// always non-empty here.
app.use(
  "/*",
  cors({
    origin: allowedOrigins ?? "*",
  })
);

app.route("/api", createSystemRoutes(ffttConfig, env.SYNC_TRIGGER_TOKEN));
app.route("/api", equipesRoutes);
app.route("/api", criteriumRoutes);
app.route("/api", joueursRoutes);

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`API server running on port ${env.PORT}`);
  if (env.NODE_ENV !== "production" && !env.SYNC_TRIGGER_TOKEN) {
    console.warn(
      "WARN: SYNC_TRIGGER_TOKEN not set; /api/sync/trigger/:module is unauthenticated."
    );
  }
});

if (ffttConfig) {
  startScheduler(db, ffttConfig);
}
