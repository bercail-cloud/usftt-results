import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { sync_status, sync_logs } from "../db/schema.js";
import { syncCriterium } from "../sync/sync-criterium.js";
import { syncFull, runJob } from "../sync/scheduler.js";
import { syncPartiesMysql, syncPartiesSpid } from "../sync/sync-parties.js";
import type { CriteriumFfttConfig } from "../sync/sync-criterium.js";
import type { SyncDb } from "../sync/sync-equipes.js";

const activeSyncs = new Set<string>();
const SYNC_TIMEOUT_MS = 15 * 60 * 1000; // 15 min max
const syncStartedAt = new Map<string, number>();

function isSyncStale(jobName: string): boolean {
  const startedAt = syncStartedAt.get(jobName);
  return startedAt !== undefined && Date.now() - startedAt > SYNC_TIMEOUT_MS;
}

export function createSystemRoutes(ffttConfig: CriteriumFfttConfig | null) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/sync/status", async (c) => {
    // sync_status.job_name has a unique constraint, so one row per job.
    const jobs = await db.select().from(sync_status).orderBy(desc(sync_status.last_run));
    return c.json({
      jobs,
      activeSyncs: Array.from(activeSyncs),
    });
  });

  app.post("/sync/trigger/:module", async (c) => {
    if (!ffttConfig) {
      return c.json({ error: "FFTT config not available" }, 503);
    }

    const module = c.req.param("module");

    const d = db as SyncDb;
    const syncModules: Record<string, () => Promise<unknown>> = {
      full: () => syncFull(d, ffttConfig),
      criterium: () => runJob(d, "sync-criterium", () => syncCriterium(d, ffttConfig)),
      "parties-spid": () => runJob(d, "sync-parties-spid", () => syncPartiesSpid(d, ffttConfig)),
      "parties-mysql": () => runJob(d, "sync-parties-mysql", () => syncPartiesMysql(d, ffttConfig)),
    };

    if (!syncModules[module]) {
      return c.json(
        { error: `Unknown sync module: ${module}`, available: Object.keys(syncModules) },
        400
      );
    }

    // Reset stale sync flag
    if (activeSyncs.has(module) && isSyncStale(module)) {
      activeSyncs.delete(module);
      syncStartedAt.delete(module);
    }

    if (activeSyncs.has(module)) {
      return c.json({ error: `Sync ${module} already in progress` }, 409);
    }

    activeSyncs.add(module);
    syncStartedAt.set(module, Date.now());

    syncModules[module]!().finally(() => {
      activeSyncs.delete(module);
      syncStartedAt.delete(module);
    });

    return c.json({ message: `Sync ${module} started` });
  });

  app.get("/sync/logs/:jobName", async (c) => {
    const jobName = c.req.param("jobName");
    const rows = await db
      .select()
      .from(sync_logs)
      .where(eq(sync_logs.job_name, jobName))
      .orderBy(desc(sync_logs.created_at));
    return c.json({ logs: rows });
  });

  return app;
}
