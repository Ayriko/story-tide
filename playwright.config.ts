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
  retries: 0,
  reporter: "list",
  // Compilation Next.js au premier lancement de `next dev` : delai genereux.
  timeout: 60_000,
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
    },
  },
});
