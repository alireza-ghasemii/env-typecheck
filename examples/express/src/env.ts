import { createEnv, z } from "@alireza_ghasemi/env-typecheck";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().url().optional(),
});

export const env = createEnv(envSchema, {
  path: [".env.local", ".env"],
});

export type Env = z.infer<typeof envSchema>;
