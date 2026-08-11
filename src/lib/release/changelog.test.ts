import { describe, expect, it } from "vitest";
import {
  DuplicateVersionSectionError,
  EmptyUnreleasedSectionError,
  hasVersionSection,
  isUnreleasedEmpty,
  MissingUnreleasedSectionError,
  releaseChangelog,
} from "./changelog";

const PREAMBLE = `# Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet suit [SemVer](https://semver.org/lang/fr/).

`;

const PREVIOUS_SECTION = `## [1.2.2] - 2026-07-24

### Corrigé

- Tip de l'éditeur corrigé.
`;

const CHANGELOG_WITH_CONTENT = `${PREAMBLE}## [Unreleased]

### Ajouté

- Script de release.

${PREVIOUS_SECTION}`;

const CHANGELOG_EMPTY_UNRELEASED = `${PREAMBLE}## [Unreleased]

${PREVIOUS_SECTION}`;

const CHANGELOG_UNRELEASED_HEADING_ONLY = `${PREAMBLE}## [Unreleased]

### Ajouté

${PREVIOUS_SECTION}`;

const CHANGELOG_WITHOUT_UNRELEASED = `${PREAMBLE}${PREVIOUS_SECTION}`;

describe("isUnreleasedEmpty", () => {
  it("est vide quand la section ne contient aucune ligne", () => {
    expect(isUnreleasedEmpty(CHANGELOG_EMPTY_UNRELEASED)).toBe(true);
  });

  it("est vide quand seul un sous-titre nu est present (sans puce)", () => {
    expect(isUnreleasedEmpty(CHANGELOG_UNRELEASED_HEADING_ONLY)).toBe(true);
  });

  it("n'est pas vide des qu'une puce est presente", () => {
    expect(isUnreleasedEmpty(CHANGELOG_WITH_CONTENT)).toBe(false);
  });

  it("leve MissingUnreleasedSectionError si la section n'existe pas", () => {
    expect(() => isUnreleasedEmpty(CHANGELOG_WITHOUT_UNRELEASED)).toThrow(
      MissingUnreleasedSectionError,
    );
  });
});

describe("hasVersionSection", () => {
  it("detecte une section existante", () => {
    expect(hasVersionSection(CHANGELOG_WITH_CONTENT, "1.2.2")).toBe(true);
  });

  it("ne detecte pas une section absente", () => {
    expect(hasVersionSection(CHANGELOG_WITH_CONTENT, "1.3.0")).toBe(false);
  });
});

describe("releaseChangelog", () => {
  it("bascule le contenu de [Unreleased] vers une section datee et recree [Unreleased] vide", () => {
    const result = releaseChangelog(CHANGELOG_WITH_CONTENT, "1.3.0", "2026-08-13");

    expect(result).toBe(`${PREAMBLE}## [Unreleased]

## [1.3.0] - 2026-08-13

### Ajouté

- Script de release.

${PREVIOUS_SECTION}`);
    expect(isUnreleasedEmpty(result)).toBe(true);
    expect(hasVersionSection(result, "1.3.0")).toBe(true);
  });

  it("leve EmptyUnreleasedSectionError si rien a journaliser", () => {
    expect(() => releaseChangelog(CHANGELOG_EMPTY_UNRELEASED, "1.3.0", "2026-08-13")).toThrow(
      EmptyUnreleasedSectionError,
    );
  });

  it("leve EmptyUnreleasedSectionError si seul un sous-titre nu est present", () => {
    expect(() =>
      releaseChangelog(CHANGELOG_UNRELEASED_HEADING_ONLY, "1.3.0", "2026-08-13"),
    ).toThrow(EmptyUnreleasedSectionError);
  });

  it("leve MissingUnreleasedSectionError si la section est absente", () => {
    expect(() => releaseChangelog(CHANGELOG_WITHOUT_UNRELEASED, "1.3.0", "2026-08-13")).toThrow(
      MissingUnreleasedSectionError,
    );
  });

  it("leve DuplicateVersionSectionError si la section de version existe deja", () => {
    expect(() => releaseChangelog(CHANGELOG_WITH_CONTENT, "1.2.2", "2026-08-13")).toThrow(
      DuplicateVersionSectionError,
    );
  });
});
