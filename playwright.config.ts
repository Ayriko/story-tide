import path from "node:path";
import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";

// Charge .env.e2e ICI (pas seulement dans globalSetup) : webServer.env a
// besoin des valeurs au moment ou ce fichier de config est evalue, sans
// dependre de l'ordre d'execution entre globalSetup et le demarrage du
// serveur. Jamais .env (base de dev) - isolation totale de l'environnement.
dotenv.config({ path: path.resolve(__dirname, ".env.e2e") });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `${key} manquant - copier .env.e2e.example en .env.e2e avant de lancer le smoke Playwright.`,
    );
  }
  return value;
}

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  // Parallelisme : laisse a Playwright (moitie des coeurs). En CI (2 coeurs)
  // cela revient a 1 worker, donc a une execution en serie.
  // ATTENTION en local : forcer `--workers=2` fait echouer 4 specs sur ce poste
  // depuis que la suite est passee a 16 tests (2026-08-18) - image-upload,
  // link-highlight, long-content et manual-mention tombent sur des attentes de
  // temps (autosave « Enregistré. », chargement de l'image), jamais sur une
  // assertion de comportement. Les memes passent en serie. La cause est la
  // contention (file de jobs pg-boss partagee + dev server unique), pas une
  // regression : lancer `npx playwright test --workers=1` en cas de doute.
  retries: 0,
  reporter: "list",
  // Compilation Next.js au premier lancement de `next dev` : delai genereux.
  // Releve de 60 s a 120 s le 2026-08-17 (KAN-52) : sur un cache `.next/dev`
  // froid - le cas de la CI a chaque run - la compilation a la volee de
  // `/worlds/[slug]/entities/[entityId]` (Tiptap) depassait 60 s et faisait
  // tomber 8 specs d'un coup sur l'attente de `.ProseMirror`, alors que les
  // memes passent en 20 a 43 s une fois la route compilee. Le delai couvre
  // desormais la compilation, sans masquer une vraie lenteur applicative :
  // aucun test ne s'en approche a chaud.
  timeout: 120_000,
  use: {
    baseURL,
    // "on-first-retry" ne produirait jamais rien avec retries:0 (aucun retry
    // possible) - "retain-on-failure" capture la trace au premier echec, sans
    // dependre d'un retry, exploitable via l'artefact CI (test-results/).
    trace: "retain-on-failure",
  },
  // intro-world.spec.ts (KAN-35) enfile 25 jobs de liaison reels sur la MEME
  // file partagee que tous les autres e2e - execute en parallele (workers>1),
  // ce lot fait concurrence aux jobs specifiques des autres tests et peut les
  // faire depasser leur propre delai d'attente (flake constate : link-highlight
  // et link-ignore, dont le job se retrouve noye derriere 25 autres). Projet
  // separe avec `dependencies` : force ce fichier a s'executer APRES tous les
  // autres, jamais en meme temps qu'eux, quel que soit --workers.
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
      testIgnore: /intro-world\.spec\.ts/,
    },
    {
      name: "chromium-intro-world",
      use: { browserName: "chromium" },
      testMatch: /intro-world\.spec\.ts/,
      dependencies: ["chromium"],
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "development",
      DATABASE_URL: requireEnv("DATABASE_URL"),
      BETTER_AUTH_SECRET: requireEnv("BETTER_AUTH_SECRET"),
      BETTER_AUTH_URL: requireEnv("BETTER_AUTH_URL"),
      S3_ENDPOINT: requireEnv("S3_ENDPOINT"),
      S3_PORT: requireEnv("S3_PORT"),
      S3_USE_SSL: requireEnv("S3_USE_SSL"),
      S3_REGION: requireEnv("S3_REGION"),
      S3_ACCESS_KEY: requireEnv("S3_ACCESS_KEY"),
      S3_SECRET_KEY: requireEnv("S3_SECRET_KEY"),
      S3_BUCKET: requireEnv("S3_BUCKET"),
      // MAIL_* : le schema Zod (src/env.ts) les exige au demarrage. En e2e,
      // MAIL_TRANSPORT=memory garantit qu'aucun message ne part reellement -
      // le test de reinitialisation lit le jeton en base, pas dans une boite.
      MAIL_TRANSPORT: requireEnv("MAIL_TRANSPORT"),
      SMTP_HOST: requireEnv("SMTP_HOST"),
      SMTP_PORT: requireEnv("SMTP_PORT"),
      SMTP_SECURE: requireEnv("SMTP_SECURE"),
      SMTP_USER: requireEnv("SMTP_USER"),
      SMTP_PASSWORD: requireEnv("SMTP_PASSWORD"),
      MAIL_FROM: requireEnv("MAIL_FROM"),
    },
  },
});
