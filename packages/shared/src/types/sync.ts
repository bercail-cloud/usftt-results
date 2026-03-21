import { z } from "zod";

export const SyncStatusSchema = z.object({
  id: z.number(),
  jobName: z.string(),
  lastRun: z.string(),
  status: z.enum(["success", "error"]),
  errorMessage: z.string().nullable(),
});

export type SyncStatus = z.infer<typeof SyncStatusSchema>;
