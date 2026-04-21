import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  FFTT_APP_ID: z.string().min(1).optional(),
  FFTT_PASSWORD: z.string().min(1).optional(),
  FFTT_SERIE: z.string().length(15).optional(),
  CLUB_NUMERO: z.string().default("08940073"),
  CLUB_NOM: z.string().default(""),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  SYNC_TRIGGER_TOKEN: z.string().min(16).optional(),
  ALLOWED_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export function hasFfttConfig(
  e: Env
): e is Env & { FFTT_APP_ID: string; FFTT_PASSWORD: string; FFTT_SERIE: string } {
  return Boolean(e.FFTT_APP_ID && e.FFTT_PASSWORD && e.FFTT_SERIE);
}
