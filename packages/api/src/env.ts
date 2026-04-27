import { envSchema, type Env } from "./env-schema.js";

export { envSchema, type Env };

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
