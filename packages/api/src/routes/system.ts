import { Hono } from "hono";
import type { Context } from "hono";
import { timingSafeEqual } from "node:crypto";
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

function checkBearerToken(c: Context, expected: string): boolean {
  const header = c.req.header("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSystemRoutes(
  ffttConfig: CriteriumFfttConfig | null,
  triggerToken?: string
) {
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
      activeSyncs: Array.from(activeSyncs),
    });
  });

  app.post("/sync/trigger/:module", async (c) => {
    if (triggerToken && !checkBearerToken(c, triggerToken)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

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
    if (triggerToken && !checkBearerToken(c, triggerToken)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
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
