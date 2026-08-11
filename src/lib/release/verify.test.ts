import { describe, expect, it } from "vitest";
import { verifyRelease, type ReleaseFacts } from "./verify";

const CHANGELOG_1_3_0_RELEASED = `# Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet suit [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

## [1.3.0] - 2026-08-13

### Ajouté

- Script de release.
`;

const CHANGELOG_1_3_0_NOT_RELEASED = `# Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet suit [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- Script de release.
`;

// Version bumpee dans package.json (1.3.0) mais le CHANGELOG n'a jamais ete
// touche : ni section "## [1.3.0]", ni contenu sous [Unreleased] (isole la
// verification "section manquante" du cas "Unreleased non vide").
const CHANGELOG_NO_1_3_0_SECTION_AT_ALL = `# Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet suit [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

## [1.2.2] - 2026-07-24

### Corrigé

- Tip de l'éditeur corrigé.
`;

function baseFacts(overrides: Partial<ReleaseFacts>): ReleaseFacts {
  return {
    tagName: "v1.3.0",
    packageVersion: "1.3.0",
    changelog: CHANGELOG_1_3_0_RELEASED,
    tagObjectType: "tag",
    tagOnMain: true,
    ...overrides,
  };
}

describe("verifyRelease", () => {
  it("rc conforme : passe (le CHANGELOG n'est jamais exige pour un -rc.N)", () => {
    const facts = baseFacts({
      tagName: "v1.3.0-rc.1",
      packageVersion: "1.3.0-rc.1",
      changelog: CHANGELOG_1_3_0_NOT_RELEASED,
    });
    expect(verifyRelease(facts)).toEqual([]);
  });

  it("final conforme : passe", () => {
    expect(verifyRelease(baseFacts({}))).toEqual([]);
  });

  it("version desynchronisee : echoue", () => {
    const failures = verifyRelease(baseFacts({ packageVersion: "1.2.2" }));
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/package\.json/);
  });

  it("section CHANGELOG manquante : echoue seule (pas de faux positif Unreleased)", () => {
    const failures = verifyRelease(baseFacts({ changelog: CHANGELOG_NO_1_3_0_SECTION_AT_ALL }));
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('"## [1.3.0]"');
  });

  it("[Unreleased] non vide : echoue (contenu qui allait etre livre sans etre journalise)", () => {
    const failures = verifyRelease(baseFacts({ changelog: CHANGELOG_1_3_0_NOT_RELEASED }));
    expect(failures.some((f) => f.includes("Unreleased"))).toBe(true);
  });

  it("section [Unreleased] absente du CHANGELOG : echoue via la meme liste de failures (pas d'exception non geree)", () => {
    const changelogSansUnreleased = CHANGELOG_1_3_0_RELEASED.replace("## [Unreleased]\n\n", "");
    const failures = verifyRelease(baseFacts({ changelog: changelogSansUnreleased }));
    expect(failures.some((f) => f.includes("Unreleased"))).toBe(true);
  });

  it("tag leger (non annote) : echoue", () => {
    const failures = verifyRelease(baseFacts({ tagObjectType: "commit" }));
    expect(failures.some((f) => f.includes("annote"))).toBe(true);
  });

  it("tag hors de origin/main : echoue", () => {
    const failures = verifyRelease(baseFacts({ tagOnMain: false }));
    expect(failures.some((f) => f.includes("origin/main"))).toBe(true);
  });

  it("nom de tag invalide : un seul echec, rien d'autre n'est verifie", () => {
    const failures = verifyRelease(baseFacts({ tagName: "1.3.0" }));
    expect(failures).toHaveLength(1);
  });

  it("cumule plusieurs echecs independants", () => {
    const failures = verifyRelease(
      baseFacts({ packageVersion: "1.2.2", tagObjectType: "commit", tagOnMain: false }),
    );
    expect(failures).toHaveLength(3);
  });
});
