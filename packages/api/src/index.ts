import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
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

app.use(
  "/*",
  cors({
    origin: allowedOrigins ?? "*",
  })
);

// Reject large request bodies up front (routes today never need >32 KB).
app.use("/*", bodyLimit({ maxSize: 32 * 1024 }));

// Centralised error handler: surface HTTPException status codes, hide stack
// traces for anything else.
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

app.route("/api", createSystemRoutes(ffttConfig, env.SYNC_TRIGGER_TOKEN));
app.route("/api", equipesRoutes);
app.route("/api", criteriumRoutes);
app.route("/api", joueursRoutes);

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`API server running on port ${env.PORT}`);
  if (!env.SYNC_TRIGGER_TOKEN) {
    console.warn(
      "WARN: SYNC_TRIGGER_TOKEN not set; /api/sync/trigger/:module and /api/sync/logs/:jobName are unauthenticated."
    );
  }
  if (!allowedOrigins) {
    console.warn(
      "WARN: ALLOWED_ORIGINS not set; CORS is open to '*'. Set ALLOWED_ORIGINS in production."
    );
  }
});

if (ffttConfig) {
  startScheduler(db, ffttConfig);
}
