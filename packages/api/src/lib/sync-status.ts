import { desc } from "drizzle-orm";
import { sync_status } from "../db/schema.js";
import type { SyncDb } from "../sync/sync-equipes.js";

export async function getLastSync(db: SyncDb): Promise<Date | null> {
  const rows = await db
    .select({ last_run: sync_status.last_run })
    .from(sync_status)
    .orderBy(desc(sync_status.last_run))
    .limit(1);
  return rows.length > 0 ? rows[0]!.last_run : null;
}
