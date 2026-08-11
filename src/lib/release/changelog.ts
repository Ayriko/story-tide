// Bascule pure de la section "## [Unreleased]" du CHANGELOG (format Keep a
// Changelog, cf. CHANGELOG.md) vers une section datee "## [X.Y.Z] - AAAA-MM-JJ",
// avec recreation d'une section [Unreleased] vide au-dessus. Aucune I/O ici -
// scripts/release.ts lit/ecrit le fichier, cette fonction ne fait que
// transformer une chaine en une autre (KAN-44).
//
// Regle produit (3 recidives datees, cf. dev-log 2026-07-24) : un tag final ne
// doit jamais partir avec du contenu encore sous [Unreleased] - refuse plutot
// que de deviner.

const UNRELEASED_HEADING = "## [Unreleased]";
const VERSION_HEADING_PATTERN = /^## \[/;

export class MissingUnreleasedSectionError extends Error {
  constructor() {
    super('Section "## [Unreleased]" absente du CHANGELOG.');
    this.name = "MissingUnreleasedSectionError";
  }
}

export class EmptyUnreleasedSectionError extends Error {
  constructor() {
    super('Section "## [Unreleased]" vide : rien a journaliser pour cette version finale.');
    this.name = "EmptyUnreleasedSectionError";
  }
}

export class DuplicateVersionSectionError extends Error {
  constructor(version: string) {
    super(`Une section "## [${version}]" existe deja dans le CHANGELOG.`);
    this.name = "DuplicateVersionSectionError";
  }
}

// Bornes [start, end) de la section [Unreleased] : start = index de la ligne
// d'entete, end = index de la prochaine entete "## [" (ou fin de fichier).
// Retourne null si la section n'existe pas.
function findUnreleasedBounds(lines: readonly string[]): { start: number; end: number } | null {
  const start = lines.findIndex((line) => line.trim() === UNRELEASED_HEADING);
  if (start === -1) {
    return null;
  }
  const after = lines.slice(start + 1);
  const relativeEnd = after.findIndex((line) => VERSION_HEADING_PATTERN.test(line));
  const end = relativeEnd === -1 ? lines.length : start + 1 + relativeEnd;
  return { start, end };
}

// Une ligne "compte" comme contenu si elle n'est ni vide ni un sous-titre nu
// ("### Ajoute" seul, sans puce, ne compte pas comme du contenu a journaliser).
function isContentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed !== "" && !/^###\s/.test(trimmed);
}

function trimBlankEdges(lines: readonly string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]?.trim() === "") {
    start += 1;
  }
  while (end > start && lines[end - 1]?.trim() === "") {
    end -= 1;
  }
  return lines.slice(start, end);
}

// true si la section [Unreleased] ne contient aucune ligne a journaliser.
export function isUnreleasedEmpty(changelog: string): boolean {
  const lines = changelog.split("\n");
  const bounds = findUnreleasedBounds(lines);
  if (bounds === null) {
    throw new MissingUnreleasedSectionError();
  }
  return !lines.slice(bounds.start + 1, bounds.end).some(isContentLine);
}

// true si une section "## [version]" existe deja (independamment de la date).
export function hasVersionSection(changelog: string, version: string): boolean {
  const heading = `## [${version}]`;
  return changelog.split("\n").some((line) => line.startsWith(heading));
}

// Bascule [Unreleased] -> "## [version] - date" et recree [Unreleased] vide
// au-dessus. Refuse si la section est absente, vide, ou si une section pour
// cette version existe deja (tag final uniquement, jamais appele pour un -rc.N).
export function releaseChangelog(changelog: string, version: string, date: string): string {
  if (hasVersionSection(changelog, version)) {
    throw new DuplicateVersionSectionError(version);
  }

  const lines = changelog.split("\n");
  const bounds = findUnreleasedBounds(lines);
  if (bounds === null) {
    throw new MissingUnreleasedSectionError();
  }

  const content = lines.slice(bounds.start + 1, bounds.end);
  if (!content.some(isContentLine)) {
    throw new EmptyUnreleasedSectionError();
  }
  const trimmedContent = trimBlankEdges(content);

  const replacement = [
    UNRELEASED_HEADING,
    "",
    `## [${version}] - ${date}`,
    "",
    ...trimmedContent,
    "",
  ];

  return [...lines.slice(0, bounds.start), ...replacement, ...lines.slice(bounds.end)].join("\n");
}
