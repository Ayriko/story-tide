// Matrice de coherence rejouee au tag par le job "release-consistency" de
// cd.yml (garde-fou, avant build-push) - fonction pure prenant des faits deja
// collectes par scripts/release.ts (git, fs), pour rendre chaque cas de la
// matrice testable unitairement plutot que deroule a la main (KAN-44).
import { isUnreleasedEmpty, hasVersionSection, MissingUnreleasedSectionError } from "./changelog";
import { versionFromTagName, InvalidVersionError, type ReleaseVersion } from "./version";

export interface ReleaseFacts {
  // Nom du tag pousse, ex : "v1.3.0" ou "v1.3.0-rc.1" (GITHUB_REF_NAME en CD).
  readonly tagName: string;
  // "version" telle que lue dans package.json au commit vise par le tag.
  readonly packageVersion: string;
  // Contenu brut de CHANGELOG.md au meme commit.
  readonly changelog: string;
  // Type d'objet git du tag ("tag" = annote, "commit" = tag leger - refuse).
  readonly tagObjectType: "tag" | "commit";
  // Le commit vise par le tag appartient-il a origin/main ?
  readonly tagOnMain: boolean;
}

// Retourne la liste des echecs (vide = tag coherent, deploiement autorise).
export function verifyRelease(facts: ReleaseFacts): string[] {
  const failures: string[] = [];

  let version: ReleaseVersion;
  try {
    version = versionFromTagName(facts.tagName);
  } catch (error) {
    // Nom de tag invalide : rien d'autre n'est verifiable sans version.
    failures.push(error instanceof InvalidVersionError ? error.message : String(error));
    return failures;
  }

  if (facts.tagObjectType !== "tag") {
    failures.push(
      `Le tag "${facts.tagName}" n'est pas annote (tag leger) - utiliser "git tag -a".`,
    );
  }

  if (!facts.tagOnMain) {
    failures.push(`Le commit vise par le tag "${facts.tagName}" n'appartient pas a origin/main.`);
  }

  if (facts.packageVersion !== version.version) {
    failures.push(
      `package.json "version" ("${facts.packageVersion}") ne correspond pas au tag ("${version.version}").`,
    );
  }

  // La bascule CHANGELOG n'a lieu qu'a la version finale - un -rc.N n'a rien
  // a journaliser de plus que ce que la version finale journalisera.
  if (!version.isRc) {
    if (!hasVersionSection(facts.changelog, version.version)) {
      failures.push(`CHANGELOG.md ne contient aucune section "## [${version.version}]".`);
    }
    try {
      if (!isUnreleasedEmpty(facts.changelog)) {
        failures.push(
          'La section "## [Unreleased]" du CHANGELOG n\'est pas vide : du contenu allait etre livre sans etre journalise.',
        );
      }
    } catch (error) {
      failures.push(error instanceof MissingUnreleasedSectionError ? error.message : String(error));
    }
  }

  return failures;
}
