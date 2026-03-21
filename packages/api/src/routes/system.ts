import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import { sync_status } from "../db/schema.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/sync/status", async (c) => {
  const rows = await db.select().from(sync_status).orderBy(desc(sync_status.last_run));

  // Return latest entry per job_name
  const latestByJob = new Map<string, typeof rows[0]>();
  for (const row of rows) {
    if (!latestByJob.has(row.job_name)) {
      latestByJob.set(row.job_name, row);
    }
  }

  return c.json(Array.from(latestByJob.values()));
});

export const systemRoutes = app;
