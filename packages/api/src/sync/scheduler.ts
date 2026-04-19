import cron from "node-cron";
import { syncEquipes } from "./sync-equipes.js";
import {
  syncClassementsPoule,
  syncRencontres,
  syncDetailsRencontres,
} from "./sync-rencontres.js";
import { syncJoueurs } from "./sync-joueurs.js";
import { syncPartiesMysql, syncPartiesSpid } from "./sync-parties.js";
import { syncHistorique } from "./sync-historique.js";
import { sql } from "drizzle-orm";
import { sync_status, equipes as equipesTable, rencontres } from "../db/schema.js";
import type { CriteriumFfttConfig } from "./sync-criterium.js";
import type { SyncDb } from "./sync-equipes.js";

// /api/sync/status is public, so the stored message is reader-visible.
// Keep it short and strip stack traces / env-specific paths.
const MAX_ERROR_MESSAGE_LEN = 500;

function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const firstLine = raw.split("\n")[0] ?? "";
  return firstLine.slice(0, MAX_ERROR_MESSAGE_LEN);
}

async function logSyncStatus(
  db: SyncDb,
  jobName: string,
  status: "success" | "error",
  errorMessage?: string
): Promise<void> {
  await db
    .insert(sync_status)
    .values({
      job_name: jobName,
      last_run: new Date(),
      status,
      error_message: errorMessage ?? null,
    })
    .onConflictDoUpdate({
      target: [sync_status.job_name],
      set: {
        last_run: new Date(),
        status,
        error_message: errorMessage ?? null,
      },
    })
    .returning();
}

export async function runJob(
  db: SyncDb,
  name: string,
  fn: () => Promise<unknown>
): Promise<void> {
  try {
    await fn();
    await logSyncStatus(db, name, "success");
  } catch (error) {
    await logSyncStatus(db, name, "error", sanitizeErrorMessage(error));
    console.error(`Sync job ${name} failed:`, error);
  }
}

async function syncAllClassements(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): Promise<void> {
  const equipesRows = await db.select().from(equipesTable);
  const errors: string[] = [];
  for (const eq of equipesRows) {
    try {
      await syncClassementsPoule(db, eq, ffttConfig);
      await syncRencontres(db, eq, ffttConfig);
      await syncDetailsRencontres(db, eq.id, ffttConfig);
    } catch (error) {
      const msg = `Equipe ${eq.lib_equipe} (id=${eq.id}): ${String(error)}`;
      console.error(`sync-classements error: ${msg}`);
      errors.push(msg);
    }
  }
  if (errors.length > 0) {
    throw new Error(`${errors.length} equipe(s) failed:\n${errors.join("\n")}`);
  }
}

export async function syncFull(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): Promise<void> {
  await runJob(db, "sync-equipes", () => syncEquipes(db, ffttConfig));
  await runJob(db, "sync-joueurs", () => syncJoueurs(db, ffttConfig));
  await runJob(db, "sync-classements", () => syncAllClassements(db, ffttConfig));
  await runJob(db, "sync-parties-spid", () => syncPartiesSpid(db, ffttConfig));
}

export async function syncQuotidienEtJourDeMatch(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): Promise<void> {
  await runJob(db, "sync-classements", () => syncAllClassements(db, ffttConfig));
  await runJob(db, "sync-parties-spid", () => syncPartiesSpid(db, ffttConfig));
}

export async function syncHebdoEtDebutPhaseBiQuotidien(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): Promise<void> {
  await runJob(db, "sync-equipes", () => syncEquipes(db, ffttConfig));
  await runJob(db, "sync-joueurs", () => syncJoueurs(db, ffttConfig));
  await runJob(db, "sync-historique", () => syncHistorique(db, ffttConfig));
}

export function todayAsDDMMYYYY(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function hasMatchToday(db: SyncDb): Promise<boolean> {
  const today = todayAsDDMMYYYY();
  const rows = await db
    .select({ id: rencontres.id })
    .from(rencontres)
    .where(sql`${rencontres.date_prevue} = ${today}`)
    .limit(1);
  return rows.length > 0;
}

async function syncPartiesMysqlJob(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): Promise<void> {
  await runJob(db, "sync-parties-mysql", () => syncPartiesMysql(db, ffttConfig));
}

export function startScheduler(
  db: SyncDb,
  ffttConfig: CriteriumFfttConfig
): void {
  // Daily at 7am and 19pm + extra frequency on match days
  cron.schedule("0 7,19 * * *", () => syncQuotidienEtJourDeMatch(db, ffttConfig));
  // Match day: every hour on Saturday, only if a match is scheduled today
  cron.schedule("0 * * * 6", async () => {
    if (await hasMatchToday(db)) {
      await syncQuotidienEtJourDeMatch(db, ffttConfig);
    }
  });
  // Every 2 days at 6am in January and September (new phase rankings)
  cron.schedule("0 6 1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31 1,9 *", () =>
    syncHebdoEtDebutPhaseBiQuotidien(db, ffttConfig)
  );
  // Weekly on Mondays at 6am the rest of the year
  cron.schedule("0 6 * 2-8,10-12 1", () =>
    syncHebdoEtDebutPhaseBiQuotidien(db, ffttConfig)
  );
  // Mysql parties: daily from 12th to 20th of each month at 6am
  cron.schedule("0 6 12-20 * *", () => syncPartiesMysqlJob(db, ffttConfig));

  console.log("Scheduler started");
}
