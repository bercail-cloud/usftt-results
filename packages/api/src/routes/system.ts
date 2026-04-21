import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { createHash, timingSafeEqual } from "node:crypto";
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
const DEFAULT_LOG_LIMIT = 200;
const MAX_LOG_LIMIT = 1000;

function isSyncStale(jobName: string): boolean {
  const startedAt = syncStartedAt.get(jobName);
  return startedAt !== undefined && Date.now() - startedAt > SYNC_TIMEOUT_MS;
}

function sha256(input: string): Buffer {
  return createHash("sha256").update(input).digest();
}

function bearerTokenMatches(header: string | undefined, expected: string): boolean {
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : "";
  return timingSafeEqual(sha256(provided), sha256(expected));
}

function requireToken(triggerToken: string | undefined): MiddlewareHandler {
  return async (c, next) => {
    if (!triggerToken) return next();
    if (!bearerTokenMatches(c.req.header("authorization"), triggerToken)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return next();
  };
}

export function createSystemRoutes(
  ffttConfig: CriteriumFfttConfig | null,
  triggerToken?: string
) {
  const app = new Hono();
  const auth = requireToken(triggerToken);

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/sync/status", auth, async (c) => {
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

  app.post("/sync/trigger/:module", auth, async (c) => {
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

    syncModules[module]!()
      .catch((err) => console.error(`Sync ${module} failed:`, err))
      .finally(() => {
        activeSyncs.delete(module);
        syncStartedAt.delete(module);
      });

    return c.json({ message: `Sync ${module} started` });
  });

  app.get("/sync/logs/:jobName", auth, async (c) => {
    const jobName = c.req.param("jobName");
    const rawLimit = Number(c.req.query("limit"));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LOG_LIMIT)
      : DEFAULT_LOG_LIMIT;
    const rows = await db
      .select()
      .from(sync_logs)
      .where(eq(sync_logs.job_name, jobName))
      .orderBy(desc(sync_logs.created_at))
      .limit(limit);
    return c.json({ logs: rows });
  });

  return app;
}
