import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),

  S3_ENDPOINT: z.string().min(1),
  S3_PORT: z.coerce.number().int().positive(),
  S3_USE_SSL: z.enum(["true", "false"]).transform((value) => value === "true"),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

// Record<string, string | undefined> plutot que NodeJS.ProcessEnv : Next.js
// affine NODE_ENV en union litterale ('development'|'test'|'production'), ce qui
// empeche de simuler en test une variable absente ou invalide sans cast. Le
// type plus generique reste compatible avec process.env (plus specifique).
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variables d'environnement invalides :\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();
