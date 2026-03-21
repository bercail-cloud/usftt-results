import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import { sync_status } from "../db/schema.js";
import { syncFull } from "../sync/scheduler.js";
import type { CriteriumFfttConfig } from "../sync/sync-criterium.js";
import type { SyncDb } from "../sync/sync-equipes.js";

let isSyncing = false;

export function createSystemRoutes(ffttConfig: CriteriumFfttConfig | null) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/sync/status", async (c) => {
    const rows = await db.select().from(sync_status).orderBy(desc(sync_status.last_run));

    const latestByJob = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      if (!latestByJob.has(row.job_name)) {
        latestByJob.set(row.job_name, row);
      }
    }

    return c.json({
      jobs: Array.from(latestByJob.values()),
      isSyncing,
    });
  });

  app.post("/sync/trigger", async (c) => {
    if (!ffttConfig) {
      return c.json({ error: "FFTT config not available" }, 503);
    }
    if (isSyncing) {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    isSyncing = true;
    // Run sync in background, don't block the response
    syncFull(db as SyncDb, ffttConfig)
      .finally(() => { isSyncing = false; });

    return c.json({ message: "Sync started" });
  });

  return app;
}

// Backward-compatible export for cases without config
export const systemRoutes = createSystemRoutes(null);
