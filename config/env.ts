import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DAILY_EMAIL_LIMIT: z.coerce.number().int().positive().default(500),
  // Add other env variables here as needed
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DAILY_EMAIL_LIMIT: process.env.DAILY_EMAIL_LIMIT,
});
