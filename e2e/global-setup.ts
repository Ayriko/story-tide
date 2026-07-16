import { execSync, spawn } from "node:child_process";
import path from "node:path";
import dotenv from "dotenv";
import { Client } from "pg";

/**
 * Isolation de la base e2e (le vrai cout du smoke Playwright) : jamais
 * toucher la base de DEV. On charge .env.e2e (jamais .env), on verifie par
 * garde-fous que l'URL pointe bien vers une base e2e locale, puis on la
 * (re)cree et on la remet a zero avant chaque run - determinisme total,
 * aucune fuite entre executions.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.e2e") });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL manquant - copier .env.e2e.example en .env.e2e avant de lancer le smoke.",
    );
  }

  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, "");

  // Garde-fous : on ne reinitialise jamais autre chose qu'une base e2e
  // locale, meme si .env.e2e est mal configure par erreur.
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(`Refus de reinitialiser une base non locale : ${url.hostname}`);
  }
  if (!dbName.endsWith("_e2e")) {
    throw new Error(
      `Refus de reinitialiser une base qui n'a pas l'air d'etre une base e2e : ${dbName}`,
    );
  }

  // Connexion a la base de maintenance "postgres" : on ne peut pas creer/
  // dropper la base a laquelle on est connecte.
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      dbName,
    ]);
    if ((rowCount ?? 0) === 0) {
      // dbName deja verifie ci-dessus (garde-fou "_e2e") - CREATE DATABASE ne
      // supporte pas les parametres lies pour un identifiant.
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  // Reset total du schema public (determinisme, aucune fuite entre runs).
  const e2eDb = new Client({ connectionString: databaseUrl });
  await e2eDb.connect();
  try {
    await e2eDb.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  } finally {
    await e2eDb.end();
  }

  // execSync (commande unique) plutot que execFileSync+shell:true+tableau
  // d'arguments : ce dernier declenche un DeprecationWarning Node (DEP0190).
  // Commande figee (aucune interpolation d'entree non fiable) - pas de risque
  // d'injection ici.
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  // Worker REEL (pas mocke) : necessaire pour que le job de liaison enfile a
  // la sauvegarde d'une fiche soit reellement traite pendant les tests e2e
  // (link-highlight.spec.ts verifie la liste "Entites liees", alimentee par
  // une vraie Relation ecrite en base par ce worker - pas par le webServer
  // Next.js seul, qui ne consomme aucune file). Commande figee en une seule
  // chaine (pas de tableau d'arguments + shell:true) - meme choix que
  // execSync ci-dessus, deja retenu pour eviter le DeprecationWarning Node
  // DEP0190 rencontre sur ce projet (cf. dev-log 2026-07-15).
  const worker = spawn("npx tsx src/worker/index.ts", {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  return async () => {
    worker.kill();
  };
}
