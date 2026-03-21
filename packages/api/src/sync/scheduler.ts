import cron from "node-cron";
import { syncEquipes } from "./sync-equipes.js";
import {
  syncClassementsPoule,
  syncRencontres,
  syncDetailsRencontres,
} from "./sync-rencontres.js";
import { syncJoueurs } from "./sync-joueurs.js";
import { syncParties } from "./sync-parties.js";
import { syncHistorique } from "./sync-historique.js";
import { syncCriterium } from "./sync-criterium.js";
import { sync_status, equipes as equipesTable } from "../db/schema.js";
import type { CriteriumFfttConfig } from "./sync-criterium.js";
import type { SyncDb } from "./sync-equipes.js";

async function logSyncStatus(
  db: SyncDb,
  jobName: string,
  status: "success" | "error",
  errorMessage?: string
): Promise<void> {
  await db
    .insert(sync_status)
    .values({
      jobName,
      lastRun: new Date(),
      status,
      errorMessage: errorMessage ?? null,
    })
    .onConflictDoUpdate({
      target: [sync_status.job_name],
      set: {
        lastRun: new Date(),
        status,
        errorMessage: errorMessage ?? null,
      },
    })
    .returning();
}

async function runJob(
  db: SyncDb,
  name: string,
  fn: () => Promise<unknown>
): Promise<void> {
  try {
    await fn();
    await logSyncStatus(db, name, "success");
  } catch (error) {
    await logSyncStatus(db, name, "error", String(error));
    console.error(`Sync job ${name} failed:`, error);
  }
}

async function syncAllClassements(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): Promise<void> {
  const equipesRows = await db.select().from(equipesTable);
  for (const eq of equipesRows) {
    await syncClassementsPoule(db, eq, ffttConfig);
    await syncRencontres(db, eq, ffttConfig);
    await syncDetailsRencontres(db, eq.id, ffttConfig);
  }
}

export async function syncFull(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): Promise<void> {
  await runJob(db, "sync-equipes", () => syncEquipes(db, ffttConfig));
  await runJob(db, "sync-joueurs", () => syncJoueurs(db, ffttConfig));
  await runJob(db, "sync-classements", () => syncAllClassements(db, ffttConfig));
  await runJob(db, "sync-parties", () => syncParties(db, ffttConfig));
  await runJob(db, "sync-criterium", () => syncCriterium(db, ffttConfig));
}

export async function syncMatchDay(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): Promise<void> {
  await runJob(db, "sync-equipes", () => syncEquipes(db, ffttConfig));
  await runJob(db, "sync-classements", () => syncAllClassements(db, ffttConfig));
}

async function syncHistoriqueJob(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): Promise<void> {
  await runJob(db, "sync-historique", () => syncHistorique(db, ffttConfig));
}

export function startScheduler(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): void {
  cron.schedule("0 8,20 * * *", () => syncFull(db, ffttConfig));
  cron.schedule("0 18-23 * * 5", () => syncMatchDay(db, ffttConfig));
  cron.schedule("0 9-20 * * 6", () => syncMatchDay(db, ffttConfig));
  cron.schedule("0 6 * * 1", () => syncHistoriqueJob(db, ffttConfig));

  console.log("Scheduler started");
}
