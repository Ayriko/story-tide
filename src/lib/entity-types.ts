import {
  ENTITY_TYPE_GROUPS,
  ENTITY_TYPES,
  entityTypeGroup,
  entityTypeLabel,
  type EntityTypeGroup,
} from "./entity-schemas";

// Resolveur UNIQUE du type d'une entree (KAN-81, ADR-0030) : TS pur, aucune
// dependance UI ni base - appele aussi bien par les Server Components (pages)
// que par les Client Components (sidebar, combobox, graphe). Le registre natif
// reste en code (entity-schemas.ts) ; les types personnalises d'un monde
// arrivent par le catalogue, charge une fois par rendu (entity-type-service).

// Sentinelle stockee dans Entity.type pour une entree d'un type personnalise
// (customTypeId renseigne - contrainte CHECK en base).
export const CUSTOM_ENTITY_TYPE = "custom";

// Liste FERMEE d'icones proposees pour un type personnalise : cles de chaine
// (la correspondance avec les composants Lucide vit cote app, dans
// entity-type-icon.tsx - ce fichier reste sans dependance UI). Les 8
// premieres sont les icones des groupes (icone par defaut d'un type).
export const CUSTOM_TYPE_ICONS = [
  "user",
  "leaf",
  "map-pin",
  "shield",
  "wand",
  "book-open",
  "package",
  "sticky-note",
  "crown",
  "swords",
  "castle",
  "mountain",
  "ship",
  "rocket",
  "skull",
  "flame",
  "gem",
  "scroll",
  "feather",
  "moon",
  "sparkles",
  "eye",
  "key",
  "paw-print",
] as const;

export type EntityTypeIconKey = (typeof CUSTOM_TYPE_ICONS)[number];

export const GROUP_DEFAULT_ICON: Record<EntityTypeGroup, EntityTypeIconKey> = {
  Personnages: "user",
  Écologie: "leaf",
  Lieux: "map-pin",
  Organisation: "shield",
  Magie: "wand",
  Lore: "book-open",
  Objets: "package",
  Divers: "sticky-note",
};

export type CustomEntityTypeDTO = { id: string; label: string; group: string; icon: string };

export type WorldTypeCatalog = { custom: CustomEntityTypeDTO[]; hidden: string[] };

export type ResolvedEntityType = {
  // Cle native ou `custom:<id>` - identifiant d'affichage et de filtre,
  // JAMAIS stocke en base.
  key: string;
  label: string;
  group: EntityTypeGroup;
  icon: EntityTypeIconKey;
  isCustom: boolean;
  isHidden: boolean;
};

const CUSTOM_KEY_PREFIX = "custom:";

export function customTypeKey(customTypeId: string): string {
  return `${CUSTOM_KEY_PREFIX}${customTypeId}`;
}

// Inverse de la cle d'affichage, pour les champs de formulaire (combobox,
// cibles de reaffectation) : une cle native n'a jamais de ":" (ENTITY_TYPES),
// aucune ambiguite. null pour une cle inconnue - c'est au schema Zod de la
// frontiere de rejeter, jamais un repli silencieux.
export function parseTypeKey(key: string): { type: string; customTypeId: string | null } | null {
  if (key.startsWith(CUSTOM_KEY_PREFIX)) {
    const customTypeId = key.slice(CUSTOM_KEY_PREFIX.length);
    return customTypeId.length > 0 ? { type: CUSTOM_ENTITY_TYPE, customTypeId } : null;
  }
  return isNativeEntityType(key) ? { type: key, customTypeId: null } : null;
}

export function isNativeEntityType(type: string): type is (typeof ENTITY_TYPES)[number] {
  return (ENTITY_TYPES as readonly string[]).includes(type);
}

function isGroup(group: string): group is EntityTypeGroup {
  return (ENTITY_TYPE_GROUPS as readonly string[]).includes(group);
}

function isIconKey(icon: string): icon is EntityTypeIconKey {
  return (CUSTOM_TYPE_ICONS as readonly string[]).includes(icon);
}

function resolveCustom(custom: CustomEntityTypeDTO): ResolvedEntityType {
  // group/icon sont des chaines libres en base (validees par Zod a
  // l'ecriture) : une valeur inconnue retombe sur Divers / l'icone du groupe
  // plutot qu'un cast qui masquerait le risque.
  const group = isGroup(custom.group) ? custom.group : "Divers";
  return {
    key: customTypeKey(custom.id),
    label: custom.label,
    group,
    icon: isIconKey(custom.icon) ? custom.icon : GROUP_DEFAULT_ICON[group],
    isCustom: true,
    isHidden: false,
  };
}

function resolveNative(type: string, hidden: readonly string[]): ResolvedEntityType {
  const group = entityTypeGroup(type) ?? "Divers";
  return {
    key: type,
    label: entityTypeLabel(type),
    group,
    icon: GROUP_DEFAULT_ICON[group],
    isCustom: false,
    isHidden: hidden.includes(type),
  };
}

export function resolveEntityType(
  entity: { type: string; customTypeId: string | null },
  catalog: WorldTypeCatalog,
): ResolvedEntityType {
  if (entity.type !== CUSTOM_ENTITY_TYPE) {
    return resolveNative(entity.type, catalog.hidden);
  }
  const custom = catalog.custom.find((candidate) => candidate.id === entity.customTypeId);
  if (custom) {
    return resolveCustom(custom);
  }
  // Ne doit pas arriver (FK + CHECK en base) : catalogue perime ou donnee
  // incoherente - affichage degrade mais trace serveur/console, jamais avale.
  console.error("[entity-types] Type personnalise introuvable dans le catalogue :", {
    customTypeId: entity.customTypeId,
  });
  return {
    key: entity.customTypeId ? customTypeKey(entity.customTypeId) : CUSTOM_ENTITY_TYPE,
    label: "Type inconnu",
    group: "Divers",
    icon: GROUP_DEFAULT_ICON.Divers,
    isCustom: true,
    isHidden: false,
  };
}

// DTO d'affichage d'une entree (KAN-84, blindage des affichages) : type DEJA
// resolu, et ni `type` ni `customTypeId` - un composant d'affichage qui le
// recoit ne peut pas lire le type brut (afficher « custom »), le typecheck
// l'interdit. Seuls les formulaires de modification lisent la valeur stockee.
export type EntityListItem = {
  id: string;
  name: string;
  folderId: string | null;
  resolvedType: ResolvedEntityType;
};

export function toEntityListItem(
  entity: {
    id: string;
    name: string;
    folderId: string | null;
    type: string;
    customTypeId: string | null;
  },
  catalog: WorldTypeCatalog,
): EntityListItem {
  return {
    id: entity.id,
    name: entity.name,
    folderId: entity.folderId,
    resolvedType: resolveEntityType(entity, catalog),
  };
}

// Arbre de dossiers transmis au client : forme structurelle (pas d'import du
// service ici, ce fichier reste sans dependance base), entrees resolues. Ne
// porte que ce que la sidebar affiche - jamais le contenu des fiches.
type FolderTreeSource = {
  id: string;
  name: string;
  children: FolderTreeSource[];
  entities: Parameters<typeof toEntityListItem>[0][];
};

export type FolderTreeView = {
  id: string;
  name: string;
  children: FolderTreeView[];
  entities: EntityListItem[];
};

export function toFolderTreeView(
  folders: FolderTreeSource[],
  catalog: WorldTypeCatalog,
): FolderTreeView[] {
  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    children: toFolderTreeView(folder.children, catalog),
    entities: folder.entities.map((entity) => toEntityListItem(entity, catalog)),
  }));
}

export type GroupedEntityTypes = { group: EntityTypeGroup; types: ResolvedEntityType[] }[];

// Tous les types connus du monde (natifs dans l'ordre du registre, puis
// personnalises par libelle), regroupes dans l'ordre stable des 8 groupes,
// filtres par `keep`. Groupes vides omis.
function groupTypes(
  catalog: WorldTypeCatalog,
  keep: (type: ResolvedEntityType) => boolean,
): GroupedEntityTypes {
  const custom = [...catalog.custom]
    .sort((a, b) => a.label.localeCompare(b.label, "fr"))
    .map(resolveCustom);
  const all = [...ENTITY_TYPES.map((type) => resolveNative(type, catalog.hidden)), ...custom];
  return ENTITY_TYPE_GROUPS.map((group) => ({
    group,
    types: all.filter((type) => type.group === group && keep(type)),
  })).filter(({ types }) => types.length > 0);
}

// Types proposables a la creation : natifs masques exclus, personnalises
// inclus dans leur groupe. `alsoKeep` : cle toujours conservee meme masquee
// (type courant d'une entree en cours de modification).
export function selectableTypes(catalog: WorldTypeCatalog, alsoKeep?: string): GroupedEntityTypes {
  return groupTypes(catalog, (type) => !type.isHidden || type.key === alsoKeep);
}
