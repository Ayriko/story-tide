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

  // Envoi de messages (KAN-52 - premiere brique mail du produit). Transport
  // SMTP OVH (ssl0.ovh.net) : secure=true sur le port 465 (TLS immediat),
  // false sur 587 (STARTTLS). SMTP_PASSWORD n'a JAMAIS de valeur par defaut
  // et n'apparait dans aucun fichier du depot - il est pose dans .env en dev
  // et dans deploy/.env.<env> sur le VPS.
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z.enum(["true", "false"]).transform((value) => value === "true"),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  // Expediteur unique de tout le produit (contact@storytide.fr) : ce n'est pas
  // un parametre d'appel, aucun code appelant ne peut donc usurper l'adresse.
  MAIL_FROM: z.string().min(1),
  // "memory" : aucun message ne part reellement - reserve aux runs e2e
  // (.env.e2e). Defaut "smtp" pour qu'un oubli de configuration echoue
  // bruyamment plutot que d'avaler silencieusement les envois.
  MAIL_TRANSPORT: z.enum(["smtp", "memory"]).default("smtp"),

  // SHA de commit affiche par /api/health hors production uniquement
  // (supervision v1, C4.1.2) - optionnel : cable plus tard via un build-arg
  // Docker, absent tant que non injecte.
  COMMIT_SHA: z.string().optional(),
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
