import { z } from "zod";

const envSchema = z.object({
  FFTT_APP_ID: z.string().min(1),
  FFTT_PASSWORD: z.string().min(1),
  FFTT_SERIE: z.string().length(15),
  CLUB_NUMERO: z.string().default("08940073"),
  DATABASE_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
