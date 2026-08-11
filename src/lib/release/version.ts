// Parsing et validation de version de release (X.Y.Z ou X.Y.Z-rc.N). Logique
// pure partagee entre scripts/release.ts (usage local, npm run release) et le
// mode --verify consomme par le garde-fou CD (cd.yml, job release-consistency)
// - une seule source de verite pour les deux etages (KAN-44).

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-rc\.\d+)?$/;

export interface ReleaseVersion {
  // Version complete, sans le prefixe "v" (ex: "1.3.0" ou "1.3.0-rc.1").
  readonly version: string;
  // true pour un tag -rc.N, false pour un tag final.
  readonly isRc: boolean;
}

export class InvalidVersionError extends Error {
  constructor(raw: string) {
    super(`Version invalide : "${raw}" (attendu X.Y.Z ou X.Y.Z-rc.N, ex : 1.3.0 ou 1.3.0-rc.1)`);
    this.name = "InvalidVersionError";
  }
}

// Parse et valide une version passee en argument du script (sans "v").
export function parseReleaseVersion(raw: string): ReleaseVersion {
  if (!VERSION_PATTERN.test(raw)) {
    throw new InvalidVersionError(raw);
  }
  return { version: raw, isRc: raw.includes("-rc.") };
}

// Nom du tag git annote correspondant a une version ("1.3.0" -> "v1.3.0").
export function tagNameFor(version: string): string {
  return `v${version}`;
}

// Extrait et valide la version portee par un nom de tag ("v1.3.0" -> ReleaseVersion).
// Utilise par --verify, qui recoit le nom du tag pousse (GITHUB_REF_NAME).
export function versionFromTagName(tagName: string): ReleaseVersion {
  if (!tagName.startsWith("v")) {
    throw new InvalidVersionError(tagName);
  }
  return parseReleaseVersion(tagName.slice(1));
}
