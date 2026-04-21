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

const isProd = env.NODE_ENV === "production";

if (isProd && !env.SYNC_TRIGGER_TOKEN) {
  throw new Error(
    "SYNC_TRIGGER_TOKEN is required in production (must be set to a secret of at least 16 chars)."
  );
}

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

if (isProd && !allowedOrigins) {
  throw new Error("ALLOWED_ORIGINS is required in production (comma-separated list).");
}

app.use(
  "/*",
  cors({
    origin: allowedOrigins ?? (isProd ? [] : "*"),
  })
);

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.route("/api", createSystemRoutes(ffttConfig, env.SYNC_TRIGGER_TOKEN));
app.route("/api", equipesRoutes);
app.route("/api", criteriumRoutes);
app.route("/api", joueursRoutes);

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`API server running on port ${env.PORT}`);
  if (!env.SYNC_TRIGGER_TOKEN) {
    console.warn(
      "WARN: SYNC_TRIGGER_TOKEN not set; /api/sync/* endpoints are unauthenticated (development mode)."
    );
  }
});

if (ffttConfig) {
  startScheduler(db, ffttConfig);
}
