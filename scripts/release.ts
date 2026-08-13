// CLI de release (KAN-44) : bascule le CHANGELOG, synchronise package.json et
// package-lock.json, cree le commit et le tag annotes - le geste correct rendu
// facile, en complement du garde-fou CD (--verify, cd.yml/release-consistency)
// qui rend le geste incorrect impossible. Meme patron d'invocation que
// prisma/seed/run.ts et npm run worker : node --import tsx, hors src/, import
// via l'alias @/. Suppose un cwd = racine du repo (vrai pour `npm run ...` et
// pour un lancement direct depuis la racine).
//
// Usage :
//   npm run release -- 1.3.0
//   npm run release -- 1.3.0-rc.1
//   npm run release -- 1.3.0 --dry-run
//
// --verify <tagName> : mode consomme par le job release-consistency de
// cd.yml (rejoue verifyRelease sur le tag pousse), jamais invoque a la main.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import packageJson from "../package.json";
import { releaseChangelog } from "@/lib/release/changelog";
import { parseReleaseVersion, tagNameFor, type ReleaseVersion } from "@/lib/release/version";
import { verifyRelease } from "@/lib/release/verify";

const CHANGELOG_PATH = "CHANGELOG.md";

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

// Meme commande que git(), mais renvoie null au lieu de lever - utilise pour
// les controles ou un echec (ref absente, pas d'ancetre...) est une reponse
// valide, pas une erreur reelle a chainer.
function tryGit(args: string[]): string | null {
  try {
    return git(args);
  } catch {
    return null;
  }
}

// Windows resout "npm" en "npm.cmd" (script batch) : "npm" seul echoue en
// ENOENT (pas de resolution PATHEXT), et depuis le durcissement Node
// CVE-2024-27980 un .cmd exige en plus shell:true a l'appel (sinon EINVAL).
function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

interface Check {
  readonly label: string;
  readonly ok: boolean;
  readonly detail?: string;
}

function collectPreconditions(version: ReleaseVersion): Check[] {
  const checks: Check[] = [];

  const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  checks.push({
    label: "branche main",
    ok: branch === "main",
    detail: branch === "main" ? undefined : `branche courante : "${branch ?? "?"}"`,
  });

  const status = tryGit(["status", "--porcelain"]);
  checks.push({
    label: "arbre git propre",
    ok: status === "",
    detail: status ? "des modifications non commitees existent" : undefined,
  });

  tryGit(["fetch", "origin", "main"]);
  const localMain = tryGit(["rev-parse", "main"]);
  const remoteMain = tryGit(["rev-parse", "origin/main"]);
  checks.push({
    label: "main a jour avec origin/main",
    ok: localMain !== null && localMain === remoteMain,
    detail: localMain === remoteMain ? undefined : "un `git pull` est necessaire",
  });

  const tagName = tagNameFor(version.version);
  const tagExists = tryGit(["rev-parse", "--verify", "--quiet", `refs/tags/${tagName}`]);
  checks.push({
    label: `tag ${tagName} inexistant`,
    ok: tagExists === null,
    detail: tagExists === null ? undefined : `le tag ${tagName} existe deja`,
  });

  return checks;
}

// Date figee via RELEASE_DATE pour un dry-run reproductible (tests manuels,
// captures a joindre au dossier) - sinon la date du jour.
function today(): string {
  return process.env.RELEASE_DATE ?? new Date().toISOString().slice(0, 10);
}

function planChangelog(version: ReleaseVersion): { checks: Check[]; preview: string | null } {
  if (version.isRc) {
    // La bascule [Unreleased] -> section datee n'a lieu qu'a la version
    // finale (brief KAN-44) : un -rc.N ne touche jamais au CHANGELOG.
    return { checks: [], preview: null };
  }
  const current = readFileSync(CHANGELOG_PATH, "utf8");
  try {
    const next = releaseChangelog(current, version.version, today());
    return { checks: [{ label: "CHANGELOG.md : bascule [Unreleased]", ok: true }], preview: next };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      checks: [{ label: "CHANGELOG.md : bascule [Unreleased]", ok: false, detail: message }],
      preview: null,
    };
  }
}

function printChecks(checks: Check[]): void {
  for (const check of checks) {
    const mark = check.ok ? "OK" : "ECHEC";
    const detail = check.detail ? ` - ${check.detail}` : "";
    console.log(`[release] [${mark}] ${check.label}${detail}`);
  }
}

function runRelease(rawVersion: string, dryRun: boolean): void {
  const version = parseReleaseVersion(rawVersion);
  const preconditions = collectPreconditions(version);
  const { checks: changelogChecks, preview } = planChangelog(version);
  const allChecks = [...preconditions, ...changelogChecks];
  const failed = allChecks.filter((check) => !check.ok);

  printChecks(allChecks);
  if (version.isRc) {
    console.log("[release] rc : CHANGELOG.md non touche (bascule reservee au tag final).");
  }
  console.log(`[release] version : ${packageJson.version} -> ${version.version}`);
  if (preview !== null) {
    console.log(`[release] CHANGELOG.md apres bascule :\n${preview}`);
  }

  if (failed.length > 0) {
    console.error(`[release] ${failed.length} controle(s) en echec, rien n'a ete ecrit.`);
    process.exit(1);
  }

  if (dryRun) {
    console.log("[release] dry-run : rien n'a ete ecrit.");
    return;
  }

  if (preview !== null) {
    writeFileSync(CHANGELOG_PATH, preview, "utf8");
  }
  // Synchronise package.json ET package-lock.json ("version" racine) ; le
  // flag ne supprime que le commit+tag automatiques de npm, pas le lockfile.
  // Node >= 22 (durcissement CVE-2024-27980) : executer un .cmd/.bat exige
  // shell:true sous Windows, sinon spawnSync echoue en EINVAL. Sans risque ici :
  // version.version est un SemVer valide (aucun metacaractere shell possible).
  execFileSync(npmCommand(), ["version", version.version, "--no-git-tag-version"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const filesToCommit =
    preview !== null
      ? [CHANGELOG_PATH, "package.json", "package-lock.json"]
      : ["package.json", "package-lock.json"];
  git(["add", ...filesToCommit]);
  git(["commit", "-m", `chore(release): v${version.version}`]);

  const tagName = tagNameFor(version.version);
  const tagMessage = version.isRc ? `Preproduction ${tagName}` : `Mise en production ${tagName}`;
  git(["tag", "-a", tagName, "-m", tagMessage]);

  console.log(`[release] commit et tag ${tagName} crees localement.`);
  console.log(`[release] pour publier : git push origin main && git push origin ${tagName}`);
}

function runVerify(tagName: string): void {
  try {
    const changelog = readFileSync(CHANGELOG_PATH, "utf8");
    tryGit(["fetch", "origin", "main"]);
    const tagObjectType = git(["cat-file", "-t", tagName]) === "tag" ? "tag" : "commit";
    const tagOnMain = tryGit(["merge-base", "--is-ancestor", tagName, "origin/main"]) !== null;

    const failures = verifyRelease({
      tagName,
      packageVersion: packageJson.version,
      changelog,
      tagObjectType,
      tagOnMain,
    });

    if (failures.length === 0) {
      console.log(`[release] verification OK pour ${tagName}.`);
      return;
    }

    console.error(`[release] tag ${tagName} incoherent :`);
    for (const failure of failures) {
      console.error(`[release]   - ${failure}`);
    }
    process.exit(1);
  } catch (error) {
    // Erreur reelle (ref introuvable, fichier illisible...) - jamais avalee,
    // loguee ici avant le message generique (cf. CLAUDE.md).
    console.error("[release] echec inattendu pendant --verify", error);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args[0] === "--verify") {
  const tagName = args[1];
  if (!tagName) {
    console.error("[release] Usage : --verify <tagName>");
    process.exit(1);
  }
  runVerify(tagName);
} else {
  const rawVersion = args.find((arg) => !arg.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  if (!rawVersion) {
    console.error("[release] Usage : npm run release -- <X.Y.Z|X.Y.Z-rc.N> [--dry-run]");
    process.exit(1);
  }
  runRelease(rawVersion, dryRun);
}
