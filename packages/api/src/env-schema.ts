import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    FFTT_APP_ID: z.string().min(1).optional(),
    FFTT_PASSWORD: z.string().min(1).optional(),
    FFTT_SERIE: z.string().length(15).optional(),
    CLUB_NUMERO: z.string().default("08940073"),
    CLUB_NOM: z.string().default(""),
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().int().positive().default(3000),
    SYNC_TRIGGER_TOKEN: z.string().min(1).optional(),
    ALLOWED_ORIGINS: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    if (!env.ALLOWED_ORIGINS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ALLOWED_ORIGINS"],
        message:
          "must be set in production (comma-separated list of origins) to avoid permissive CORS",
      });
    }
    if (!env.SYNC_TRIGGER_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SYNC_TRIGGER_TOKEN"],
        message:
          "must be set in production; the /sync/trigger endpoint refuses requests when unset",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
